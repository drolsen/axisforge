import { recordDrawCall } from '../framegraph/stats.js';
import drawList from '../mesh/drawList.js';
import { VERTEX_STRIDE } from '../mesh/mesh.js';
import { GetService } from '../../core/index.js';
import { getActiveCamera } from '../camera/manager.js';

const SHADOW_SHADER = /* wgsl */`
struct CascadeUniform {
  viewProj : mat4x4<f32>,
};

struct InstanceUniform {
  model : mat4x4<f32>,
  normal : mat4x4<f32>,
};

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) tangent : vec4<f32>,
  @location(3) uv : vec2<f32>,
};

@group(0) @binding(0) var<uniform> cascade : CascadeUniform;
@group(1) @binding(0) var<uniform> instanceUniform : InstanceUniform;

@vertex
fn vs(input : VertexInput) -> @builtin(position) vec4<f32> {
  let world = instanceUniform.model * vec4<f32>(input.position, 1.0);
  return cascade.viewProj * world;
}
`;

const FALLBACK_CAMERA = {
  position: [0, 15, 35],
  direction: [0, -0.35, -1],
  up: [0, 1, 0],
  near: 0.1,
  far: 150,
  fov: Math.PI / 3,
};

const MAX_CASCADES = 4;

export default class ShadowMapPass {
  constructor(device, getSize) {
    this.device = device;
    this.getSize = getSize;

    this.pipeline = null;
    this.cascadeLayout = null;
    this.instanceLayout = null;
    this.cascadeBuffer = null;
    this.cascadeArray = null;
    this.cascadeBindGroup = null;

    this.shadowTexture = null;
    this.shadowArrayView = null;
    this.layerViews = [];
    this.shadowResolution = 0;
    this.shadowCascadeCount = 0;
    this.shadowSampler = null;
    this.depthFormat = 'depth32float';

    this.lighting = GetService('Lighting');
  }

  async init() {
    this.cascadeLayout = this.device.createBindGroupLayout({
      label: 'ShadowMapCascadeLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.instanceLayout = this.device.createBindGroupLayout({
      label: 'ShadowMapInstanceLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    const module = this.device.createShaderModule({ code: SHADOW_SHADER });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.cascadeLayout, this.instanceLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'ShadowMapPipeline',
      layout: pipelineLayout,
      vertex: {
        module,
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
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        format: this.depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less-equal',
      },
    });

    this.cascadeArray = new Float32Array(16);
    this.cascadeBuffer = this.device.createBuffer({
      size: this.cascadeArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.cascadeBindGroup = this.device.createBindGroup({
      layout: this.cascadeLayout,
      entries: [
        { binding: 0, resource: { buffer: this.cascadeBuffer } },
      ],
    });

    this.shadowSampler = this.device.createSampler({
      label: 'ShadowMapSampler',
      compare: 'less-equal',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
  }

  _ensureShadowTexture(resolution, cascadeCount) {
    const res = Math.max(16, Math.floor(resolution));
    const cascades = Math.max(1, Math.min(MAX_CASCADES, Math.floor(cascadeCount)));

    if (
      this.shadowTexture &&
      this.shadowResolution === res &&
      this.shadowCascadeCount === cascades
    ) {
      return;
    }

    if (this.shadowTexture) {
      this.shadowTexture.destroy();
    }

    this.shadowResolution = res;
    this.shadowCascadeCount = cascades;

    this.shadowTexture = this.device.createTexture({
      label: 'ShadowMapTexture',
      size: { width: res, height: res, depthOrArrayLayers: cascades },
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.shadowArrayView = this.shadowTexture.createView({
      label: 'ShadowMapArrayView',
      dimension: '2d-array',
      baseArrayLayer: 0,
      arrayLayerCount: cascades,
    });

    this.layerViews = [];
    for (let i = 0; i < cascades; i += 1) {
      this.layerViews.push(
        this.shadowTexture.createView({
          dimension: '2d',
          baseArrayLayer: i,
          arrayLayerCount: 1,
        }),
      );
    }

    if (this.lighting?.setShadowMapResources) {
      this.lighting.setShadowMapResources({
        texture: this.shadowTexture,
        view: this.shadowArrayView,
        sampler: this.shadowSampler,
        resolution: res,
      });
    }
  }

  _updateCascadeUniform(matrix) {
    if (!matrix) {
      return;
    }
    this.cascadeArray.set(matrix);
    this.device.queue.writeBuffer(
      this.cascadeBuffer,
      0,
      this.cascadeArray.buffer,
      this.cascadeArray.byteOffset,
      this.cascadeArray.byteLength,
    );
  }

  _updateLightingCamera() {
    if (!this.lighting) {
      return;
    }

    const size = this.getSize ? this.getSize() : null;
    const width = size?.width ?? 1;
    const height = size?.height ?? 1;
    const aspect = height > 0 ? width / height : 1;

    const activeCamera = getActiveCamera();

    let position;
    let direction;
    let up;
    let near;
    let far;
    let fov;

    if (activeCamera) {
      activeCamera.setAspect(aspect);
      position = activeCamera.getPosition();
      direction = activeCamera.getForward();
      up = activeCamera.getUp();
      near = activeCamera.getNear();
      far = activeCamera.getFar();
      fov = activeCamera.getFov();
    } else {
      position = FALLBACK_CAMERA.position;
      direction = FALLBACK_CAMERA.direction;
      up = FALLBACK_CAMERA.up;
      near = FALLBACK_CAMERA.near;
      far = FALLBACK_CAMERA.far;
      fov = FALLBACK_CAMERA.fov;
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
  }

  execute(encoder) {
    if (!this.pipeline || !this.lighting) {
      return;
    }

    const settings = this.lighting.getShadowSettings ? this.lighting.getShadowSettings() : null;
    const cascadeCount = settings?.cascadeCount ?? 1;
    const resolution = settings?.resolution ?? 1024;

    this._ensureShadowTexture(resolution, cascadeCount);

    // Keep resources in sync even if texture was reused.
    if (this.lighting?.setShadowMapResources && this.shadowArrayView) {
      this.lighting.setShadowMapResources({
        texture: this.shadowTexture,
        view: this.shadowArrayView,
        sampler: this.shadowSampler,
        resolution: this.shadowResolution,
      });
    }

    this._updateLightingCamera();

    const sun = this.lighting.getSun ? this.lighting.getSun() : null;
    if (!sun || sun.intensity <= 0) {
      return;
    }

    const cascades = Array.isArray(sun.cascadeData) ? sun.cascadeData : [];

    if (!cascades.length) {
      return;
    }

    const instances = drawList.getInstances();
    if (!instances.length) {
      return;
    }

    const cascadesToRender = Math.min(this.shadowCascadeCount, cascades.length);

    for (let cascadeIndex = 0; cascadeIndex < cascadesToRender; cascadeIndex += 1) {
      const cascade = cascades[cascadeIndex];
      const view = this.layerViews[cascadeIndex];
      if (!cascade?.viewProjectionMatrix || !view) {
        continue;
      }

      this._updateCascadeUniform(cascade.viewProjectionMatrix);

      const pass = encoder.beginRenderPass({
        depthStencilAttachment: {
          view,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
          depthClearValue: 1.0,
        },
      });

      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.cascadeBindGroup);

      for (const instance of instances) {
        if (!instance.mesh) {
          continue;
        }
        const instanceBindGroup = instance.getBindGroup(this.device, this.instanceLayout);
        if (!instanceBindGroup) {
          continue;
        }

        pass.setBindGroup(1, instanceBindGroup);

        const mesh = instance.mesh;
        for (const primitive of mesh.primitives) {
          pass.setVertexBuffer(0, primitive.vertexBuffer);
          if (primitive.indexBuffer && primitive.indexCount > 0) {
            pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat || 'uint32');
            pass.drawIndexed(primitive.indexCount, 1, 0, 0, 0);
          } else {
            pass.draw(primitive.vertexCount, 1, 0, 0);
          }
          recordDrawCall('ShadowMapPass');
        }
      }

      pass.end();
    }
  }
}
