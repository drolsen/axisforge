// GPU mipmap generation utility with CPU fallback
// Interface: MipGen.generate(device, texture) -> mip chain

export const mipGenWGSL = `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dstSize = textureDimensions(dstTex);
  if (gid.x >= dstSize.x || gid.y >= dstSize.y) { return; }
  let srcCoord = vec2<i32>(gid.xy) * 2;
  var color = vec4<f32>(0.0);
  for (var y: i32 = 0; y < 2; y = y + 1) {
    for (var x: i32 = 0; x < 2; x = x + 1) {
      color = color + textureLoad(srcTex, srcCoord + vec2<i32>(x, y), 0);
    }
  }
  textureStore(dstTex, vec2<i32>(gid.xy), color / 4.0);
}`;

function generateCPU(texture, levels) {
  const mips = [texture.data];
  let width = texture.width;
  let height = texture.height;
  let prev = texture.data;
  for (let level = 1; level < levels; level++) {
    const w = Math.max(1, width >> 1);
    const h = Math.max(1, height >> 1);
    const dst = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const baseX = x * 2;
        const baseY = y * 2;
        let r = 0, g = 0, b = 0, a = 0;
        for (let oy = 0; oy < 2; oy++) {
          for (let ox = 0; ox < 2; ox++) {
            const srcIdx = ((baseY + oy) * width + (baseX + ox)) * 4;
            r += prev[srcIdx];
            g += prev[srcIdx + 1];
            b += prev[srcIdx + 2];
            a += prev[srcIdx + 3];
          }
        }
        dst[idx] = r / 4;
        dst[idx + 1] = g / 4;
        dst[idx + 2] = b / 4;
        dst[idx + 3] = a / 4;
      }
    }
    mips.push(dst);
    prev = dst;
    width = w;
    height = h;
  }
  return mips;
}

export function generate(device, texture) {
  const levels = Math.floor(Math.log2(Math.max(texture.width, texture.height))) + 1;
  if (!device) {
    return generateCPU(texture, levels);
  }
  const module = device.createShaderModule({ code: mipGenWGSL });
  const pipeline = device.createComputePipeline({
    compute: { module, entryPoint: 'main' },
  });
  const encoder = device.createCommandEncoder();
  for (let level = 1; level < levels; level++) {
    const srcView = texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 });
    const dstView = texture.createView({ baseMipLevel: level, mipLevelCount: 1 });
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: srcView },
        { binding: 1, resource: dstView },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    const w = Math.max(1, Math.ceil(texture.width / Math.pow(2, level) / 8));
    const h = Math.max(1, Math.ceil(texture.height / Math.pow(2, level) / 8));
    pass.dispatchWorkgroups(w, h);
    pass.end();
  }
  device.queue.submit([encoder.finish()]);
  return texture;
}

export default { generate };
