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
    return this.sun.getSunParams();
  }
}
