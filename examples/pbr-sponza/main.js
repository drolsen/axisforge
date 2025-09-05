import Device from '../../packages/renderer-webgpu/src/Device.js';
import ClusterBuilder from '../../packages/renderer-webgpu/src/Lighting/ClusterBuilder.js';

async function main() {
  const canvas = document.getElementById('gfx');
  const device = new Device(canvas);
  await device.init();

  const builder = new ClusterBuilder({ tileSize: 64, zSlices: 16 });
  builder.update({
    width: canvas.width,
    height: canvas.height,
    near: 0.1,
    far: 100,
    fov: Math.PI / 2,
    aspect: canvas.width / canvas.height
  });

  const lights = [];
  const count = 64;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    lights.push({
      position: [Math.cos(angle) * 5, 1, Math.sin(angle) * 5 - 10],
      radius: 1
    });
  }

  function frame(time) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + time * 0.001;
      const l = lights[i];
      l.position[0] = Math.cos(angle) * 5;
      l.position[2] = Math.sin(angle) * 5 - 10;
    }
    builder.build(lights);

    const encoder = device.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: device.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.end();
    device.device.queue.submit([encoder.finish()]);
    window.__rendered = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
