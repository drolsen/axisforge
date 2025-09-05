export default /* wgsl */ `
const PI = 3.14159265359;

fn saturate(v : f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}

fn srgbToLinear(c : vec3<f32>) -> vec3<f32> {
  let lo = c / 12.92;
  let hi = pow((c + 0.055) / 1.055, vec3<f32>(2.4));
  return select(lo, hi, c > vec3<f32>(0.04045));
}

fn linearToSrgb(c : vec3<f32>) -> vec3<f32> {
  let lo = c * 12.92;
  let hi = 1.055 * pow(c, vec3<f32>(1.0 / 2.4)) - 0.055;
  return select(lo, hi, c > vec3<f32>(0.0031308));
}

fn tonemapACES(color : vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return saturate((color * (a * color + vec3<f32>(b))) / (color * (c * color + vec3<f32>(d)) + vec3<f32>(e)));
}

fn D_GGX(NdotH : f32, a : f32) -> f32 {
  let a2 = a * a;
  let f = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / (PI * f * f);
}

fn V_SmithGGXCorrelated(NdotV : f32, NdotL : f32, a : f32) -> f32 {
  let a2 = a * a;
  let GGXV = NdotL * sqrt(NdotV * (NdotV - NdotV * a2) + a2);
  let GGXL = NdotV * sqrt(NdotL * (NdotL - NdotL * a2) + a2);
  return 0.5 / (GGXV + GGXL);
}

fn F_Schlick(F0 : vec3<f32>, u : f32) -> vec3<f32> {
  return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - u, 5.0);
}

fn diffuseIBL(env : texture_cube<f32>, samp : sampler, diffuseColor : vec3<f32>, N : vec3<f32>) -> vec3<f32> {
  return diffuseColor * textureSample(env, samp, N).rgb;
}

fn specularIBL(env : texture_cube<f32>, samp : sampler, brdfLUT : texture_2d<f32>, specColor : vec3<f32>, roughness : f32, N : vec3<f32>, V : vec3<f32>) -> vec3<f32> {
  let NdotV = max(dot(N, V), 0.0);
  let prefiltered = textureSampleLevel(env, samp, N, roughness * 8.0).rgb;
  let brdf = textureSample(brdfLUT, samp, vec2<f32>(NdotV, roughness)).rgb;
  return prefiltered * (specColor * brdf.x + brdf.y);
}
`;
