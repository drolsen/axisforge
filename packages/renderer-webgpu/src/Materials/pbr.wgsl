const PI : f32 = 3.141592653589793;

struct PBRParams {
  baseColor : vec4<f32>;
  metallic : f32;
  roughness : f32;
  emissive : vec3<f32>;
};

fn D_GGX(NdotH: f32, roughness: f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / (PI * denom * denom);
}

fn G_SchlickGGX(NdotV: f32, k: f32) -> f32 {
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn G_Smith(NdotV: f32, NdotL: f32, roughness: f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  let g1 = G_SchlickGGX(NdotV, k);
  let g2 = G_SchlickGGX(NdotL, k);
  return g1 * g2;
}

fn F_Schlick(VdotH: f32, F0: vec3<f32>) -> vec3<f32> {
  return F0 + (1.0 - F0) * pow(1.0 - VdotH, 5.0);
}

