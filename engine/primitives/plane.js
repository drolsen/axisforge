export function makePlane(size = 512, segments = 1) {
  const hs = size * 0.5;
  const positions = new Float32Array([
    -hs, 0, -hs,
     hs, 0, -hs,
    -hs, 0,  hs,
    -hs, 0,  hs,
     hs, 0, -hs,
     hs, 0,  hs,
  ]);
  const normals = new Float32Array([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ]);
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1,
  ]);
  const tangents = new Float32Array([
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
  ]);
  return { positions, normals, uvs, tangents, indices: null, segments };
}

export default makePlane;
