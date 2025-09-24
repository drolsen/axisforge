const DEFAULT_SCENE_BOUNDS = {
  min: [-50, -10, -50],
  max: [50, 50, 50],
};

const WORLD_UP = [0, 1, 0];
const MAX_CASCADES = 4;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vec) {
  const length = Math.hypot(vec[0], vec[1], vec[2]);
  if (length === 0) {
    return [0, 0, 0];
  }
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(vec, s) {
  return [vec[0] * s, vec[1] * s, vec[2] * s];
}

function computeCameraBasis(direction, up = WORLD_UP) {
  const forward = normalize(direction);
  let right = cross(forward, up);
  const rightLength = Math.hypot(right[0], right[1], right[2]);
  if (rightLength < 1e-5) {
    right = cross(forward, [0, 0, 1]);
  }
  right = normalize(right);
  const realUp = normalize(cross(right, forward));
  return { forward, right, up: realUp };
}

function lookAt(eye, target, up) {
  const zAxis = normalize(subtract(eye, target));
  let xAxis = cross(up, zAxis);
  const len = Math.hypot(xAxis[0], xAxis[1], xAxis[2]);
  if (len < 1e-5) {
    xAxis = cross([0, 0, 1], zAxis);
  }
  xAxis = normalize(xAxis);
  const yAxis = cross(zAxis, xAxis);

  return [
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ];
}

function multiplyMat4(a, b) {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[row * 4 + col] =
        a[row * 4 + 0] * b[0 * 4 + col] +
        a[row * 4 + 1] * b[1 * 4 + col] +
        a[row * 4 + 2] * b[2 * 4 + col] +
        a[row * 4 + 3] * b[3 * 4 + col];
    }
  }
  return out;
}

function transformPoint(mat, point) {
  const x = point[0];
  const y = point[1];
  const z = point[2];
  const w =
    mat[3] * x +
    mat[7] * y +
    mat[11] * z +
    mat[15];
  const nx =
    mat[0] * x +
    mat[4] * y +
    mat[8] * z +
    mat[12];
  const ny =
    mat[1] * x +
    mat[5] * y +
    mat[9] * z +
    mat[13];
  const nz =
    mat[2] * x +
    mat[6] * y +
    mat[10] * z +
    mat[14];
  if (w !== 0 && w !== 1) {
    return [nx / w, ny / w, nz / w];
  }
  return [nx, ny, nz];
}

function orthographic(left, right, bottom, top, near, far) {
  const lr = 1 / (left - right);
  const bt = 1 / (bottom - top);
  const nf = 1 / (near - far);

  return [
    -2 * lr, 0, 0, 0,
    0, -2 * bt, 0, 0,
    0, 0, 2 * nf, 0,
    (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1,
  ];
}

function computeCascadeCorners(camera, cascadeNear, cascadeFar) {
  const { position, direction, up, fov = Math.PI / 3, aspect = 16 / 9 } = camera;
  const basis = computeCameraBasis(direction, up);

  const corners = [];
  const nearHeight = Math.tan(fov * 0.5) * cascadeNear;
  const nearWidth = nearHeight * aspect;
  const farHeight = Math.tan(fov * 0.5) * cascadeFar;
  const farWidth = farHeight * aspect;

  const nearCenter = add(position, scale(basis.forward, cascadeNear));
  const farCenter = add(position, scale(basis.forward, cascadeFar));

  const upNear = scale(basis.up, nearHeight);
  const rightNear = scale(basis.right, nearWidth);
  const upFar = scale(basis.up, farHeight);
  const rightFar = scale(basis.right, farWidth);

  corners.push(add(add(nearCenter, upNear), rightNear));
  corners.push(add(subtract(nearCenter, rightNear), upNear));
  corners.push(subtract(subtract(nearCenter, upNear), rightNear));
  corners.push(add(subtract(nearCenter, upNear), rightNear));

  corners.push(add(add(farCenter, upFar), rightFar));
  corners.push(add(subtract(farCenter, rightFar), upFar));
  corners.push(subtract(subtract(farCenter, upFar), rightFar));
  corners.push(add(subtract(farCenter, upFar), rightFar));

  return corners;
}

function computeBoundingSphere(points) {
  const center = [0, 0, 0];
  for (const point of points) {
    center[0] += point[0];
    center[1] += point[1];
    center[2] += point[2];
  }
  center[0] /= points.length;
  center[1] /= points.length;
  center[2] /= points.length;

  let radius = 0;
  for (const point of points) {
    const dx = point[0] - center[0];
    const dy = point[1] - center[1];
    const dz = point[2] - center[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    radius = Math.max(radius, dist);
  }

  return { center, radius };
}

function padCascadeWithSceneBounds(points) {
  const padded = [...points];
  const { min, max } = DEFAULT_SCENE_BOUNDS;
  padded.push([min[0], min[1], min[2]]);
  padded.push([max[0], max[1], max[2]]);
  return padded;
}

export default class CascadedShadowMaps {
  constructor({ cascades = 3, lambda = 0.5, resolution = 2048, stabilize = true } = {}) {
    this.cascades = this._clampCascadeCount(cascades);
    this.lambda = this._clampLambda(lambda);
    this.resolution = Math.max(1, Math.floor(resolution));
    this.stabilize = Boolean(stabilize);
    this.cascadeData = [];
    this.cascadePadding = 10;
    this.depthPadding = 20;
  }

  _clampCascadeCount(count) {
    return Math.min(Math.max(Math.floor(count) || 1, 1), MAX_CASCADES);
  }

  _clampLambda(value) {
    if (!Number.isFinite(value)) {
      return 0.5;
    }
    return Math.min(Math.max(value, 0), 1);
  }

  setCascadeCount(count) {
    this.cascades = this._clampCascadeCount(count);
  }

  setResolution(resolution) {
    if (Number.isFinite(resolution)) {
      this.resolution = Math.max(1, Math.floor(resolution));
    }
  }

  setLambda(lambda) {
    this.lambda = this._clampLambda(lambda);
  }

  setStabilize(enabled) {
    this.stabilize = Boolean(enabled);
  }

  computeSplits(near, far) {
    const splits = [];
    for (let i = 1; i <= this.cascades; i += 1) {
      const id = i / this.cascades;
      const log = near * (far / near) ** id;
      const uniform = near + (far - near) * id;
      const split = lerp(uniform, log, this.lambda);
      splits.push(split);
    }
    return splits;
  }

  update(camera, lightDirection) {
    const near = camera.near ?? 0.1;
    const far = camera.far ?? 200;
    const splits = this.computeSplits(near, far);

    const cascades = [];
    let lastSplit = near;

    const lightDir = normalize(lightDirection);

    for (let i = 0; i < this.cascades; i += 1) {
      const cascadeFar = splits[i];
      const corners = computeCascadeCorners(camera, lastSplit, cascadeFar);
      const paddedCorners = padCascadeWithSceneBounds(corners);
      const { center, radius } = computeBoundingSphere(paddedCorners);

      const lightDistance = radius + this.cascadePadding;
      const lightPos = subtract(center, scale(lightDir, lightDistance));

      let lightUp = [...WORLD_UP];
      if (Math.abs(dot(lightUp, lightDir)) > 0.99) {
        lightUp = [1, 0, 0];
      }

      const viewMatrix = lookAt(lightPos, center, lightUp);
      const lightSpaceCorners = paddedCorners.map(point => transformPoint(viewMatrix, point));

      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const point of lightSpaceCorners) {
        minZ = Math.min(minZ, point[2]);
        maxZ = Math.max(maxZ, point[2]);
      }

      const lightSpaceCenter = transformPoint(viewMatrix, center);
      const texelSize = radius > 0 ? (2 * radius) / Math.max(1, this.resolution) : 0;
      let snappedX = lightSpaceCenter[0];
      let snappedY = lightSpaceCenter[1];
      if (this.stabilize && texelSize > 0) {
        snappedX = Math.round(lightSpaceCenter[0] / texelSize) * texelSize;
        snappedY = Math.round(lightSpaceCenter[1] / texelSize) * texelSize;
      }
      const halfSize = radius + (this.stabilize && texelSize > 0 ? texelSize : 0);

      const minX = snappedX - halfSize;
      const maxX = snappedX + halfSize;
      const minY = snappedY - halfSize;
      const maxY = snappedY + halfSize;

      const cascadeMinZ = minZ - this.depthPadding;
      const cascadeMaxZ = maxZ + this.depthPadding;

      const projectionMatrix = orthographic(
        minX,
        maxX,
        minY,
        maxY,
        cascadeMinZ,
        cascadeMaxZ,
      );
      const viewProjectionMatrix = multiplyMat4(projectionMatrix, viewMatrix);

      cascades.push({
        index: i,
        near: lastSplit,
        far: cascadeFar,
        viewMatrix,
        projectionMatrix,
        viewProjectionMatrix,
        center,
        radius,
      });

      lastSplit = cascadeFar;
    }

    this.cascadeData = cascades;
    return cascades;
  }
}
