export const FXAA_SHADER = /* wgsl */`
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

@group(0) @binding(0) var colorTexture : texture_2d<f32>;
@group(0) @binding(1) var colorSampler : sampler;

struct Settings {
  data : vec4f
};

@group(0) @binding(2) var<uniform> settings : Settings;

fn luminance(color : vec3f) -> f32 {
  return dot(color, vec3f(0.299, 0.587, 0.114));
}

@fragment
fn fs(@location(0) uv : vec2f) -> @location(0) vec4f {
  let texel = settings.data.xy;
  let enabled = settings.data.z;
  let center = textureSampleLevel(colorTexture, colorSampler, uv, 0.0);
  if (enabled < 0.5) {
    return center;
  }

  let nw = textureSampleLevel(colorTexture, colorSampler, uv + texel * vec2f(-1.0, -1.0), 0.0);
  let ne = textureSampleLevel(colorTexture, colorSampler, uv + texel * vec2f(1.0, -1.0), 0.0);
  let sw = textureSampleLevel(colorTexture, colorSampler, uv + texel * vec2f(-1.0, 1.0), 0.0);
  let se = textureSampleLevel(colorTexture, colorSampler, uv + texel * vec2f(1.0, 1.0), 0.0);

  let lumaNW = luminance(nw.rgb);
  let lumaNE = luminance(ne.rgb);
  let lumaSW = luminance(sw.rgb);
  let lumaSE = luminance(se.rgb);
  let lumaM = luminance(center.rgb);

  let lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  let lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  var dir = vec2f(
    -((lumaNW + lumaNE) - (lumaSW + lumaSE)),
    ((lumaNW + lumaSW) - (lumaNE + lumaSE))
  );

  let dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * 0.5), 1.0 / 128.0);
  let rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin * 1.5, vec2f(-8.0), vec2f(8.0));
  dir = dir * texel;

  let rgbA = 0.5 * (
    textureSampleLevel(colorTexture, colorSampler, uv + dir * (1.0 / 3.0 - 0.5), 0.0).rgb +
    textureSampleLevel(colorTexture, colorSampler, uv + dir * (2.0 / 3.0 - 0.5), 0.0).rgb
  );
  let rgbB = rgbA * 0.5 + 0.25 * (
    textureSampleLevel(colorTexture, colorSampler, uv + dir * -0.5, 0.0).rgb +
    textureSampleLevel(colorTexture, colorSampler, uv + dir * 0.5, 0.0).rgb
  );
  let lumaB = luminance(rgbB);
  var result = rgbB;
  if (lumaB < lumaMin || lumaB > lumaMax) {
    result = rgbA;
  }
  return vec4f(result, center.a);
}`;
