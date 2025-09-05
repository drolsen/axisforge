struct Cluster {
  offset : u32,
  count : u32,
};

struct Light {
  position : vec3<f32>,
  range : f32,
  color : vec3<f32>,
  intensity : f32,
};
