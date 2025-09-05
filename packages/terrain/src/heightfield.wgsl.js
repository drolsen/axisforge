export default /* wgsl */`
struct Uniforms { mvp: mat4x4<f32>; };
@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var heightTex : texture_2d<f32>;
@group(0) @binding(2) var heightSampler : sampler;

fn heightSample(uv : vec2<f32>) -> f32 {
  return textureSample(heightTex, heightSampler, uv).r;
}

struct VSIn {
  @location(0) position : vec2<f32>;
  @location(1) uv : vec2<f32>;
  @location(2) skirt : f32;
};

struct VSOut {
  @builtin(position) position : vec4<f32>;
  @location(0) uv : vec2<f32>;
  @location(1) worldPos : vec3<f32>;
};

@vertex
fn vs_main(in : VSIn) -> VSOut {
  var out : VSOut;
  let h = heightSample(in.uv) - in.skirt;
  let world = vec3<f32>(in.position.x, h, in.position.y);
  out.worldPos = world;
  out.uv = in.uv;
  out.position = uniforms.mvp * vec4<f32>(world, 1.0);
  return out;
}

@fragment
fn fs_main(in : VSOut) -> @location(0) vec4<f32> {
  let eps = vec2<f32>(1.0/512.0, 0.0);
  let hL = heightSample(in.uv - eps.xy);
  let hR = heightSample(in.uv + eps.xy);
  let hD = heightSample(in.uv - eps.yx);
  let hU = heightSample(in.uv + eps.yx);
  let normal = normalize(vec3<f32>(hL - hR, 2.0, hD - hU));
  let lightDir = normalize(vec3<f32>(0.4, 1.0, 0.3));
  let diff = max(dot(normal, lightDir), 0.0);
  let albedo = vec3<f32>(0.5, 0.6, 0.3);
  return vec4<f32>(albedo * diff, 1.0);
}`;
