const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

export function mat4Identity() {
  return new Float32Array(IDENTITY_MATRIX);
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  out[4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[5] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[6] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[7] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  out[8] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[9] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[10] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[11] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;

  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  out[12] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
  out[13] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
  out[14] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
  out[15] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  return out;
}

export function mat4Transpose(m) {
  const out = new Float32Array(16);
  out[0] = m[0];
  out[1] = m[4];
  out[2] = m[8];
  out[3] = m[12];
  out[4] = m[1];
  out[5] = m[5];
  out[6] = m[9];
  out[7] = m[13];
  out[8] = m[2];
  out[9] = m[6];
  out[10] = m[10];
  out[11] = m[14];
  out[12] = m[3];
  out[13] = m[7];
  out[14] = m[11];
  out[15] = m[15];
  return out;
}

export function mat4Invert(m) {
  const inv = new Float32Array(16);

  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return mat4Identity();
  }

  const invDet = 1 / det;

  inv[0] = (m11 * b11 - m12 * b10 + m13 * b09) * invDet;
  inv[1] = (m02 * b10 - m01 * b11 - m03 * b09) * invDet;
  inv[2] = (m31 * b05 - m32 * b04 + m33 * b03) * invDet;
  inv[3] = (m22 * b04 - m21 * b05 - m23 * b03) * invDet;
  inv[4] = (m12 * b08 - m10 * b11 - m13 * b07) * invDet;
  inv[5] = (m00 * b11 - m02 * b08 + m03 * b07) * invDet;
  inv[6] = (m32 * b02 - m30 * b05 - m33 * b01) * invDet;
  inv[7] = (m20 * b05 - m22 * b02 + m23 * b01) * invDet;
  inv[8] = (m10 * b10 - m11 * b08 + m13 * b06) * invDet;
  inv[9] = (m01 * b08 - m00 * b10 - m03 * b06) * invDet;
  inv[10] = (m30 * b04 - m31 * b02 + m33 * b00) * invDet;
  inv[11] = (m21 * b02 - m20 * b04 - m23 * b00) * invDet;
  inv[12] = (m11 * b07 - m10 * b09 - m12 * b06) * invDet;
  inv[13] = (m00 * b09 - m01 * b07 + m02 * b06) * invDet;
  inv[14] = (m31 * b01 - m30 * b03 - m32 * b00) * invDet;
  inv[15] = (m20 * b03 - m21 * b01 + m22 * b00) * invDet;
  return inv;
}

export function computeNormalMatrix(mat) {
  const inverted = mat4Invert(mat);
  const transposed = mat4Transpose(inverted);
  // Zero out the last row/column to keep it purely 3x3
  const out = new Float32Array(16);
  out.set(transposed);
  out[3] = 0;
  out[7] = 0;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}

export function degToRad(value) {
  return (value * Math.PI) / 180;
}

export function radToDeg(value) {
  return (value * 180) / Math.PI;
}

export function quaternionNormalize(q) {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len === 0) {
    return new Float32Array([0, 0, 0, 1]);
  }
  return new Float32Array([q[0] / len, q[1] / len, q[2] / len, q[3] / len]);
}

export function quaternionFromEuler({ x = 0, y = 0, z = 0 } = {}) {
  const rx = degToRad(x) * 0.5;
  const ry = degToRad(y) * 0.5;
  const rz = degToRad(z) * 0.5;

  const sx = Math.sin(rx);
  const cx = Math.cos(rx);
  const sy = Math.sin(ry);
  const cy = Math.cos(ry);
  const sz = Math.sin(rz);
  const cz = Math.cos(rz);

  const qx = sx * cy * cz + cx * sy * sz;
  const qy = cx * sy * cz - sx * cy * sz;
  const qz = cx * cy * sz + sx * sy * cz;
  const qw = cx * cy * cz - sx * sy * sz;
  return quaternionNormalize(new Float32Array([qx, qy, qz, qw]));
}

export function quaternionToEuler(quat) {
  const [x, y, z, w] = quat;

  const sinr_cosp = 2 * (w * x + y * z);
  const cosr_cosp = 1 - 2 * (x * x + y * y);
  const roll = Math.atan2(sinr_cosp, cosr_cosp);

  const sinp = 2 * (w * y - z * x);
  let pitch;
  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * Math.PI / 2;
  } else {
    pitch = Math.asin(sinp);
  }

  const siny_cosp = 2 * (w * z + x * y);
  const cosy_cosp = 1 - 2 * (y * y + z * z);
  const yaw = Math.atan2(siny_cosp, cosy_cosp);

  return {
    x: radToDeg(roll),
    y: radToDeg(pitch),
    z: radToDeg(yaw),
  };
}

export function quaternionFromRotationMatrix(m) {
  const trace = m[0] + m[5] + m[10];
  let x;
  let y;
  let z;
  let w;

  if (trace > 0) {
    const s = Math.sqrt(trace + 1.0) * 2;
    w = 0.25 * s;
    x = (m[6] - m[9]) / s;
    y = (m[8] - m[2]) / s;
    z = (m[1] - m[4]) / s;
  } else if (m[0] > m[5] && m[0] > m[10]) {
    const s = Math.sqrt(1.0 + m[0] - m[5] - m[10]) * 2;
    w = (m[6] - m[9]) / s;
    x = 0.25 * s;
    y = (m[1] + m[4]) / s;
    z = (m[8] + m[2]) / s;
  } else if (m[5] > m[10]) {
    const s = Math.sqrt(1.0 + m[5] - m[0] - m[10]) * 2;
    w = (m[8] - m[2]) / s;
    x = (m[1] + m[4]) / s;
    y = 0.25 * s;
    z = (m[6] + m[9]) / s;
  } else {
    const s = Math.sqrt(1.0 + m[10] - m[0] - m[5]) * 2;
    w = (m[1] - m[4]) / s;
    x = (m[8] + m[2]) / s;
    y = (m[6] + m[9]) / s;
    z = 0.25 * s;
  }

  return quaternionNormalize(new Float32Array([x, y, z, w]));
}

export function mat4FromRotationTranslationScale(quat, translation = [0, 0, 0], scale = [1, 1, 1]) {
  const [x, y, z, w] = quat;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;

  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];

  const out = new Float32Array(16);
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;

  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;

  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;

  out[12] = translation[0];
  out[13] = translation[1];
  out[14] = translation[2];
  out[15] = 1;
  return out;
}

export function lookAt(eye, target, up) {
  const zx = eye[0] - target[0];
  const zy = eye[1] - target[1];
  const zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz);
  const zxN = len > 0 ? zx / len : 0;
  const zyN = len > 0 ? zy / len : 0;
  const zzN = len > 0 ? zz / len : 0;

  let xx = up[1] * zzN - up[2] * zyN;
  let xy = up[2] * zxN - up[0] * zzN;
  let xz = up[0] * zyN - up[1] * zxN;
  len = Math.hypot(xx, xy, xz);
  if (len === 0) {
    xx = 0;
    xy = 0;
    xz = 0;
  } else {
    xx /= len;
    xy /= len;
    xz /= len;
  }

  const yx = zyN * xz - zzN * xy;
  const yy = zzN * xx - zxN * xz;
  const yz = zxN * xy - zyN * xx;

  const out = new Float32Array(16);
  out[0] = xx;
  out[1] = yx;
  out[2] = zxN;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zyN;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zzN;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zxN * eye[0] + zyN * eye[1] + zzN * eye[2]);
  out[15] = 1;
  return out;
}

export function perspective(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
}

export function decomposeTRS(matrix) {
  const translation = [matrix[12], matrix[13], matrix[14]];

  const sx = Math.hypot(matrix[0], matrix[1], matrix[2]);
  const sy = Math.hypot(matrix[4], matrix[5], matrix[6]);
  const sz = Math.hypot(matrix[8], matrix[9], matrix[10]);
  const scale = [sx, sy, sz];

  const invSx = sx !== 0 ? 1 / sx : 0;
  const invSy = sy !== 0 ? 1 / sy : 0;
  const invSz = sz !== 0 ? 1 / sz : 0;

  const rot = [
    matrix[0] * invSx, matrix[1] * invSx, matrix[2] * invSx,
    matrix[4] * invSy, matrix[5] * invSy, matrix[6] * invSy,
    matrix[8] * invSz, matrix[9] * invSz, matrix[10] * invSz,
  ];

  const quat = quaternionFromRotationMatrix([
    rot[0], rot[1], rot[2], 0,
    rot[3], rot[4], rot[5], 0,
    rot[6], rot[7], rot[8], 0,
    0, 0, 0, 1,
  ]);

  return { translation, rotation: quat, scale };
}

export function addVec3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scaleVec3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}
