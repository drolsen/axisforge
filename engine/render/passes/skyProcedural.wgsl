struct SkyUniforms {
  invViewProj : mat4x4<f32>,
  cameraPos : vec4<f32>,
  sunDirectionIntensity : vec4<f32>,
  sunColor : vec4<f32>,
  groundAlbedoTurbidity : vec4<f32>,
};

@group(0) @binding(0) var<uniform> sky : SkyUniforms;

const PI : f32 = 3.141592653589793;
const SUN_ANGULAR_RADIUS : f32 = 0.004675; // ~0.53 degrees
const RAYLEIGH_SCATTERING : vec3<f32> = vec3<f32>(5.802, 13.558, 33.1) * 1e-6;
const MIE_SCATTERING : vec3<f32> = vec3<f32>(3.996, 3.996, 3.996) * 1e-6;
const G_MIE : f32 = 0.76;

fn saturate(v : f32) -> f32 {
  return clamp(v, 0.0, 1.0);
}

fn world_direction_from_uv(uv : vec2<f32>) -> vec3<f32> {
  let ndc = vec4<f32>(uv * 2.0 - vec2<f32>(1.0), 1.0, 1.0);
  let world = sky.invViewProj * ndc;
  let position = world.xyz / world.w;
  let dir = normalize(position - sky.cameraPos.xyz);
  return dir;
}

fn rayleigh_phase(cos_theta : f32) -> f32 {
  return (3.0 / (16.0 * PI)) * (1.0 + cos_theta * cos_theta);
}

fn henyey_greenstein(cos_theta : f32, g : f32) -> f32 {
  let g2 = g * g;
  return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cos_theta, 1.5));
}

fn air_mass(cos_zenith : f32) -> f32 {
  let c = clamp(cos_zenith, -0.999, 0.999);
  let z = acos(c);
  let degrees = z * 57.29577951308232;
  return 1.0 / (c + 0.15 * pow(93.885 - degrees, -1.253));
}

fn compute_scattering(view_dir : vec3<f32>, sun_dir : vec3<f32>, turbidity : f32) -> vec3<f32> {
  let cos_theta = dot(view_dir, sun_dir);
  let cos_view = dot(view_dir, vec3<f32>(0.0, 1.0, 0.0));
  let cos_sun = dot(sun_dir, vec3<f32>(0.0, 1.0, 0.0));

  let m_r = air_mass(cos_view);
  let m_m = m_r * (0.8 + 0.2 * turbidity);

  let beta_r = RAYLEIGH_SCATTERING;
  let beta_m_sca = MIE_SCATTERING * turbidity;
  let beta_m_ext = beta_m_sca / 0.9;

  let extinction = exp(-(beta_r * m_r + beta_m_ext * m_m));

  let rayleigh = rayleigh_phase(cos_theta) * beta_r;
  let mie = henyey_greenstein(cos_theta, G_MIE) * beta_m_sca;

  let sun_e = saturate(cos_sun) + 0.02;
  return (rayleigh + mie) * sun_e * extinction;
}

fn sun_disk(view_dir : vec3<f32>, sun_dir : vec3<f32>, sun_intensity : f32) -> vec3<f32> {
  let cos_angle = dot(view_dir, sun_dir);
  let angle = acos(clamp(cos_angle, -1.0, 1.0));
  let glow = smoothstep(SUN_ANGULAR_RADIUS, SUN_ANGULAR_RADIUS * 0.3, angle);
  return vec3<f32>(sun_intensity * glow);
}

fn horizon_blend(y : f32) -> f32 {
  return smoothstep(-0.1, 0.2, y);
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) uv : vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) index : u32) -> VertexOutput {
  let positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0,  1.0)
  );

  let uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );

  var output : VertexOutput;
  output.position = vec4<f32>(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

@fragment
fn fs(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
  let dir = world_direction_from_uv(uv);

  let sun_dir = normalize(sky.sunDirectionIntensity.xyz);
  let sun_intensity = sky.sunDirectionIntensity.w;
  let turbidity = max(1.0, sky.groundAlbedoTurbidity.w);
  let ground_albedo = sky.groundAlbedoTurbidity.xyz;

  let scattering = compute_scattering(dir, sun_dir, turbidity);
  let sun_color = sky.sunColor.xyz;
  var color = scattering * sun_color * sun_intensity;

  let sun_glow = sun_disk(dir, sun_dir, sun_intensity);
  color += sun_color * sun_glow;

  let day_amount = saturate(dot(sun_dir, vec3<f32>(0.0, 1.0, 0.0)) * 0.5 + 0.5);
  let base_night = vec3<f32>(0.015, 0.02, 0.04);
  let base_day = vec3<f32>(0.45, 0.55, 0.7);
  let base_color = mix(base_night, base_day, pow(day_amount, 0.55));
  color += base_color * 0.4;

  let horizon = horizon_blend(dir.y);
  let ground = ground_albedo * (0.25 + 0.75 * horizon);
  color = mix(ground, color, saturate(dir.y * 0.5 + 0.5));

  color = max(color, vec3<f32>(0.0));
  return vec4<f32>(color, 1.0);
}
