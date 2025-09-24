const SHADOW_TAP_COUNT : f32 = 9.0;

fn sampleShadow3x3(
  shadowMap : texture_depth_2d_array,
  shadowSampler : sampler_comparison,
  coords : vec3<f32>,
  depth : f32
) -> f32 {
  var visibility = 0.0;
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(-1, -1));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(0, -1));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(1, -1));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(-1, 0));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(0, 0));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(1, 0));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(-1, 1));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(0, 1));
  visibility += textureSampleCompare(shadowMap, shadowSampler, coords, depth, vec2<i32>(1, 1));
  return visibility / SHADOW_TAP_COUNT;
}

fn shadowInsideFrustum(uv : vec2<f32>, depth : f32) -> bool {
  return all(uv >= vec2<f32>(0.0)) && all(uv <= vec2<f32>(1.0)) && depth >= 0.0 && depth <= 1.0;
}
