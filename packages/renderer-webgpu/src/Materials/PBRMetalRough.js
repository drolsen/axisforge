import shaderLib from './pbr.wgsl.js';

export default class PBRMetalRough {
  constructor(device, material = {}) {
    this.device = device;
    this.material = material;
    this.sampler = device.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'repeat',
      addressModeV: 'repeat'
    });
    this.textures = {
      baseColor: null,
      metallicRoughness: null,
      normal: null,
      occlusion: null,
      emissive: null
    };
  }

  setGLTFTextures(gltfMaterial) {
    const mr = gltfMaterial.pbrMetallicRoughness || {};
    if (mr.baseColorTexture) this.textures.baseColor = mr.baseColorTexture;
    if (mr.metallicRoughnessTexture) this.textures.metallicRoughness = mr.metallicRoughnessTexture;
    if (gltfMaterial.normalTexture) this.textures.normal = gltfMaterial.normalTexture;
    if (gltfMaterial.occlusionTexture) this.textures.occlusion = gltfMaterial.occlusionTexture;
    if (gltfMaterial.emissiveTexture) this.textures.emissive = gltfMaterial.emissiveTexture;
  }

  createPipeline(format = 'bgra8unorm') {
    const names = ['baseColor', 'metallicRoughness', 'normal', 'occlusion', 'emissive'];
    this.bindGroupLayout = this.device.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        ...names.map((_, i) => ({ binding: i + 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }))
      ]
    });

    const module = this.device.device.createShaderModule({ code: this.shader() });
    this.pipeline = this.device.device.createRenderPipeline({
      layout: this.device.device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] }),
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format }] }
    });

    const empty = this._createEmptyTexture().createView();
    const entries = [{ binding: 0, resource: this.sampler }];
    names.forEach((n, i) => {
      const tex = this.textures[n] ? this.textures[n].createView() : empty;
      entries.push({ binding: i + 1, resource: tex });
    });
    this.bindGroup = this.device.device.createBindGroup({ layout: this.bindGroupLayout, entries });
  }

  shader() {
    return /* wgsl */ `
${shaderLib}
struct VSOut {
  @builtin(position) Position : vec4<f32>,
  @location(0) vUV : vec2<f32>
};

@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var baseColorTex : texture_2d<f32>;
@group(0) @binding(2) var metallicRoughnessTex : texture_2d<f32>;
@group(0) @binding(3) var normalTex : texture_2d<f32>;
@group(0) @binding(4) var occlusionTex : texture_2d<f32>;
@group(0) @binding(5) var emissiveTex : texture_2d<f32>;

@vertex
fn vs_main(@location(0) pos : vec3<f32>, @location(1) uv : vec2<f32>) -> VSOut {
  var out : VSOut;
  out.Position = vec4<f32>(pos, 1.0);
  out.vUV = uv;
  return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  let base = textureSample(baseColorTex, samp, in.vUV).rgb;
  let color = linearToSrgb(base);
  return vec4<f32>(color, 1.0);
}
`;
  }

  _createEmptyTexture() {
    if (!this.emptyTex) {
      this.emptyTex = this.device.device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
    }
    return this.emptyTex;
  }
}
