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


fn shadowFactorVSM(moment: vec2<f32>, depth: f32) -> f32 {
  let mean = moment.x;
  let meanSq = moment.y;
  if (depth <= mean) {
    return 1.0;
  }
  let variance = max(meanSq - mean * mean, 0.00002);
  let d = depth - mean;
  let pMax = variance / (variance + d * d);
  return clamp(pMax, 0.0, 1.0);
}

struct DirectionalLight {
  direction : vec3<f32>;
  color : vec3<f32>;
};

fn pbrDirectional(
  params : PBRParams,
  N : vec3<f32>,
  V : vec3<f32>,
  light : DirectionalLight,
  moment : vec2<f32>,
  depth : f32,
) -> vec3<f32> {
  let L = normalize(-light.direction);
  let H = normalize(V + L);
  let NdotL = max(dot(N, L), 0.0);
  let NdotV = max(dot(N, V), 0.0);
  let VdotH = max(dot(V, H), 0.0);
  let NdotH = max(dot(N, H), 0.0);

  let F0 = mix(vec3<f32>(0.04, 0.04, 0.04), params.baseColor.rgb, vec3<f32>(params.metallic));
  let F = F_Schlick(VdotH, F0);
  let D = D_GGX(NdotH, params.roughness);
  let G = G_Smith(NdotV, NdotL, params.roughness);
  let spec = (D * G * F) / max(4.0 * NdotL * NdotV, 0.0001);
  let kd = (vec3<f32>(1.0, 1.0, 1.0) - F) * (1.0 - params.metallic);
  let diffuse = kd * params.baseColor.rgb / PI;
  let shadow = shadowFactorVSM(moment, depth);
  return (diffuse + spec) * light.color * NdotL * shadow + params.emissive;
}

