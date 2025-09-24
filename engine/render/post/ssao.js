import { PostFXSettings } from './settings.js';
import { getActiveCamera } from '../camera/manager.js';
import { lookAt, perspective, mat4Multiply, addVec3, mat4Invert } from '../mesh/math.js';

const NOISE_SIZE = 4;
const KERNEL_SIZE = 32;
const FLOAT_SIZE = 4;
const MATRIX_FLOATS = 16;
const UNIFORM_FLOATS = MATRIX_FLOATS * 2 + 8; // proj, invProj, params, noiseScale
const UNIFORM_BUFFER_SIZE = UNIFORM_FLOATS * FLOAT_SIZE;

function generateKernel(size) {
  const samples = [];
  for (let i = 0; i < size; i += 1) {
    let x = Math.random() * 2 - 1;
    let y = Math.random() * 2 - 1;
    let z = Math.random();
    let vecLength = Math.hypot(x, y, z);
    if (vecLength === 0) {
      x = 0;
      y = 0;
      z = 1;
      vecLength = 1;
    }
    x /= vecLength;
    y /= vecLength;
    z /= vecLength;
    let scale = i / size;
    scale = 0.1 + 0.9 * (scale * scale);
    samples.push(x * scale, y * scale, z * scale, 0);
  }
  return new Float32Array(samples);
}

function generateNoise(size) {
  const count = size * size;
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * 0.5 + 0.5;
    const y = Math.sin(angle) * 0.5 + 0.5;
    data[i * 4 + 0] = Math.round(x * 255);
    data[i * 4 + 1] = Math.round(y * 255);
    data[i * 4 + 2] = 128;
    data[i * 4 + 3] = 255;
  }
  return data;
}

function createWhiteTexture(device) {
  const texture = device.createTexture({
    label: 'SSAOFallbackTexture',
    size: { width: 1, height: 1, depthOrArrayLayers: 1 },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  const data = new Uint8Array([255, 255, 255, 255]);
  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );
  return texture.createView();
}

export default class SSAOPass {
  constructor(device, depthNormalPass) {
    this.device = device;
    this.depthNormalPass = depthNormalPass;

    this.pipeline = null;
    this.bindGroup = null;
    this.bindGroupDirty = true;

    this.uniformArray = new Float32Array(UNIFORM_FLOATS);
    this.uniformBuffer = null;
    this.kernelArray = generateKernel(KERNEL_SIZE);
    this.kernelBuffer = null;

    this.noiseTexture = null;
    this.noiseView = null;
    this.outputTexture = null;
    this.outputView = null;
    this.outputSampler = null;
    this.depthSampler = null;
    this.linearSampler = null;

    this.width = 0;
    this.height = 0;

    this.shaderModule = null;
    this.noiseData = generateNoise(NOISE_SIZE);

    this.fallbackView = null;
    this.lastDepthView = null;
    this.lastNormalView = null;
  }

  async init() {
    const shaderUrl = new URL('./ssao.wgsl', import.meta.url);
    const code = await fetch(shaderUrl).then(resp => resp.text());
    this.shaderModule = this.device.createShaderModule({ code });

    this.pipeline = this.device.createRenderPipeline({
      label: 'SSAOPipeline',
      layout: 'auto',
      vertex: { module: this.shaderModule, entryPoint: 'vs' },
      fragment: {
        module: this.shaderModule,
        entryPoint: 'fs',
        targets: [{ format: 'rgba8unorm' }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });

    this.uniformBuffer = this.device.createBuffer({
      label: 'SSAOUniformBuffer',
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.kernelBuffer = this.device.createBuffer({
      label: 'SSAOKernelBuffer',
      size: this.kernelArray.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(
      this.kernelBuffer,
      0,
      this.kernelArray.buffer,
      this.kernelArray.byteOffset,
      this.kernelArray.byteLength,
    );

    this.noiseTexture = this.device.createTexture({
      label: 'SSAONoiseTexture',
      size: { width: NOISE_SIZE, height: NOISE_SIZE },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: this.noiseTexture },
      this.noiseData,
      { bytesPerRow: NOISE_SIZE * 4 },
      { width: NOISE_SIZE, height: NOISE_SIZE },
    );
    this.noiseView = this.noiseTexture.createView({
      label: 'SSAONoiseView',
      dimension: '2d',
    });

    this.outputSampler = this.device.createSampler({
      label: 'SSAOOutputSampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.depthSampler = this.device.createSampler({
      label: 'SSAODepthSampler',
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    this.linearSampler = this.device.createSampler({
      label: 'SSAOLinearSampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat',
    });

    this.fallbackView = createWhiteTexture(this.device);
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.outputTexture && this.width === w && this.height === h) {
      return false;
    }
    this.width = w;
    this.height = h;
    if (this.outputTexture) {
      this.outputTexture.destroy();
    }
    this.outputTexture = this.device.createTexture({
      label: 'SSAOTexture',
      size: { width: this.width, height: this.height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.outputView = this.outputTexture.createView();
    this.bindGroupDirty = true;
    return true;
  }

  getResources() {
    if (!PostFXSettings.ssao || !this.outputView) {
      return { view: this.fallbackView, sampler: this.outputSampler };
    }
    return { view: this.outputView, sampler: this.outputSampler };
  }

  _updateUniforms() {
    const aspect = this.height > 0 ? this.width / this.height : 1;
    const activeCamera = getActiveCamera();

    let projection;
    let view;

    if (activeCamera) {
      activeCamera.setAspect(aspect);
      projection = activeCamera.getProjectionMatrix();
      view = activeCamera.getViewMatrix();
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
      projection = perspective(fallback.fov, aspect, fallback.near, fallback.far);
    }

    const viewProj = mat4Multiply(projection, view);
    const invProj = mat4Invert(projection);

    this.uniformArray.set(viewProj, 0);
    this.uniformArray.set(invProj, MATRIX_FLOATS);

    const radius = Math.max(0.05, Number(PostFXSettings.ssaoRadius) || 0.5);
    const bias = 0.025;
    const intensity = Math.max(0.1, Number(PostFXSettings.ssaoIntensity) || 1.0);
    const sampleCount = PostFXSettings.ssaoHighQuality ? KERNEL_SIZE : KERNEL_SIZE / 2;
    const paramsOffset = MATRIX_FLOATS * 2;
    this.uniformArray[paramsOffset + 0] = radius;
    this.uniformArray[paramsOffset + 1] = bias;
    this.uniformArray[paramsOffset + 2] = intensity;
    this.uniformArray[paramsOffset + 3] = sampleCount;

    const noiseScaleOffset = paramsOffset + 4;
    this.uniformArray[noiseScaleOffset + 0] = this.width / NOISE_SIZE;
    this.uniformArray[noiseScaleOffset + 1] = this.height / NOISE_SIZE;
    this.uniformArray[noiseScaleOffset + 2] = 0;
    this.uniformArray[noiseScaleOffset + 3] = 0;

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformArray.buffer,
      this.uniformArray.byteOffset,
      this.uniformArray.byteLength,
    );
  }

  _ensureBindGroup(depthView, normalView) {
    if (!this.pipeline || !depthView || !normalView || !this.outputView) {
      return;
    }

    if (this.lastDepthView !== depthView || this.lastNormalView !== normalView) {
      this.bindGroupDirty = true;
    }

    if (!this.bindGroup || this.bindGroupDirty) {
      const layout = this.pipeline.getBindGroupLayout(0);
      this.bindGroup = this.device.createBindGroup({
        label: 'SSAOBindGroup',
        layout,
        entries: [
          { binding: 0, resource: depthView },
          { binding: 1, resource: normalView },
          { binding: 2, resource: this.noiseView },
          { binding: 3, resource: this.depthSampler },
          { binding: 4, resource: this.linearSampler },
          { binding: 5, resource: { buffer: this.uniformBuffer } },
          { binding: 6, resource: { buffer: this.kernelBuffer } },
        ],
      });
      this.bindGroupDirty = false;
      this.lastDepthView = depthView;
      this.lastNormalView = normalView;
    }
  }

  execute(encoder) {
    if (!this.pipeline || !this.depthNormalPass) {
      return;
    }

    const depthView = this.depthNormalPass.getDepthView();
    const normalView = this.depthNormalPass.getNormalView();
    if (!depthView || !normalView) {
      return;
    }

    if (!PostFXSettings.ssao) {
      return;
    }

    this._updateUniforms();
    this._ensureBindGroup(depthView, normalView);
    if (!this.bindGroup) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.outputView,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }
}
