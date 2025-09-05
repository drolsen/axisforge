import { createDevice } from '../../packages/renderer-webgpu/src/Device.js';

async function main() {
  const canvas = document.getElementById('gfx');
  const { device, context, format, resize } = await createDevice(canvas);
  resize(256, 256);

  const shader = device.createShaderModule({
    code: `
@vertex
fn vs_main(@builtin(vertex_index) idx : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(
    vec2f(0.0, 0.5),
    vec2f(-0.5, -0.5),
    vec2f(0.5, -0.5),
  );
  return vec4f(pos[idx], 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
`,
  });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module: shader, entryPoint: 'vs_main' },
    fragment: { module: shader, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });
  pass.setPipeline(pipeline);
  pass.draw(3, 1, 0, 0);
  pass.end();
  device.queue.submit([encoder.finish()]);
}

main();
