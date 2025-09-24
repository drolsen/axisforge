const KERNEL_SIZE : u32 = 32u;

struct SSAOUniforms {
  proj : mat4x4<f32>;
  invProj : mat4x4<f32>;
  params : vec4<f32>; // radius, bias, intensity, sample count
  noiseScale : vec4<f32>;
};

struct SSAOKernel {
  samples : array<vec4<f32>, KERNEL_SIZE>;
};

struct VertexOutput {
  @builtin(position) position : vec4<f32>;
  @location(0) uv : vec2<f32>;
};

@group(0) @binding(0) var depthTex : texture_depth_2d;
@group(0) @binding(1) var normalTex : texture_2d<f32>;
@group(0) @binding(2) var noiseTex : texture_2d<f32>;
@group(0) @binding(3) var depthSampler : sampler;
@group(0) @binding(4) var linearSampler : sampler;
@group(0) @binding(5) var<uniform> uniforms : SSAOUniforms;
@group(0) @binding(6) var<uniform> kernel : SSAOKernel;

@vertex
fn vs(@builtin(vertex_index) index : u32) -> VertexOutput {
  const positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(3.0, 1.0),
    vec2<f32>(-1.0, 1.0)
  );
  let pos = positions[index];
  var output : VertexOutput;
  output.position = vec4<f32>(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + vec2<f32>(0.5);
  return output;
}

fn reconstructViewPosition(uv : vec2<f32>, depth : f32) -> vec3<f32> {
  let ndc = vec4<f32>(uv * 2.0 - vec2<f32>(1.0), depth * 2.0 - 1.0, 1.0);
  let view = uniforms.invProj * ndc;
  return view.xyz / view.w;
}

fn orthonormalTangent(normal : vec3<f32>, seed : vec3<f32>) -> vec3<f32> {
  var t = seed - normal * dot(seed, normal);
  if (length(t) < 1e-4) {
    t = vec3<f32>(0.0, 1.0, 0.0) - normal * dot(vec3<f32>(0.0, 1.0, 0.0), normal);
    if (length(t) < 1e-4) {
      t = vec3<f32>(1.0, 0.0, 0.0) - normal * dot(vec3<f32>(1.0, 0.0, 0.0), normal);
    }
  }
  return normalize(t);
}

@fragment
fn fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  let depth = textureSampleLevel(depthTex, depthSampler, uv, 0.0);
  if (depth >= 0.9999) {
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
  }

  let encodedNormal = textureSample(normalTex, linearSampler, uv).xyz;
  var normal = encodedNormal * 2.0 - vec3<f32>(1.0);
  let normalLen = length(normal);
  if (normalLen < 1e-5) {
    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
  }
  normal = normalize(normal);

  let viewPos = reconstructViewPosition(uv, depth);
  let noiseScale = uniforms.noiseScale.xy;
  let noise = textureSample(noiseTex, linearSampler, uv * noiseScale).xyz * 2.0 - vec3<f32>(1.0);
  let tangent = orthonormalTangent(normal, noise);
  let bitangent = normalize(cross(normal, tangent));
  let tbn = mat3x3<f32>(tangent, bitangent, normal);

  let radius = uniforms.params.x;
  let bias = uniforms.params.y;
  let intensity = uniforms.params.z;
  let sampleCount = max(1u, u32(uniforms.params.w));

  var occlusion = 0.0;
  for (var i : u32 = 0u; i < KERNEL_SIZE; i = i + 1u) {
    if (i >= sampleCount) {
      break;
    }
    var sampleVec = tbn * kernel.samples[i].xyz;
    sampleVec = viewPos + sampleVec * radius;

    var offset = uniforms.proj * vec4<f32>(sampleVec, 1.0);
    offset.xyz /= offset.w;
    let sampleUV = offset.xy * 0.5 + vec2<f32>(0.5);
    if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) {
      continue;
    }

    let sampleDepth = textureSampleLevel(depthTex, depthSampler, sampleUV, 0.0);
    let sampleView = reconstructViewPosition(sampleUV, sampleDepth);
    let rangeCheck = smoothstep(0.0, 1.0, radius / (abs(viewPos.z - sampleView.z) + 1e-4));
    if (sampleView.z <= sampleVec.z + bias) {
      occlusion = occlusion + rangeCheck;
    }
  }

  let occlusionFactor = 1.0 - occlusion / f32(sampleCount);
  occlusionFactor = pow(clamp(occlusionFactor, 0.0, 1.0), max(intensity, 0.01));
  return vec4<f32>(occlusionFactor, occlusionFactor, occlusionFactor, 1.0);
}
