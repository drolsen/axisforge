const SHADOW_TAP_COUNT : f32 = 9.0;

fn pcf3x3_array(
  shadowMap : texture_depth_2d_array,
  shadowSampler : sampler_comparison,
  uv : vec2<f32>,
  layer : i32,
  compareDepth : f32,
  texelSize : vec2<f32>
) -> f32 {
  let safeTexel = max(texelSize, vec2<f32>(0.0));
  let minUv = safeTexel;
  let maxUv = vec2<f32>(1.0) - safeTexel;
  let baseUv = clamp(uv, minUv, maxUv);

  var sum = 0.0;
  for (var y : i32 = -1; y <= 1; y = y + 1) {
    for (var x : i32 = -1; x <= 1; x = x + 1) {
      let offset = vec2<i32>(x, y);
      sum = sum + textureSampleCompare(shadowMap, shadowSampler, baseUv, layer, compareDepth, offset);
    }
  }
  return sum / SHADOW_TAP_COUNT;
}

fn shadowInsideFrustum(uv : vec2<f32>, depth : f32) -> bool {
  return all(uv >= vec2<f32>(0.0)) && all(uv <= vec2<f32>(1.0)) && depth >= 0.0 && depth <= 1.0;
}
