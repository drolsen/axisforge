import { recordDrawCall } from '../framegraph/stats.js';
import { VERTEX_STRIDE } from '../mesh/mesh.js';
import { lookAt, perspective, mat4Multiply, addVec3 } from '../mesh/math.js';
import { getActiveCamera } from '../camera/manager.js';
import renderList from '../scene/renderList.js';
import { GetService } from '../../core/index.js';

const FLOAT_SIZE = 4;
const SCENE_FLOATS = 32;
const SCENE_BUFFER_SIZE = SCENE_FLOATS * FLOAT_SIZE;

const SHADER = /* wgsl */`
struct SceneUniforms {
  viewProj : mat4x4<f32>;
  view : mat4x4<f32>;
};

struct InstanceUniforms {
  model : mat4x4<f32>;
  normal : mat4x4<f32>;
};

struct VertexInput {
  @location(0) position : vec3<f32>;
  @location(1) normal : vec3<f32>;
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>;
  @location(0) normal : vec3<f32>;
};

@group(0) @binding(0) var<uniform> scene : SceneUniforms;
@group(1) @binding(0) var<uniform> instanceUniform : InstanceUniforms;

@vertex
fn vs(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let world = instanceUniform.model * vec4<f32>(input.position, 1.0);
  let clip = scene.viewProj * world;
  output.position = clip;
  let worldNormal = (instanceUniform.normal * vec4<f32>(input.normal, 0.0)).xyz;
  let viewNormal = (scene.view * vec4<f32>(worldNormal, 0.0)).xyz;
  output.normal = normalize(viewNormal);
  return output;
}

@fragment
fn fs(@location(0) normal : vec3<f32>) -> @location(0) vec4<f32> {
  let encoded = normal * 0.5 + vec3<f32>(0.5);
  return vec4<f32>(encoded, 1.0);
}`;

export default class DepthNormalPass {
  constructor(device, getSize) {
    this.device = device;
    this.getSize = getSize;

    this.sceneBuffer = null;
    this.sceneArray = null;
    this.sceneLayout = null;
    this.instanceLayout = null;
    this.pipeline = null;

    this.normalTexture = null;
    this.normalView = null;
    this.depthTexture = null;
    this.depthView = null;
    this.depthFormat = 'depth24plus';
    this.normalFormat = 'rgba8unorm';
    this.width = 0;
    this.height = 0;

    this.lighting = GetService('Lighting');
  }

  async init() {
    this.sceneArray = new Float32Array(SCENE_FLOATS);
    this.sceneBuffer = this.device.createBuffer({
      size: SCENE_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.sceneLayout = this.device.createBindGroupLayout({
      label: 'DepthNormalSceneLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.instanceLayout = this.device.createBindGroupLayout({
      label: 'DepthNormalInstanceLayout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    const module = this.device.createShaderModule({ code: SHADER });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.sceneLayout, this.instanceLayout],
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'DepthNormalPipeline',
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
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [
          {
            format: this.normalFormat,
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
        depthCompare: 'less',
      },
    });
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.width === w && this.height === h && this.normalTexture && this.depthTexture) {
      return false;
    }
    this.width = w;
    this.height = h;

    if (this.normalTexture) {
      this.normalTexture.destroy();
    }
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.normalTexture = this.device.createTexture({
      label: 'DepthNormalNormalTexture',
      size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
      format: this.normalFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.normalView = this.normalTexture.createView();

    this.depthTexture = this.device.createTexture({
      label: 'DepthNormalDepthTexture',
      size: { width: this.width, height: this.height, depthOrArrayLayers: 1 },
      format: this.depthFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.depthView = this.depthTexture.createView();
    return true;
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
      this.sceneArray.set(uniform.subarray(0, 16), 0);
      this.sceneArray.set(uniform.subarray(16, 32), 16);
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

  getDepthView() {
    return this.depthView;
  }

  getNormalView() {
    return this.normalView;
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  execute(encoder) {
    if (!this.pipeline || !this.normalView || !this.depthView) {
      return;
    }

    const size = this.getSize ? this.getSize() : { width: this.width, height: this.height };
    const width = size?.width ?? this.width;
    const height = size?.height ?? this.height;

    const cameraInfo = this._updateSceneUniform(width, height);
    const visibleInstances = renderList.update(cameraInfo);

    if (!visibleInstances.length) {
      return;
    }

    const sceneBindGroup = this.device.createBindGroup({
      layout: this.sceneLayout,
      entries: [
        { binding: 0, resource: { buffer: this.sceneBuffer } },
      ],
    });

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.normalView,
          clearValue: { r: 0.5, g: 0.5, b: 1.0, a: 1.0 },
          loadOp: 'clear',
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
    pass.setBindGroup(0, sceneBindGroup);

    for (const instance of visibleInstances) {
      if (!instance?.mesh) {
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
        recordDrawCall(this.constructor.name);
      }
    }

    pass.end();
  }
}
