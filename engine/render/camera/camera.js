import { addVec3, lookAt, mat4Multiply, perspective } from '../mesh/math.js';

const PITCH_LIMIT = Math.PI / 2 - 0.01;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(vec) {
  const length = Math.hypot(vec[0], vec[1], vec[2]);
  if (length === 0) {
    return [0, 0, 0];
  }
  const inv = 1 / length;
  return [vec[0] * inv, vec[1] * inv, vec[2] * inv];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export default class Camera {
  constructor({
    position = [0, 0, 0],
    target = [0, 0, -1],
    up = [0, 1, 0],
    near = 0.1,
    far = 1000,
    fov = Math.PI / 3,
    aspect = 1,
  } = {}) {
    this._position = new Float32Array(3);
    this._worldUp = new Float32Array(up);

    this._fov = fov;
    this._near = near;
    this._far = far;
    this._aspect = aspect;

    this._yaw = 0;
    this._pitch = 0;

    this._viewMatrix = new Float32Array(16);
    this._projectionMatrix = new Float32Array(16);
    this._viewProjectionMatrix = new Float32Array(16);
    this._uniformData = new Float32Array(36);

    this._forward = new Float32Array([0, 0, -1]);
    this._right = new Float32Array([1, 0, 0]);
    this._up = new Float32Array([0, 1, 0]);

    this._viewDirty = true;
    this._projectionDirty = true;
    this._uniformDirty = true;

    this.setPosition(position);
    this.lookAt(target);
  }

  clone() {
    const camera = new Camera({
      position: this.getPosition(),
      target: addVec3(this.getPosition(), this.getForward()),
      up: this.getWorldUp(),
      near: this.getNear(),
      far: this.getFar(),
      fov: this.getFov(),
      aspect: this.getAspect(),
    });
    camera.setYawPitch(this.getYaw(), this.getPitch());
    return camera;
  }

  setPosition(value, y, z) {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      this._position[0] = value[0];
      this._position[1] = value[1];
      this._position[2] = value[2];
    } else if (typeof value === 'number' && typeof y === 'number' && typeof z === 'number') {
      this._position[0] = value;
      this._position[1] = y;
      this._position[2] = z;
    }
    this._viewDirty = true;
    this._uniformDirty = true;
  }

  translate(delta) {
    this._position[0] += delta[0];
    this._position[1] += delta[1];
    this._position[2] += delta[2];
    this._viewDirty = true;
    this._uniformDirty = true;
  }

  getPosition() {
    return [this._position[0], this._position[1], this._position[2]];
  }

  getPositionRef() {
    return this._position;
  }

  setYawPitch(yaw, pitch) {
    this._yaw = yaw;
    this._pitch = clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
    this._viewDirty = true;
    this._uniformDirty = true;
  }

  getYaw() {
    return this._yaw;
  }

  getPitch() {
    return this._pitch;
  }

  lookAt(target) {
    if (!target) {
      return;
    }
    const tx = target[0] - this._position[0];
    const ty = target[1] - this._position[1];
    const tz = target[2] - this._position[2];
    const len = Math.hypot(tx, ty, tz);
    if (len === 0) {
      return;
    }
    const inv = 1 / len;
    const dirY = clamp(ty * inv, -1, 1);
    this._yaw = Math.atan2(tx, -tz);
    this._pitch = Math.asin(dirY);
    this._viewDirty = true;
    this._uniformDirty = true;
  }

  setWorldUp(up) {
    this._worldUp[0] = up[0];
    this._worldUp[1] = up[1];
    this._worldUp[2] = up[2];
    this._viewDirty = true;
    this._uniformDirty = true;
  }

  getWorldUp() {
    return [this._worldUp[0], this._worldUp[1], this._worldUp[2]];
  }

  setAspect(aspect) {
    if (aspect > 0 && aspect !== this._aspect) {
      this._aspect = aspect;
      this._projectionDirty = true;
      this._uniformDirty = true;
    }
  }

  getAspect() {
    return this._aspect;
  }

  setFov(fov) {
    if (fov > 0) {
      this._fov = fov;
      this._projectionDirty = true;
      this._uniformDirty = true;
    }
  }

  getFov() {
    return this._fov;
  }

  setNear(near) {
    if (near > 0) {
      this._near = near;
      this._projectionDirty = true;
      this._uniformDirty = true;
    }
  }

  getNear() {
    return this._near;
  }

  setFar(far) {
    if (far > 0) {
      this._far = far;
      this._projectionDirty = true;
      this._uniformDirty = true;
    }
  }

  getFar() {
    return this._far;
  }

  _updateProjectionMatrix() {
    if (!this._projectionDirty) {
      return;
    }
    const proj = perspective(this._fov, Math.max(this._aspect, 1e-6), this._near, this._far);
    this._projectionMatrix.set(proj);
    this._projectionDirty = false;
    this._uniformDirty = true;
  }

  _updateViewMatrix() {
    if (!this._viewDirty) {
      return;
    }
    const cosPitch = Math.cos(this._pitch);
    const sinPitch = Math.sin(this._pitch);
    const cosYaw = Math.cos(this._yaw);
    const sinYaw = Math.sin(this._yaw);

    const forward = normalize([
      sinYaw * cosPitch,
      sinPitch,
      -cosYaw * cosPitch,
    ]);

    let right = cross(forward, this._worldUp);
    let rightLen = Math.hypot(right[0], right[1], right[2]);
    if (rightLen < 1e-6) {
      right = [1, 0, 0];
      rightLen = 1;
    }
    right = normalize(right);
    const upVec = normalize(cross(right, forward));

    const target = addVec3(this._position, forward);
    const view = lookAt(this._position, target, upVec);

    this._viewMatrix.set(view);
    this._forward.set(forward);
    this._right.set(right);
    this._up.set(upVec);
    this._viewDirty = false;
    this._uniformDirty = true;
  }

  _updateViewProjectionMatrix() {
    this._updateProjectionMatrix();
    this._updateViewMatrix();
    const viewProj = mat4Multiply(this._projectionMatrix, this._viewMatrix);
    this._viewProjectionMatrix.set(viewProj);
  }

  _updateUniformData() {
    if (!this._uniformDirty) {
      return;
    }
    this._updateViewProjectionMatrix();
    this._uniformData.set(this._viewProjectionMatrix, 0);
    this._uniformData.set(this._viewMatrix, 16);
    this._uniformData[32] = this._position[0];
    this._uniformData[33] = this._position[1];
    this._uniformData[34] = this._position[2];
    this._uniformData[35] = 1;
    this._uniformDirty = false;
  }

  updateMatrices() {
    this._updateProjectionMatrix();
    this._updateViewMatrix();
    this._updateViewProjectionMatrix();
    this._updateUniformData();
  }

  getViewMatrix() {
    this._updateViewMatrix();
    return this._viewMatrix;
  }

  getProjectionMatrix() {
    this._updateProjectionMatrix();
    return this._projectionMatrix;
  }

  getViewProjectionMatrix() {
    this._updateViewProjectionMatrix();
    return this._viewProjectionMatrix;
  }

  getUniformArray() {
    this._updateUniformData();
    return this._uniformData;
  }

  getForward() {
    this._updateViewMatrix();
    return [this._forward[0], this._forward[1], this._forward[2]];
  }

  getRight() {
    this._updateViewMatrix();
    return [this._right[0], this._right[1], this._right[2]];
  }

  getUp() {
    this._updateViewMatrix();
    return [this._up[0], this._up[1], this._up[2]];
  }
}
