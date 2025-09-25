function createFaceTangents(count, tangent) {
  const array = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    array[i * 4 + 0] = tangent[0];
    array[i * 4 + 1] = tangent[1];
    array[i * 4 + 2] = tangent[2];
    array[i * 4 + 3] = tangent[3] ?? 1;
  }
  return array;
}

export function makeBox(width = 4, height = 1, depth = 4) {
  const hx = width * 0.5;
  const hy = height * 0.5;
  const hz = depth * 0.5;

  const positions = new Float32Array([
    // Front
    -hx, -hy, hz,
     hx, -hy, hz,
     hx,  hy, hz,
    -hx,  hy, hz,
    // Back
     hx, -hy, -hz,
    -hx, -hy, -hz,
    -hx,  hy, -hz,
     hx,  hy, -hz,
    // Left
    -hx, -hy, -hz,
    -hx, -hy,  hz,
    -hx,  hy,  hz,
    -hx,  hy, -hz,
    // Right
     hx, -hy,  hz,
     hx, -hy, -hz,
     hx,  hy, -hz,
     hx,  hy,  hz,
    // Top
    -hx,  hy,  hz,
     hx,  hy,  hz,
     hx,  hy, -hz,
    -hx,  hy, -hz,
    // Bottom
    -hx, -hy, -hz,
     hx, -hy, -hz,
     hx, -hy,  hz,
    -hx, -hy,  hz,
  ]);

  const normals = new Float32Array([
    // Front
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    // Back
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    // Left
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    -1, 0, 0,
    // Right
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    // Top
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    // Bottom
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
  ]);

  const uvs = new Float32Array([
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
    0, 0,  1, 0,  1, 1,  0, 1,
  ]);

  const tangents = new Float32Array([
    // Front (+X)
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    // Back (-X)
    -1, 0, 0, 1,
    -1, 0, 0, 1,
    -1, 0, 0, 1,
    -1, 0, 0, 1,
    // Left (-Z)
    0, 0, -1, 1,
    0, 0, -1, 1,
    0, 0, -1, 1,
    0, 0, -1, 1,
    // Right (+Z)
    0, 0, 1, 1,
    0, 0, 1, 1,
    0, 0, 1, 1,
    0, 0, 1, 1,
    // Top (+X)
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    1, 0, 0, 1,
    // Bottom (+X)
    1, 0, 0, -1,
    1, 0, 0, -1,
    1, 0, 0, -1,
    1, 0, 0, -1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,  0, 2, 3,
    4, 5, 6,  4, 6, 7,
    8, 9, 10,  8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23,
  ]);

  return { positions, normals, uvs, tangents, indices };
}

export default makeBox;
