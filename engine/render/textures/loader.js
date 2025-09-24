const MIPMAP_PIPELINE_CACHE = new WeakMap();
const MIPMAP_SAMPLER_CACHE = new WeakMap();

function getOrCreateSampler(device) {
  if (MIPMAP_SAMPLER_CACHE.has(device)) {
    return MIPMAP_SAMPLER_CACHE.get(device);
  }
  const sampler = device.createSampler({
    label: 'TextureMipmapSampler',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  });
  MIPMAP_SAMPLER_CACHE.set(device, sampler);
  return sampler;
}

function shaderCode({ srgb }) {
  const linearToSRGB = srgb
    ? `fn linearToSRGB(linear : vec3f) -> vec3f {
  let clamped = clamp(linear, vec3f(0.0), vec3f(1.0));
  let low = clamped * 12.92;
  let high = 1.055 * pow(clamped, vec3f(1.0 / 2.4)) - 0.055;
  return select(low, high, clamped > vec3f(0.0031308));
}`
    : '';

  const convert = srgb
    ? `let srgbColor = vec4f(linearToSRGB(color.rgb), color.a);
  return srgbColor;`
    : 'return color;';

  return `struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -1.0),
    vec2f(-1.0, 3.0),
    vec2f(3.0, -1.0)
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 0.0),
    vec2f(0.0, 2.0),
    vec2f(2.0, 0.0)
  );
  var output : VertexOutput;
  output.position = vec4f(positions[vertexIndex], 0.0, 1.0);
  output.uv = uvs[vertexIndex];
  return output;
}

@group(0) @binding(0) var srcSampler : sampler;
@group(0) @binding(1) var srcTexture : texture_2d<f32>;

${linearToSRGB}

@fragment
fn fs(input : VertexOutput) -> @location(0) vec4f {
  let color = textureSampleLevel(srcTexture, srcSampler, input.uv, 0.0);
  ${convert}
}`;
}

function getPipeline(device, format, { srgb }) {
  let deviceCache = MIPMAP_PIPELINE_CACHE.get(device);
  if (!deviceCache) {
    deviceCache = new Map();
    MIPMAP_PIPELINE_CACHE.set(device, deviceCache);
  }
  const key = `${format}|${srgb ? 'srgb' : 'linear'}`;
  if (deviceCache.has(key)) {
    return deviceCache.get(key);
  }

  const module = device.createShaderModule({
    label: `TextureMipmapShader_${key}`,
    code: shaderCode({ srgb }),
  });
  const bindGroupLayout = device.createBindGroupLayout({
    label: `TextureMipmapBindGroup_${key}`,
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
    ],
  });
  const pipeline = device.createRenderPipeline({
    label: `TextureMipmapPipeline_${key}`,
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });

  const entry = { pipeline, bindGroupLayout };
  deviceCache.set(key, entry);
  return entry;
}

function calculateMipLevelCount(width, height) {
  const maxDimension = Math.max(width, height);
  return Math.max(1, Math.floor(Math.log2(maxDimension)) + 1);
}

function generateMipmaps(device, texture, {
  mipLevelCount,
  format,
  srgb,
}) {
  if (mipLevelCount <= 1) {
    return;
  }

  const { pipeline, bindGroupLayout } = getPipeline(device, format, { srgb });
  const sampler = getOrCreateSampler(device);
  const encoder = device.createCommandEncoder({ label: 'TextureGenerateMipmaps' });

  for (let level = 1; level < mipLevelCount; level += 1) {
    const srcView = texture.createView({
      baseMipLevel: level - 1,
      mipLevelCount: 1,
      dimension: '2d',
      format: srgb ? 'rgba8unorm-srgb' : undefined,
    });
    const dstView = texture.createView({
      baseMipLevel: level,
      mipLevelCount: 1,
    });

    const bindGroup = device.createBindGroup({
      label: `TextureMipmapBindGroupLevel${level}`,
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: srcView },
      ],
    });

    const pass = encoder.beginRenderPass({
      label: `TextureMipmapPassLevel${level}`,
      colorAttachments: [
        {
          view: dstView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();
  }

  device.queue.submit([encoder.finish()]);
}

export function createTextureFromImage(device, image, {
  label = 'Texture',
  srgb = false,
  generateMipmaps: enableMipmaps = true,
  usage: additionalUsage = 0,
} = {}) {
  if (!device) {
    throw new Error('GPU device is required to create a texture');
  }
  if (!image || typeof image.width !== 'number' || typeof image.height !== 'number') {
    throw new Error('Image source must provide width and height');
  }

  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  const mipLevelCount = enableMipmaps ? calculateMipLevelCount(width, height) : 1;
  const baseFormat = 'rgba8unorm';
  const viewFormats = srgb ? ['rgba8unorm-srgb'] : undefined;

  let usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;
  if (mipLevelCount > 1) {
    usage |= GPUTextureUsage.RENDER_ATTACHMENT;
  }
  usage |= additionalUsage;

  const texture = device.createTexture({
    label,
    size: { width, height, depthOrArrayLayers: 1 },
    mipLevelCount,
    format: baseFormat,
    usage,
    dimension: '2d',
    viewFormats,
  });

  device.queue.copyExternalImageToTexture(
    { source: image },
    { texture, mipLevel: 0 },
    { width, height, depthOrArrayLayers: 1 },
  );

  if (mipLevelCount > 1) {
    generateMipmaps(device, texture, {
      mipLevelCount,
      format: baseFormat,
      srgb,
    });
  }

  const view = texture.createView({
    label: `${label}View`,
    format: srgb ? 'rgba8unorm-srgb' : undefined,
    baseMipLevel: 0,
    mipLevelCount,
  });

  return {
    texture,
    view,
    width,
    height,
    mipLevelCount,
    format: baseFormat,
    srgb,
  };
}

export { generateMipmaps, calculateMipLevelCount };
