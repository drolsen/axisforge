import { RunService } from '../../services/RunService.js';

const WORLD_UP = [0, 1, 0];

function normalize(vec) {
  const length = Math.hypot(vec[0], vec[1], vec[2]);
  if (!length) {
    return [0, 0, 0];
  }
  const inv = 1 / length;
  return [vec[0] * inv, vec[1] * inv, vec[2] * inv];
}

function scale(vec, scalar) {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export class FirstPersonController {
  constructor(camera, inputService, options = {}) {
    if (!camera) {
      throw new Error('FirstPersonController requires a camera');
    }
    this.camera = camera;
    this.input = inputService || null;
    this.options = {
      moveSpeed: 12,
      fastMultiplier: 3,
      slowMultiplier: 0.35,
      lookSensitivity: 0.0025,
      invertY: false,
      ...options,
    };

    this.enabled = false;
    this._bindingName = `FirstPersonController::${Math.random().toString(36).slice(2)}`;
    this._boundUpdate = this._update.bind(this);
    this._keys = new Set();
    this._connections = [];
    this._prevMouseBehavior = this.input ? this.input.MouseBehavior : 'Default';
    this._prevMouseSensitivity = this.input ? this.input.MouseDeltaSensitivity : 1;

    this._onInputBegan = this._handleInputBegan.bind(this);
    this._onInputEnded = this._handleInputEnded.bind(this);
    this._onInputChanged = this._handleInputChanged.bind(this);

    if (this.input) {
      this._connections.push(this.input.InputBegan.Connect(this._onInputBegan));
      this._connections.push(this.input.InputEnded.Connect(this._onInputEnded));
      this._connections.push(this.input.InputChanged.Connect(this._onInputChanged));
    }
  }

  setEnabled(enabled) {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = Boolean(enabled);

    if (this.enabled) {
      if (this.input) {
        this._prevMouseBehavior = this.input.MouseBehavior;
        this._prevMouseSensitivity = this.input.MouseDeltaSensitivity;
        this.input.MouseBehavior = 'LockCenter';
        this.input.MouseDeltaSensitivity = 1;
      }
      RunService.BindToRenderStep(this._bindingName, 200, this._boundUpdate);
    } else {
      RunService.UnbindFromRenderStep(this._bindingName);
      if (this.input) {
        this.input.MouseBehavior = this._prevMouseBehavior;
        this.input.MouseDeltaSensitivity = this._prevMouseSensitivity;
      }
      this._keys.clear();
    }
  }

  dispose() {
    this.setEnabled(false);
    for (const connection of this._connections) {
      if (connection?.Disconnect) {
        connection.Disconnect();
      }
    }
    this._connections = [];
  }

  _handleInputBegan(input) {
    if (input.UserInputType === 'Keyboard') {
      this._keys.add(input.KeyCode);
    }
  }

  _handleInputEnded(input) {
    if (input.UserInputType === 'Keyboard') {
      this._keys.delete(input.KeyCode);
    }
  }

  _handleInputChanged(input) {
    if (!this.enabled) {
      return;
    }
    if (input.UserInputType === 'MouseMovement') {
      const dx = input.Delta?.x ?? 0;
      let dy = input.Delta?.y ?? 0;
      if (this.options.invertY) {
        dy = -dy;
      }
      const yaw = this.camera.getYaw() + dx * this.options.lookSensitivity;
      const pitch = this.camera.getPitch() - dy * this.options.lookSensitivity;
      this.camera.setYawPitch(yaw, pitch);
    }
  }

  _update(dt) {
    if (!this.enabled) {
      return;
    }

    const forward = this.camera.getForward();
    const right = this.camera.getRight();
    const move = [0, 0, 0];

    if (this._keys.has('W')) {
      move[0] += forward[0];
      move[1] += forward[1];
      move[2] += forward[2];
    }
    if (this._keys.has('S')) {
      move[0] -= forward[0];
      move[1] -= forward[1];
      move[2] -= forward[2];
    }
    if (this._keys.has('D')) {
      move[0] += right[0];
      move[1] += right[1];
      move[2] += right[2];
    }
    if (this._keys.has('A')) {
      move[0] -= right[0];
      move[1] -= right[1];
      move[2] -= right[2];
    }
    if (this._keys.has('Space')) {
      move[0] += WORLD_UP[0];
      move[1] += WORLD_UP[1];
      move[2] += WORLD_UP[2];
    }
    if (this._keys.has('Ctrl')) {
      move[0] -= WORLD_UP[0];
      move[1] -= WORLD_UP[1];
      move[2] -= WORLD_UP[2];
    }

    const moveLength = Math.hypot(move[0], move[1], move[2]);
    if (moveLength > 0) {
      let speed = this.options.moveSpeed;
      if (this._keys.has('Shift')) {
        speed *= this.options.fastMultiplier;
      }
      const direction = normalize(move);
      const delta = scale(direction, speed * dt);
      const position = add(this.camera.getPosition(), delta);
      this.camera.setPosition(position);
    }
  }
}
