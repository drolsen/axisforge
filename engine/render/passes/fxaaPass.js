import { FXAA_SHADER } from '../post/fxaa.js';
import { PostFXSettings } from '../post/settings.js';

export default class FXAAPass {
  constructor(device, acesPass, outputFormat) {
    this.device = device;
    this.acesPass = acesPass;
    this.outputFormat = outputFormat;
    this.pipeline = null;
    this.sampler = null;
    this.bindGroup = null;
    this.bindGroupDirty = true;
    this.uniformBuffer = null;
    this.uniformArray = new Float32Array([0, 0, 1, 0]);
    this.width = 0;
    this.height = 0;
  }

  async init() {
    const module = this.device.createShaderModule({ code: FXAA_SHADER });
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
    if (w === this.width && h === this.height) {
      return false;
    }
    this.width = w;
    this.height = h;
    this.uniformArray[0] = 1 / w;
    this.uniformArray[1] = 1 / h;
    this.bindGroupDirty = true;
    return true;
  }

  _ensureBindGroup() {
    const inputView = this.acesPass.getOutputView();
    if (!this.pipeline || !inputView) {
      return;
    }
    if (!this.bindGroup || this.bindGroupDirty) {
      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: inputView },
          { binding: 1, resource: this.sampler },
          { binding: 2, resource: { buffer: this.uniformBuffer } }
        ]
      });
      this.bindGroupDirty = false;
    }
  }

  execute(encoder, context) {
    if (!this.pipeline || !context.swapChainView) {
      return;
    }

    const inputView = this.acesPass.getOutputView();
    if (!inputView) {
      return;
    }

    this.uniformArray[2] = PostFXSettings.fxaa ? 1 : 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformArray.buffer);
    this._ensureBindGroup();
    if (!this.bindGroup) {
      return;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.swapChainView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }
}
