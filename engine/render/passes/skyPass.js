export default class SkyPass {
  constructor(device, format) {
    this.device = device;
    this.format = format;
    this.pipeline = null;
  }

  async init() {
    const shaderCode = /* wgsl */`
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f
};

@vertex
fn vs(@builtin(vertex_index) index : u32) -> VertexOutput {
  const positions = array<vec2f, 4>(
      vec2f(-1.0, -1.0),
      vec2f(-1.0,  1.0),
      vec2f( 1.0, -1.0),
      vec2f( 1.0,  1.0)
  );
  const uvs = array<vec2f, 4>(
      vec2f(0.0, 0.0),
      vec2f(0.0, 1.0),
      vec2f(1.0, 0.0),
      vec2f(1.0, 1.0)
  );
  const indices = array<u32, 6>(0u, 1u, 2u, 2u, 1u, 3u);
  var output : VertexOutput;
  let vidx = indices[index];
  output.position = vec4f(positions[vidx], 0.0, 1.0);
  output.uv = uvs[vidx];
  return output;
}

@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  let top = vec3f(0.5, 0.7, 1.0);
  let bottom = vec3f(1.0, 1.0, 1.0);
  let t = uv.y;
  let color = mix(bottom, top, t);
  return vec4f(color, 1.0);
}`;

    const module = this.device.createShaderModule({ code: shaderCode });
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs'
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  execute(encoder, view) {
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
    pass.draw(6, 1, 0, 0);
    pass.end();
  }
}

