struct SceneUniform {
  viewProj : mat4x4<f32>,
  view : mat4x4<f32>,
  cameraPos : vec4<f32>,
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
};

@vertex
fn vs(input : VertexInput) -> VertexOutput {
  var output : VertexOutput;
  let world = instanceUniform.model * vec4<f32>(input.position, 1.0);
  output.position = scene.viewProj * world;
  output.worldPos = world.xyz;
  output.normal = normalize((instanceUniform.normal * vec4<f32>(input.normal, 0.0)).xyz);
  output.uv = input.uv;
  return output;
}

@fragment
fn fs(input : VertexOutput) -> @location(0) vec4<f32> {
  let sampledColor = textureSample(baseColorTexture, baseColorSampler, input.uv);
  let baseColor = sampledColor * material.baseColorFactor;
  return vec4<f32>(baseColor.rgb, baseColor.a);
}
