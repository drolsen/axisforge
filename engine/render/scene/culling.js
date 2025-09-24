const ZERO_BOUNDS = {
  min: [0, 0, 0],
  max: [0, 0, 0],
};

function ensureTargetBounds(target) {
  if (target && target.min && target.max) {
    return target;
  }
  return {
    min: [0, 0, 0],
    max: [0, 0, 0],
  };
}

export function transformAABB(matrix, bounds, target = null) {
  if (!matrix || !bounds || !bounds.min || !bounds.max) {
    return target ?? null;
  }

  const out = ensureTargetBounds(target);

  const min = bounds.min;
  const max = bounds.max;

  const centerX = (min[0] + max[0]) * 0.5;
  const centerY = (min[1] + max[1]) * 0.5;
  const centerZ = (min[2] + max[2]) * 0.5;

  const extentX = (max[0] - min[0]) * 0.5;
  const extentY = (max[1] - min[1]) * 0.5;
  const extentZ = (max[2] - min[2]) * 0.5;

  const worldCenterX =
    matrix[0] * centerX +
    matrix[4] * centerY +
    matrix[8] * centerZ +
    matrix[12];
  const worldCenterY =
    matrix[1] * centerX +
    matrix[5] * centerY +
    matrix[9] * centerZ +
    matrix[13];
  const worldCenterZ =
    matrix[2] * centerX +
    matrix[6] * centerY +
    matrix[10] * centerZ +
    matrix[14];

  const worldExtentX =
    Math.abs(matrix[0]) * extentX +
    Math.abs(matrix[4]) * extentY +
    Math.abs(matrix[8]) * extentZ;
  const worldExtentY =
    Math.abs(matrix[1]) * extentX +
    Math.abs(matrix[5]) * extentY +
    Math.abs(matrix[9]) * extentZ;
  const worldExtentZ =
    Math.abs(matrix[2]) * extentX +
    Math.abs(matrix[6]) * extentY +
    Math.abs(matrix[10]) * extentZ;

  out.min[0] = worldCenterX - worldExtentX;
  out.min[1] = worldCenterY - worldExtentY;
  out.min[2] = worldCenterZ - worldExtentZ;

  out.max[0] = worldCenterX + worldExtentX;
  out.max[1] = worldCenterY + worldExtentY;
  out.max[2] = worldCenterZ + worldExtentZ;

  return out;
}

function normalizePlane(a, b, c, d) {
  const length = Math.hypot(a, b, c);
  if (length === 0) {
    return { normal: [0, 0, 0], constant: 0 };
  }
  const inv = 1 / length;
  return {
    normal: [a * inv, b * inv, c * inv],
    constant: d * inv,
  };
}

export function extractFrustumPlanes(matrix) {
  if (!matrix || matrix.length !== 16) {
    return null;
  }

  const m00 = matrix[0];
  const m01 = matrix[4];
  const m02 = matrix[8];
  const m03 = matrix[12];
  const m10 = matrix[1];
  const m11 = matrix[5];
  const m12 = matrix[9];
  const m13 = matrix[13];
  const m20 = matrix[2];
  const m21 = matrix[6];
  const m22 = matrix[10];
  const m23 = matrix[14];
  const m30 = matrix[3];
  const m31 = matrix[7];
  const m32 = matrix[11];
  const m33 = matrix[15];

  const planes = [
    normalizePlane(m30 + m00, m31 + m01, m32 + m02, m33 + m03), // Left
    normalizePlane(m30 - m00, m31 - m01, m32 - m02, m33 - m03), // Right
    normalizePlane(m30 + m10, m31 + m11, m32 + m12, m33 + m13), // Bottom
    normalizePlane(m30 - m10, m31 - m11, m32 - m12, m33 - m13), // Top
    normalizePlane(m30 + m20, m31 + m21, m32 + m22, m33 + m23), // Near
    normalizePlane(m30 - m20, m31 - m21, m32 - m22, m33 - m23), // Far
  ];

  return planes;
}

export function isAABBVisible(bounds, planes) {
  if (!bounds || !bounds.min || !bounds.max) {
    return true;
  }
  if (!planes || planes.length === 0) {
    return true;
  }

  const { min, max } = bounds;

  for (const plane of planes) {
    const normal = plane?.normal ?? ZERO_BOUNDS.min;
    const constant = plane?.constant ?? 0;

    const px = normal[0] >= 0 ? max[0] : min[0];
    const py = normal[1] >= 0 ? max[1] : min[1];
    const pz = normal[2] >= 0 ? max[2] : min[2];

    const distance = normal[0] * px + normal[1] * py + normal[2] * pz + constant;
    if (distance < 0) {
      return false;
    }
  }

  return true;
}

export function countVisible(boundsList, planes) {
  let visible = 0;
  for (const bounds of boundsList || []) {
    if (isAABBVisible(bounds, planes)) {
      visible += 1;
    }
  }
  return visible;
}
