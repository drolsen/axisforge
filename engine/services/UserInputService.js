import { Signal } from '../core/signal.js';

const KEY_MAP = {
  KeyW: 'W',
  KeyA: 'A',
  KeyS: 'S',
  KeyD: 'D',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Space: 'Space',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
};

function normalizeKey(code) {
  return KEY_MAP[code] || code;
}

export default class UserInputService {
  constructor() {
    this.InputBegan = new Signal();
    this.InputEnded = new Signal();
    this.InputChanged = new Signal();

    this._mouseBehavior = 'Default';
    this._mouseDeltaSensitivity = 1;

    this._canvas = null;
    this._keysDown = new Set();
    this._mousePos = { x: 0, y: 0 };
    this._lastTouchPos = null;

    this._onKeyDown = e => {
      const key = normalizeKey(e.code);
      if (!this._keysDown.has(key)) {
        this._keysDown.add(key);
        this.InputBegan.Fire({ UserInputType: 'Keyboard', KeyCode: key });
      }
    };

    this._onKeyUp = e => {
      const key = normalizeKey(e.code);
      if (this._keysDown.has(key)) {
        this._keysDown.delete(key);
        this.InputEnded.Fire({ UserInputType: 'Keyboard', KeyCode: key });
      }
    };

    this._onMouseMove = e => {
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._mousePos = { x, y };
      const delta = {
        x: (e.movementX || 0) * this._mouseDeltaSensitivity,
        y: (e.movementY || 0) * this._mouseDeltaSensitivity,
      };
      this.InputChanged.Fire({ UserInputType: 'MouseMovement', Position: { x, y }, Delta: delta });
    };

    this._onMouseDown = e => {
      const type = e.button === 2 ? 'MouseButton2' : e.button === 1 ? 'MouseButton3' : 'MouseButton1';
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.InputBegan.Fire({ UserInputType: type, Position: { x, y } });
    };

    this._onMouseUp = e => {
      const type = e.button === 2 ? 'MouseButton2' : e.button === 1 ? 'MouseButton3' : 'MouseButton1';
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.InputEnded.Fire({ UserInputType: type, Position: { x, y } });
    };

    this._onTouchStart = e => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this._lastTouchPos = { x, y };
      this.InputBegan.Fire({ UserInputType: 'Touch', Position: { x, y }, Delta: { x: 0, y: 0 } });
    };

    this._onTouchMove = e => {
      const touch = e.touches && e.touches[0];
      if (!touch) return;
      const rect = this._canvas ? this._canvas.getBoundingClientRect() : { left: 0, top: 0 };
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const prev = this._lastTouchPos || { x, y };
      const delta = {
        x: (x - prev.x) * this._mouseDeltaSensitivity,
        y: (y - prev.y) * this._mouseDeltaSensitivity,
      };
      this._lastTouchPos = { x, y };
      this.InputChanged.Fire({ UserInputType: 'Touch', Position: { x, y }, Delta: delta });
    };

    this._onTouchEnd = () => {
      if (this._lastTouchPos) {
        const pos = this._lastTouchPos;
        this._lastTouchPos = null;
        this.InputEnded.Fire({ UserInputType: 'Touch', Position: pos, Delta: { x: 0, y: 0 } });
      }
    };

    this.AttachCanvas = canvas => {
      if (this._canvas) this.DetachCanvas();
      this._canvas = canvas;
      if (!canvas) return;
      canvas.tabIndex = 0;
      canvas.addEventListener('keydown', this._onKeyDown);
      canvas.addEventListener('keyup', this._onKeyUp);
      canvas.addEventListener('mousemove', this._onMouseMove);
      canvas.addEventListener('mousedown', this._onMouseDown);
      canvas.addEventListener('mouseup', this._onMouseUp);
      canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
      canvas.addEventListener('touchend', this._onTouchEnd, { passive: false });
    };

    this.DetachCanvas = () => {
      const canvas = this._canvas;
      if (!canvas) return;
      canvas.removeEventListener('keydown', this._onKeyDown);
      canvas.removeEventListener('keyup', this._onKeyUp);
      canvas.removeEventListener('mousemove', this._onMouseMove);
      canvas.removeEventListener('mousedown', this._onMouseDown);
      canvas.removeEventListener('mouseup', this._onMouseUp);
      canvas.removeEventListener('touchstart', this._onTouchStart);
      canvas.removeEventListener('touchmove', this._onTouchMove);
      canvas.removeEventListener('touchend', this._onTouchEnd);
      this._canvas = null;
    };

    this.GetMouseLocation = () => ({ ...this._mousePos });

    this.IsKeyDown = keyCode => this._keysDown.has(keyCode);
  }

  get MouseBehavior() {
    return this._mouseBehavior;
  }

  set MouseBehavior(value) {
    this._mouseBehavior = value;
    if (this._canvas) {
      if (value === 'LockCenter') {
        try {
          this._canvas.requestPointerLock && this._canvas.requestPointerLock();
        } catch (e) {
          /* noop */
        }
      } else {
        try {
          document.exitPointerLock && document.exitPointerLock();
        } catch (e) {
          /* noop */
        }
      }
    }
  }

  get MouseDeltaSensitivity() {
    return this._mouseDeltaSensitivity;
  }

  set MouseDeltaSensitivity(value) {
    this._mouseDeltaSensitivity = value;
  }
}

