fn pcf3x3_array(uv : vec2<f32>, layer : i32, depth_ref : f32, texelSize : vec2<f32>) -> f32 {
  var sum : f32 = 0.0;

  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(-1.0, -1.0), layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(0.0, -1.0), layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(1.0, -1.0), layer, depth_ref);

  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(-1.0, 0.0), layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv, layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(1.0, 0.0), layer, depth_ref);

  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(-1.0, 1.0), layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(0.0, 1.0), layer, depth_ref);
  sum += textureSampleCompare(shadowMap, shadowSampler, uv + texelSize * vec2<f32>(1.0, 1.0), layer, depth_ref);

  return sum / 9.0;
}

fn shadowInsideFrustum(uv : vec2<f32>, depth : f32) -> bool {
  return all(uv >= vec2<f32>(0.0)) && all(uv <= vec2<f32>(1.0)) && depth >= 0.0 && depth <= 1.0;
}
