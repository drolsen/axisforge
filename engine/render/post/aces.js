export const ACES_SHADER = /* wgsl */`
struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f
};

@vertex
fn vs(@builtin(vertex_index) index : u32) -> VertexOutput {
  var positions = array<vec2f, 3>(
    vec2f(-1.0, -3.0),
    vec2f(-1.0,  1.0),
    vec2f( 3.0,  1.0)
  );
  var uvs = array<vec2f, 3>(
    vec2f(0.0, 2.0),
    vec2f(0.0, 0.0),
    vec2f(2.0, 0.0)
  );
  var out : VertexOutput;
  out.position = vec4f(positions[index], 0.0, 1.0);
  out.uv = uvs[index];
  return out;
}

@group(0) @binding(0) var hdrTexture : texture_2d<f32>;
@group(0) @binding(1) var hdrSampler : sampler;

struct Settings {
  data : vec4f
};

@group(0) @binding(2) var<uniform> settings : Settings;

fn RRTAndODTFit(v : vec3f) -> vec3f {
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(a / b, vec3f(0.0), vec3f(1.0));
}

fn ACESFitted(color : vec3f) -> vec3f {
  let acesInputMat = mat3x3f(
    vec3f(0.59719, 0.35458, 0.04823),
    vec3f(0.07600, 0.90834, 0.01566),
    vec3f(0.02840, 0.13383, 0.83777)
  );
  let acesOutputMat = mat3x3f(
    vec3f( 1.60475, -0.53108, -0.07367),
    vec3f(-0.10208,  1.10813, -0.00605),
    vec3f(-0.00327, -0.07276,  1.07602)
  );
  var rgb = acesInputMat * color;
  rgb = RRTAndODTFit(rgb);
  rgb = acesOutputMat * rgb;
  return clamp(rgb, vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  let hdr = textureSampleLevel(hdrTexture, hdrSampler, uv, 0.0);
  let enabled = settings.data.x;
  let mapped = mix(hdr.rgb, ACESFitted(hdr.rgb), vec3f(enabled));
  return vec4f(mapped, 1.0);
}`;
