import Device from '../../packages/renderer-webgpu/src/Device.js';

async function main() {
  const canvas = document.getElementById('gfx');
  const device = new Device(canvas);
  await device.init();

  const shader = device.device.createShaderModule({
    code: `@vertex
      fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>,3>(
          vec2<f32>(0.0, 0.5),
          vec2<f32>(-0.5, -0.5),
          vec2<f32>(0.5, -0.5)
        );
        return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
      }
      @fragment
      fn fs_main() -> @location(0) vec4<f32> {
        return vec4<f32>(1.0, 0.0, 0.0, 1.0);
      }`
  });

  const pipeline = device.device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'vs_main'
    },
    fragment: {
      module: shader,
      entryPoint: 'fs_main',
      targets: [{ format: device.format }]
    },
    primitive: { topology: 'triangle-list' }
  });

  const encoder = device.device.createCommandEncoder();
  const view = device.context.getCurrentTexture().createView();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view,
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'clear',
      storeOp: 'store'
    }]
  });
  pass.setPipeline(pipeline);
  pass.draw(3);
  pass.end();

  device.device.queue.submit([encoder.finish()]);
  window.__rendered = true;
}

main();
