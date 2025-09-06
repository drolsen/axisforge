export function meshFromSDF() {
  // Returns a unit cube mesh as a placeholder for dual contouring.
  const positions = [
    0, 0, 0,
    1, 0, 0,
    1, 1, 0,
    0, 1, 0,
    0, 0, 1,
    1, 0, 1,
    1, 1, 1,
    0, 1, 1,
  ];
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];
  const normals = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - 0.5;
    const y = positions[i + 1] - 0.5;
    const z = positions[i + 2] - 0.5;
    const len = Math.hypot(x, y, z) || 1;
    normals.push(x / len, y / len, z / len);
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

export default { meshFromSDF };
