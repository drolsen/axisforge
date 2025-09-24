import { recordDrawCall } from '../framegraph/stats.js';
import Materials from '../materials/registry.js';
import { VERTEX_STRIDE } from '../mesh/mesh.js';
import { lookAt, perspective, mat4Multiply, addVec3 } from '../mesh/math.js';
import { GetService } from '../../core/index.js';
import { getActiveCamera, getGridFade } from '../camera/manager.js';
import renderList from '../scene/renderList.js';

const FLOAT_SIZE = 4;
const MAX_CASCADES = 4;
const SCENE_FLOATS = 120;
const SCENE_BUFFER_SIZE = SCENE_FLOATS * FLOAT_SIZE;
const GRID_FLOATS = 24;
const GRID_BUFFER_SIZE = GRID_FLOATS * FLOAT_SIZE;
const GRID_EXTENT = 400;
const GRID_THIN_WIDTH = 0.02;
const GRID_MAJOR_WIDTH = 0.08;
const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const GRID_SHADER = /* wgsl */`
struct GridUniforms {
  viewProj : mat4x4<f32>,
  cameraPos : vec4<f32>,
  params : vec4<f32>,
};

struct GridVertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) world : vec3<f32>,
};

@group(0) @binding(0) var<uniform> grid : GridUniforms;

fn lineMask(coord : f32, width : f32) -> f32 {
  let dist = abs(fract(coord) - 0.5);
  return 1.0 - smoothstep(0.0, width, dist);
}

@vertex
fn vs(@builtin(vertex_index) index : u32) -> GridVertexOutput {
  const corners = array<vec2f, 4>(
    vec2f(-1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );
  const indices = array<u32, 6>(0u, 1u, 2u, 2u, 1u, 3u);
  let uv = corners[indices[index]];
  let extent = grid.params.y;
  var world = vec3f(uv.x * extent, 0.0, uv.y * extent);
  var output : GridVertexOutput;
  output.world = world;
  output.position = grid.viewProj * vec4f(world, 1.0);
  return output;
}

@fragment
fn fs(@location(0) world : vec3f) -> @location(0) vec4f {
  let fade = grid.params.x;
  if (fade <= 0.001) {
    return vec4f(0.0, 0.0, 0.0, 0.0);
  }

  let coord = world.xz;
  let thinWidth = grid.params.z;
  let majorWidth = grid.params.w;

  let thin = max(lineMask(coord.x, thinWidth), lineMask(coord.y, thinWidth));
  let major = max(lineMask(coord.x / 10.0, majorWidth), lineMask(coord.y / 10.0, majorWidth));
  let intensity = max(thin * 0.35, major);

  let cameraHeight = abs(grid.cameraPos.y);
  let heightFade = clamp(1.0 - cameraHeight / 80.0, 0.2, 1.0);
  let extentFade = clamp(1.0 - length(coord) / grid.params.y, 0.0, 1.0);

  let baseColor = vec3f(0.35, 0.35, 0.38);
  let majorColor = vec3f(0.8, 0.8, 0.82);
  let color = mix(baseColor, majorColor, major);

  let alpha = fade * intensity * heightFade * extentFade;
  return vec4f(color * alpha, alpha);
}`;

export default class MeshPass {
  constructor(device, format, getView, getSize) {
    this.device = device;
    this.format = format;
    this.getView = getView;
    this.getSize = getSize;

    this.pipeline = null;
    this.sceneBuffer = null;
    this.sceneArray = null;
    this.sceneBindGroup = null;
    this.sceneLayout = null;
    this.instanceLayout = null;
    this.sceneBindGroupDirty = true;

    this.shadowMapView = null;
    this.shadowSampler = null;
    this.defaultShadowTexture = null;
    this.defaultShadowView = null;
    this.defaultShadowSampler = null;

    this.gridPipeline = null;
    this.gridLayout = null;
    this.gridBindGroup = null;
    this.gridBuffer = null;
    this.gridArray = null;

    this.depthTexture = null;
    this.depthView = null;
    this.depthFormat = 'depth24plus';
    this.depthWidth = 0;
    this.depthHeight = 0;

    this.lighting = GetService('Lighting');
  }

  async _loadShaderModule() {
    const [shadowUrl, pbrUrl] = [
      new URL('../materials/shadow.wgsl', import.meta.url),
      new URL('../materials/pbrStandard.wgsl', import.meta.url),
    ];
    const [shadowSource, pbrSource] = await Promise.all([
      fetch(shadowUrl).then(resp => resp.text()),
      fetch(pbrUrl).then(resp => resp.text()),
    ]);
    const code = `${shadowSource}\n${pbrSource}`;
    return this.device.createShaderModule({ code });
  }

  async init() {
    this.sceneArray = new Float32Array(SCENE_FLOATS);
    this.sceneBuffer = this.device.createBuffer({
      size: SCENE_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this._createDefaultShadowResources();

    this.sceneLayout = this.device.createBindGroupLayout({
      label: 'MeshPassSceneLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', viewDimension: '2d-array' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });

    this.instanceLayout = this.device.createBindGroupLayout({
      label: 'MeshPassInstanceLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.sceneBindGroup = this.device.createBindGroup({
      label: 'MeshPassSceneBindGroup',
      layout: this.sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: this.defaultShadowView },
        { binding: 2, resource: this.defaultShadowSampler },
      ],
    });
    this.shadowMapView = this.defaultShadowView;
    this.shadowSampler = this.defaultShadowSampler;
    this.sceneBindGroupDirty = false;

    const materialLayout = Materials.getLayout('StandardPBR');
    if (!materialLayout) {
      throw new Error('StandardPBR material layout not available.');
    }

    const shaderModule = await this._loadShaderModule();
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.sceneLayout, materialLayout, this.instanceLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: VERTEX_STRIDE,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' },
              { shaderLocation: 1, offset: 12, format: 'float32x3' },
              { shaderLocation: 2, offset: 24, format: 'float32x4' },
              { shaderLocation: 3, offset: 40, format: 'float32x2' },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [
          { format: this.format },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    this._createGridPipeline();
  }

  _createDefaultShadowResources() {
    if (this.defaultShadowTexture) {
      return;
    }

    this.defaultShadowTexture = this.device.createTexture({
      label: 'MeshPassShadowFallback',
      size: { width: 1, height: 1, depthOrArrayLayers: MAX_CASCADES },
      format: 'depth32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.defaultShadowView = this.defaultShadowTexture.createView({
      label: 'MeshPassShadowFallbackView',
      dimension: '2d-array',
      baseArrayLayer: 0,
      arrayLayerCount: MAX_CASCADES,
    });
    this.defaultShadowSampler = this.device.createSampler({
      label: 'MeshPassShadowFallbackSampler',
      compare: 'less-equal',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
  }

  _createGridPipeline() {
    this.gridArray = new Float32Array(GRID_FLOATS);
    this.gridBuffer = this.device.createBuffer({
      label: 'MeshPassGridUniform',
      size: GRID_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.gridLayout = this.device.createBindGroupLayout({
      label: 'MeshPassGridLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    this.gridBindGroup = this.device.createBindGroup({
      label: 'MeshPassGridBindGroup',
      layout: this.gridLayout,
      entries: [
        { binding: 0, resource: { buffer: this.gridBuffer } },
      ],
    });

    const module = this.device.createShaderModule({ code: GRID_SHADER });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.gridLayout],
    });

    this.gridPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: 'vs',
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none',
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
      },
    });
  }

  _updateSceneBindGroupResources(shadowView, shadowSampler) {
    const view = shadowView ?? this.defaultShadowView;
    const sampler = shadowSampler ?? this.defaultShadowSampler;

    if (
      !this.sceneBindGroupDirty &&
      this.sceneBindGroup &&
      this.shadowMapView === view &&
      this.shadowSampler === sampler
    ) {
      return;
    }

    this.shadowMapView = view;
    this.shadowSampler = sampler;
    this.sceneBindGroup = this.device.createBindGroup({
      label: 'MeshPassSceneBindGroup',
      layout: this.sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
        { binding: 1, resource: view },
        { binding: 2, resource: sampler },
      ],
    });
    this.sceneBindGroupDirty = false;
  }

  _writeGridUniform(info) {
    if (!this.gridArray || !info?.viewProjection) {
      return false;
    }
    const fade = getGridFade();
    if (fade <= 0.001) {
      return false;
    }

    this.gridArray.set(info.viewProjection, 0);
    const position = info.position || [0, 0, 0];
    this.gridArray[16] = position[0];
    this.gridArray[17] = position[1];
    this.gridArray[18] = position[2];
    this.gridArray[19] = 1;
    this.gridArray[20] = fade;
    this.gridArray[21] = GRID_EXTENT;
    this.gridArray[22] = GRID_THIN_WIDTH;
    this.gridArray[23] = GRID_MAJOR_WIDTH;

    this.device.queue.writeBuffer(
      this.gridBuffer,
      0,
      this.gridArray.buffer,
      this.gridArray.byteOffset,
      this.gridArray.byteLength,
    );
    return true;
  }

  _drawGrid(pass, info) {
    if (!this.gridPipeline || !info?.viewProjection) {
      return;
    }
    if (!this._writeGridUniform(info)) {
      return;
    }

    pass.setPipeline(this.gridPipeline);
    pass.setBindGroup(0, this.gridBindGroup);
    pass.draw(6, 1, 0, 0);
    recordDrawCall(`${this.constructor.name}:Grid`);
  }

  _ensureDepthTexture(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.depthTexture && this.depthWidth === w && this.depthHeight === h) {
      return;
    }
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    this.depthWidth = w;
    this.depthHeight = h;
    this.depthTexture = this.device.createTexture({
      size: { width: w, height: h, depthOrArrayLayers: 1 },
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = this.depthTexture.createView();
  }

  _updateSceneUniform(width, height) {
    const aspect = height > 0 ? width / height : 1;
    const activeCamera = getActiveCamera();

    let view;
    let viewProj;
    let position;
    let direction;
    let up;
    let near;
    let far;
    let fov;
    let cameraRef = null;

    if (activeCamera) {
      activeCamera.setAspect(aspect);
      const uniform = activeCamera.getUniformArray();
      this.sceneArray.set(uniform);
      view = activeCamera.getViewMatrix();
      viewProj = activeCamera.getViewProjectionMatrix();
      position = activeCamera.getPosition();
      direction = activeCamera.getForward();
      up = activeCamera.getUp();
      near = activeCamera.getNear();
      far = activeCamera.getFar();
      fov = activeCamera.getFov();
      cameraRef = activeCamera;
    } else {
      const fallback = {
        position: [0, 5, 15],
        direction: [0, -0.3, -1],
        up: [0, 1, 0],
        near: 0.1,
        far: 100,
        fov: Math.PI / 3,
      };
      const target = addVec3(fallback.position, fallback.direction);
      view = lookAt(fallback.position, target, fallback.up);
      const projection = perspective(fallback.fov, aspect, fallback.near, fallback.far);
      viewProj = mat4Multiply(projection, view);
      this.sceneArray.set(viewProj, 0);
      this.sceneArray.set(view, 16);
      this.sceneArray[32] = fallback.position[0];
      this.sceneArray[33] = fallback.position[1];
      this.sceneArray[34] = fallback.position[2];
      this.sceneArray[35] = 1.0;
      position = fallback.position;
      direction = fallback.direction;
      up = fallback.up;
      near = fallback.near;
      far = fallback.far;
      fov = fallback.fov;
    }

    if (this.lighting?.setCameraState) {
      this.lighting.setCameraState({
        position: [...position],
        direction: [...direction],
        up: [...up],
        near,
        far,
        fov,
        aspect,
      });
    }

    if (this.lighting?.update) {
      this.lighting.update();
    }

    let sunDirection = [0, -1, 0];
    let sunColor = [1, 1, 1];
    let sunIntensity = 3.5;
    let sunData = null;
    if (this.lighting?.getSun) {
      sunData = this.lighting.getSun();
      if (Array.isArray(sunData?.direction) && sunData.direction.length >= 3) {
        sunDirection = sunData.direction;
      }
      if (Array.isArray(sunData?.color) && sunData.color.length >= 3) {
        sunColor = sunData.color;
      }
      if (typeof sunData?.intensity === 'number') {
        sunIntensity = sunData.intensity;
      }
    }

    let ambientColor = [0.03, 0.03, 0.03];
    let ambientIntensity = 1.0;
    if (this.lighting?.getAmbient) {
      const ambient = this.lighting.getAmbient();
      if (Array.isArray(ambient?.color) && ambient.color.length >= 3) {
        ambientColor = ambient.color;
      }
      if (typeof ambient?.intensity === 'number') {
        ambientIntensity = ambient.intensity;
      }
    }

    this.sceneArray.set([sunDirection[0], sunDirection[1], sunDirection[2], 0], 36);
    this.sceneArray.set([sunColor[0], sunColor[1], sunColor[2], sunIntensity], 40);
    this.sceneArray.set([ambientColor[0], ambientColor[1], ambientColor[2], ambientIntensity], 44);

    const cascadeOffset = 48;
    const splitsOffset = cascadeOffset + MAX_CASCADES * 16;
    const shadowParamsOffset = splitsOffset + 4;
    const cascades = Array.isArray(sunData?.cascadeData) ? sunData.cascadeData : [];
    const splits = new Float32Array(MAX_CASCADES);
    let lastSplit = far ?? 100;

    for (let i = 0; i < MAX_CASCADES; i += 1) {
      const matrixOffset = cascadeOffset + i * 16;
      const cascade = cascades[i];
      if (cascade?.viewProjectionMatrix) {
        this.sceneArray.set(cascade.viewProjectionMatrix, matrixOffset);
        const splitFar = typeof cascade.far === 'number' ? cascade.far : lastSplit;
        splits[i] = splitFar;
        lastSplit = splitFar;
      } else {
        this.sceneArray.set(IDENTITY_MATRIX, matrixOffset);
        splits[i] = lastSplit;
      }
    }

    this.sceneArray.set(splits, splitsOffset);

    let cascadeCount = Math.min(MAX_CASCADES, cascades.length);
    if (sunIntensity <= 0.0) {
      cascadeCount = 0;
    }
    const shadowInfo = sunData?.shadow ?? null;
    const shadowView = shadowInfo?.mapView ?? null;
    const shadowSampler = shadowInfo?.sampler ?? null;
    const shadowResolution = Math.max(1, Math.floor(shadowInfo?.resolution ?? 2048));
    const shadowSettings = shadowInfo?.settings ?? {};
    const shadowBias = typeof shadowSettings.bias === 'number' ? shadowSettings.bias : 0.0025;
    const shadowNormalBias = typeof shadowSettings.normalBias === 'number' ? shadowSettings.normalBias : 0.5;

    this.sceneArray[shadowParamsOffset + 0] = cascadeCount;
    this.sceneArray[shadowParamsOffset + 1] = 1 / shadowResolution;
    this.sceneArray[shadowParamsOffset + 2] = shadowBias;
    this.sceneArray[shadowParamsOffset + 3] = shadowNormalBias;

    this._updateSceneBindGroupResources(shadowView, shadowSampler);

    this.device.queue.writeBuffer(
      this.sceneBuffer,
      0,
      this.sceneArray.buffer,
      this.sceneArray.byteOffset,
      this.sceneArray.byteLength,
    );

    return {
      viewProjection: viewProj,
      position,
      direction,
      camera: cameraRef,
    };
  }

  execute(encoder) {
    const view = this.getView ? this.getView() : null;
    if (!view || !this.pipeline) {
      return;
    }

    const size = this.getSize ? this.getSize() : null;
    const width = size?.width ?? this.depthWidth ?? 1;
    const height = size?.height ?? this.depthHeight ?? 1;

    this._ensureDepthTexture(width, height);
    const cameraInfo = this._updateSceneUniform(width, height);

    const visibleInstances = renderList.update(cameraInfo);
    const shouldDrawGrid = this.gridPipeline && getGridFade() > 0.001;
    if (!visibleInstances.length && !shouldDrawGrid) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp: 'load',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: this.depthView,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
        depthClearValue: 1.0,
      },
    });

    if (shouldDrawGrid) {
      this._drawGrid(pass, cameraInfo);
    }

    if (visibleInstances.length) {
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.sceneBindGroup);

      for (const instance of visibleInstances) {
        if (!instance.mesh) {
          continue;
        }
        const instanceBindGroup = instance.getBindGroup(this.device, this.instanceLayout);
        if (!instanceBindGroup) {
          continue;
        }

        pass.setBindGroup(2, instanceBindGroup);

        const mesh = instance.mesh;
        for (let i = 0; i < mesh.primitives.length; i += 1) {
          const primitive = mesh.primitives[i];
          const materialId = instance.getMaterialForPrimitive(i);
          const materialRecord = materialId != null ? Materials.get(materialId) : null;
          const materialBindGroup = materialRecord?.binding?.bindGroup;
          if (!materialBindGroup) {
            continue;
          }

          pass.setBindGroup(1, materialBindGroup);
          pass.setVertexBuffer(0, primitive.vertexBuffer);

          if (primitive.indexBuffer && primitive.indexCount > 0) {
            pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat || 'uint32');
            pass.drawIndexed(primitive.indexCount, 1, 0, 0, 0);
          } else {
            pass.draw(primitive.vertexCount, 1, 0, 0);
          }
          recordDrawCall(this.constructor.name);
        }
      }
    }

    pass.end();
  }
}
