import { ACES_SHADER } from '../post/aces.js';
import { PostFXSettings } from '../post/settings.js';
import { recordDrawCall } from '../framegraph/stats.js';

export default class ACESPass {
  constructor(device, hdrTarget, outputFormat = 'rgba16float') {
    this.device = device;
    this.hdrTarget = hdrTarget;
    this.outputFormat = outputFormat;
    this.pipeline = null;
    this.sampler = null;
    this.outputTexture = null;
    this.outputView = null;
    this.bindGroup = null;
    this.bindGroupDirty = true;
    this.uniformBuffer = null;
    this.uniformArray = new Float32Array(4);
    this.width = 0;
    this.height = 0;
  }

  async init() {
    const module = this.device.createShaderModule({ code: ACES_SHADER });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs'
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: this.outputFormat }]
      },
      primitive: { topology: 'triangle-list' }
    });

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });

    this.uniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  resize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.outputTexture && this.width === w && this.height === h) {
      return false;
    }
    if (this.outputTexture) {
      this.outputTexture.destroy();
    }
    this.outputTexture = this.device.createTexture({
      size: { width: w, height: h },
      format: this.outputFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    this.width = w;
    this.height = h;
    this.outputView = this.outputTexture.createView();
    this.bindGroupDirty = true;
    return true;
  }

  getOutputView() {
    return this.outputView;
  }

  _ensureBindGroup() {
    if (!this.pipeline || !this.outputView || !this.hdrTarget.getView()) {
      return;
    }
    if (!this.bindGroup || this.bindGroupDirty) {
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.hdrTarget.getView() },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.uniformBuffer } }
        ]
      });
      this.bindGroupDirty = false;
    }
  }

  execute(encoder) {
    if (!this.pipeline || !this.outputView) {
      return;
    }
    this.uniformArray[0] = PostFXSettings.acesTonemap ? 1 : 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformArray.buffer);
    this._ensureBindGroup();
    if (!this.bindGroup) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.outputView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3, 1, 0, 0);
    recordDrawCall(this.constructor.name);
    pass.end();
  }
}
