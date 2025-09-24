import { recordDrawCall } from '../framegraph/stats.js';
import drawList from '../mesh/drawList.js';
import Materials from '../materials/registry.js';
import { VERTEX_STRIDE } from '../mesh/mesh.js';
import { lookAt, perspective, mat4Multiply, addVec3 } from '../mesh/math.js';
import { GetService } from '../../core/index.js';

const FLOAT_SIZE = 4;
const SCENE_FLOATS = 36;
const SCENE_BUFFER_SIZE = SCENE_FLOATS * FLOAT_SIZE;

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

    this.depthTexture = null;
    this.depthView = null;
    this.depthFormat = 'depth24plus';
    this.depthWidth = 0;
    this.depthHeight = 0;

    this.lighting = GetService('Lighting');
  }

  async _loadShaderModule() {
    const url = new URL('../materials/pbrStandard.wgsl', import.meta.url);
    const response = await fetch(url);
    const code = await response.text();
    return this.device.createShaderModule({ code });
  }

  async init() {
    this.sceneArray = new Float32Array(SCENE_FLOATS);
    this.sceneBuffer = this.device.createBuffer({
      size: SCENE_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sceneLayout = this.device.createBindGroupLayout({
      label: 'MeshPassSceneLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
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
      ],
    });

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
    const cameraState = this.lighting?.getCameraState ? this.lighting.getCameraState() : {
      position: [0, 5, 15],
      direction: [0, -0.3, -1],
      up: [0, 1, 0],
      near: 0.1,
      far: 100,
      fov: Math.PI / 3,
      aspect: aspect,
    };

    if (this.lighting?.setCameraState) {
      this.lighting.setCameraState({ aspect });
    }

    const target = addVec3(cameraState.position, cameraState.direction);
    const view = lookAt(cameraState.position, target, cameraState.up);
    const projection = perspective(cameraState.fov, aspect, cameraState.near, cameraState.far);
    const viewProj = mat4Multiply(projection, view);

    this.sceneArray.set(viewProj, 0);
    this.sceneArray.set(view, 16);
    this.sceneArray[32] = cameraState.position[0];
    this.sceneArray[33] = cameraState.position[1];
    this.sceneArray[34] = cameraState.position[2];
    this.sceneArray[35] = 1.0;

    this.device.queue.writeBuffer(
      this.sceneBuffer,
      0,
      this.sceneArray.buffer,
      this.sceneArray.byteOffset,
      this.sceneArray.byteLength,
    );

    if (this.lighting?.update) {
      this.lighting.update();
    }
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
    this._updateSceneUniform(width, height);

    const instances = drawList.getInstances();
    if (!instances.length) {
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

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.sceneBindGroup);

    for (const instance of instances) {
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

    pass.end();
  }
}
