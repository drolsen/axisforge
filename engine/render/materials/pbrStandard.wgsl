const MAX_CASCADES : u32 = 4u;

struct SceneUniform {
  viewProj : mat4x4<f32>,
  view : mat4x4<f32>,
  cameraPos : vec4<f32>,
  sunDirection : vec4<f32>,
  sunColor : vec4<f32>,
  ambientColor : vec4<f32>,
  cascades : array<mat4x4<f32>, 4>,
  cascadeSplits : vec4<f32>,
  shadowParams : vec4<f32>,
};

struct MaterialUniform {
  baseColorFactor : vec4<f32>,
  emissiveOcclusion : vec4<f32>,
  params : vec4<f32>,
};

struct InstanceUniform {
  model : mat4x4<f32>,
  normal : mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> scene : SceneUniform;
@group(0) @binding(1) var shadowMap : texture_depth_2d_array;
@group(0) @binding(2) var shadowSampler : sampler_comparison;
@group(0) @binding(3) var ssaoTexture : texture_2d<f32>;
@group(0) @binding(4) var ssaoSampler : sampler;

@group(1) @binding(0) var<uniform> material : MaterialUniform;
@group(1) @binding(1) var baseColorTexture : texture_2d<f32>;
@group(1) @binding(2) var baseColorSampler : sampler;
@group(1) @binding(3) var metallicRoughnessTexture : texture_2d<f32>;
@group(1) @binding(4) var metallicRoughnessSampler : sampler;
@group(1) @binding(5) var normalTexture : texture_2d<f32>;
@group(1) @binding(6) var normalSampler : sampler;
@group(1) @binding(7) var occlusionTexture : texture_2d<f32>;
@group(1) @binding(8) var occlusionSampler : sampler;
@group(1) @binding(9) var emissiveTexture : texture_2d<f32>;
@group(1) @binding(10) var emissiveSampler : sampler;

@group(2) @binding(0) var<uniform> instanceUniform : InstanceUniform;

struct VertexInput {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) tangent : vec4<f32>,
  @location(3) uv : vec2<f32>,
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) worldPos : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
  @location(3) tangent : vec3<f32>,
  @location(4) bitangent : vec3<f32>,
  @location(5) screenUV : vec2<f32>,
};

@vertex
fn vs(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let world = instanceUniform.model * vec4<f32>(input.position, 1.0);
  let clip = scene.viewProj * world;
  output.position = clip;
  output.worldPos = world.xyz;
  let normalWorld = normalize((instanceUniform.normal * vec4<f32>(input.normal, 0.0)).xyz);
  var tangentWorld = (instanceUniform.normal * vec4<f32>(input.tangent.xyz, 0.0)).xyz;
  tangentWorld = normalize(tangentWorld - normalWorld * dot(normalWorld, tangentWorld));
  let bitangentWorld = normalize(cross(normalWorld, tangentWorld)) * input.tangent.w;
  output.normal = normalWorld;
  output.tangent = tangentWorld;
  output.bitangent = bitangentWorld;
  output.uv = input.uv;
  let w = max(abs(clip.w), 1e-5);
  let ndc = clip.xy / w;
  output.screenUV = ndc * 0.5 + vec2<f32>(0.5);
  return output;
}

@fragment
fn fresnelSchlick(cosTheta : f32, F0 : vec3<f32>) -> vec3<f32> {
  let ct = clamp(cosTheta, 0.0, 1.0);
  return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - ct, 5.0);
}

fn distributionGGX(NdotH : f32, roughness : f32) -> f32 {
  let a = roughness * roughness;
  let a2 = a * a;
  let denom = max((NdotH * NdotH) * (a2 - 1.0) + 1.0, 1e-4);
  return a2 / (3.14159265359 * denom * denom);
}

fn geometrySchlickGGX(NdotV : f32, roughness : f32) -> f32 {
  let r = roughness + 1.0;
  let k = (r * r) / 8.0;
  return NdotV / (NdotV * (1.0 - k) + k);
}

fn geometrySmith(NdotV : f32, NdotL : f32, roughness : f32) -> f32 {
  let ggxV = geometrySchlickGGX(NdotV, roughness);
  let ggxL = geometrySchlickGGX(NdotL, roughness);
  return ggxV * ggxL;
}

fn applyNormalMap(normal : vec3<f32>, tangent : vec3<f32>, bitangent : vec3<f32>, uv : vec2<f32>) -> vec3<f32> {
  let sampled = textureSample(normalTexture, normalSampler, uv).xyz * 2.0 - vec3<f32>(1.0);
  let t = normalize(tangent);
  let b = normalize(bitangent);
  let n = normalize(normal);
  let tbn = mat3x3<f32>(t, b, n);
  return normalize(tbn * sampled);
}

fn selectCascade(viewDepth : f32, cascadeCount : u32) -> u32 {
  if (cascadeCount == 0u) {
    return 0u;
  }
  var index : u32 = 0u;
  if (cascadeCount > 1u && viewDepth > scene.cascadeSplits.x) {
    index = 1u;
  }
  if (cascadeCount > 2u && viewDepth > scene.cascadeSplits.y) {
    index = 2u;
  }
  if (cascadeCount > 3u && viewDepth > scene.cascadeSplits.z) {
    index = 3u;
  }
  return min(index, cascadeCount - 1u);
}

fn computeShadowFactor(worldPos : vec3<f32>, normal : vec3<f32>, lightDir : vec3<f32>) -> f32 {
  let params = scene.shadowParams;
  let cascadeCount = u32(max(params.x, 0.0));
  if (cascadeCount == 0u) {
    return 1.0;
  }

  let viewPosition = scene.view * vec4<f32>(worldPos, 1.0);
  let viewDepth = -viewPosition.z;
  let cascadeIndex = selectCascade(viewDepth, min(cascadeCount, MAX_CASCADES));
  let lightMatrix = scene.cascades[cascadeIndex];

  let ndotl = max(dot(normal, lightDir), 0.0);
  let baseBias = params.z;
  let slopeBias = baseBias * (1.0 - ndotl);
  let normalOffset = params.w * (1.0 - ndotl);

  let offsetWorld = worldPos + normal * normalOffset;
  let lightSpace = lightMatrix * vec4<f32>(offsetWorld, 1.0);
  let projected = lightSpace.xyz / lightSpace.w;
  let uv = projected.xy * 0.5 + vec2<f32>(0.5);

  if (!shadowInsideFrustum(uv, projected.z)) {
    return 1.0;
  }

  let compareDepth = clamp(projected.z - (baseBias + slopeBias), 0.0, 1.0);
  let coords = vec3<f32>(uv, f32(cascadeIndex));
  let visibility = sampleShadow3x3(shadowMap, shadowSampler, coords, compareDepth);
  return clamp(visibility, 0.0, 1.0);
}

@fragment
fn fs(input : VertexOutput) -> @location(0) vec4<f32> {
  let viewVector = scene.cameraPos.xyz - input.worldPos;
  let viewLength = length(viewVector);
  let V = undefined;
  if (viewLength > 1e-5) {
    V = viewVector / viewLength;
  } else { 
    V = vec3<f32>(0.0, 0.0, 1.0); 
  }

  let baseSample = textureSample(baseColorTexture, baseColorSampler, input.uv);
  let baseColorSample = baseSample * material.baseColorFactor;
  let baseColor = baseColorSample.rgb;
  let alpha = baseColorSample.a;

  let mrSample = textureSample(metallicRoughnessTexture, metallicRoughnessSampler, input.uv);
  let roughnessFactor = clamp(material.params.x, 0.045, 1.0);
  let metallicFactor = clamp(material.params.y, 0.0, 1.0);
  let roughness = clamp(mrSample.g * roughnessFactor, 0.045, 1.0);
  let metallic = clamp(mrSample.b * metallicFactor, 0.0, 1.0);

  let aoSample = textureSample(occlusionTexture, occlusionSampler, input.uv).r;
  let aoStrength = clamp(material.emissiveOcclusion.w, 0.0, 1.0);
  let ao = mix(1.0, aoSample, aoStrength);

  let emissiveSample = textureSample(emissiveTexture, emissiveSampler, input.uv).rgb;
  let emissive = emissiveSample * material.emissiveOcclusion.rgb;

  let uvScreen = clamp(input.screenUV, vec2<f32>(0.0), vec2<f32>(0.9999));
  let ssaoValue = textureSample(ssaoTexture, ssaoSampler, uvScreen).r;
  let combinedAO = clamp(ao * ssaoValue, 0.0, 1.0);

  let N = applyNormalMap(input.normal, input.tangent, input.bitangent, input.uv);
  let lightVector = -scene.sunDirection.xyz;
  let lightLength = length(lightVector);
  let L = undefined;
  if (lightLength > 1e-5) { 
    L = lightVector / lightLength;
  } else { 
    L = vec3<f32>(0.0, 1.0, 0.0);
  }

  let halfVector = V + L;
  let halfLength = length(halfVector);
  let H = undefined;
  if (halfLength > 1e-5) {
    H = halfVector / halfLength;
  } else {
    H = N;
  }

  let NdotL = max(dot(N, L), 0.0);
  let NdotV = max(dot(N, V), 0.0);
  let NdotH = max(dot(N, H), 0.0);
  let VdotH = max(dot(V, H), 0.0);

  let F0 = mix(vec3<f32>(0.04), baseColor, metallic);
  let F = fresnelSchlick(VdotH, F0);
  let D = distributionGGX(NdotH, roughness);
  let G = geometrySmith(NdotV, NdotL, roughness);

  let numerator = F * (D * G);
  let denominator = max(4.0 * NdotV * NdotL, 1e-4);
  let specular = numerator / denominator;

  let ks = F;
  let kd = (vec3<f32>(1.0) - ks) * (1.0 - metallic);
  let diffuse = kd * baseColor / 3.14159265359;

  let sunColor = scene.sunColor.rgb * scene.sunColor.w;
  let radiance = sunColor;
  let shadowFactor = computeShadowFactor(input.worldPos, N, L);
  let Lo = (diffuse + specular) * radiance * NdotL * shadowFactor * combinedAO;

  let ambientLight = scene.ambientColor.rgb * scene.ambientColor.w;
  let ambient = ambientLight * baseColor * combinedAO;

  let color = ambient + Lo + emissive;
  return vec4<f32>(color, alpha);
}
