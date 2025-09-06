// Simple heightfield shader blending mask colors
@group(0) @binding(0) var maskTex : texture_2d<f32>;
@group(0) @binding(1) var maskSampler : sampler;

@vertex
fn vs_main(@location(0) position : vec3<f32>) -> @builtin(position) vec4<f32> {
  return vec4<f32>(position, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos : vec4<f32>) -> @location(0) vec4<f32> {
  let dims = vec2<f32>(f32(textureDimensions(maskTex).x), f32(textureDimensions(maskTex).y));
  let uv = pos.xy / dims;
  return textureSample(maskTex, maskSampler, uv);
}
