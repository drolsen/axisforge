import DirectionalLight from '../render/lighting/directional.js';

function defaultCameraState() {
  return {
    position: [0, 15, 35],
    direction: [0, -0.35, -1],
    up: [0, 1, 0],
    near: 0.1,
    far: 150,
    fov: Math.PI / 3,
    aspect: 16 / 9,
  };
}

export default class Lighting {
  constructor() {
    this.enabled = true;
    this.sun = new DirectionalLight();
    this._camera = defaultCameraState();
    this._ambientColor = [0.03, 0.03, 0.03];
    this._ambientIntensity = 1.0;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setSunDirection(direction) {
    this.sun.setDirection(direction);
  }

  setSunColor(color) {
    this.sun.setColor(color);
  }

  setSunIntensity(intensity) {
    this.sun.setIntensity(intensity);
  }

  setAmbientColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      this._ambientColor = [
        Number(color[0]) || 0,
        Number(color[1]) || 0,
        Number(color[2]) || 0,
      ];
    }
  }

  setAmbientIntensity(intensity) {
    if (typeof intensity === 'number') {
      if (Number.isFinite(intensity)) {
        this._ambientIntensity = Math.max(0, intensity);
      }
    }
  }

  setCameraState(camera) {
    this._camera = {
      ...this._camera,
      ...camera,
    };
  }

  getCameraState() {
    return {
      position: [...this._camera.position],
      direction: [...this._camera.direction],
      up: [...this._camera.up],
      near: this._camera.near,
      far: this._camera.far,
      fov: this._camera.fov,
      aspect: this._camera.aspect,
    };
  }

  update() {
    if (!this.enabled) {
      return;
    }

    this.sun.update(this._camera);
  }

  getSun() {
    const sun = this.sun.getSunParams();
    if (!this.enabled) {
      return {
        ...sun,
        intensity: 0,
      };
    }
    return sun;
  }

  getAmbient() {
    if (!this.enabled) {
      return {
        color: [0, 0, 0],
        intensity: 0,
      };
    }
    return {
      color: [...this._ambientColor],
      intensity: this._ambientIntensity,
    };
  }
}
