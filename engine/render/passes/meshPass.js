import { recordDrawCall } from '../framegraph/stats.js';

export default class MeshPass {
  constructor(device, format, getView) {
    this.device = device;
    this.format = format;
    this.getView = getView;
    this.pipeline = null;
    this.vertexBuffer = null;
  }

  async init() {
    const shader = /* wgsl */`
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) color : vec3f
};

@vertex
fn vs(@location(0) position : vec3f) -> VertexOutput {
  var out : VertexOutput;
  out.position = vec4f(position, 1.0);
  out.color = vec3f(1.0, 0.0, 0.0);
  return out;
}

@fragment
fn fs(@location(0) color : vec3f) -> @location(0) vec4f {
  return vec4f(color, 1.0);
}`;

    const module = this.device.createShaderModule({ code: shader });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [
          {
            arrayStride: 3 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x3' }
            ]
          }
        ]
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list' }
    });

    const vertices = new Float32Array([
      -0.5, -0.5, 0.0,
       0.5, -0.5, 0.0,
       0.0,  0.5, 0.0
    ]);

    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();
  }

  execute(encoder) {
    const view = this.getView ? this.getView() : null;
    if (!view) {
      return;
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          loadOp: 'load',
          storeOp: 'store'
        }
      ]
    });
    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.draw(3, 1, 0, 0);
    recordDrawCall(this.constructor.name);
    pass.end();
  }
}

