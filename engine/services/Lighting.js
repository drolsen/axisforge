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

const DEFAULT_SHADOW_SETTINGS = {
  cascadeCount: 3,
  resolution: 2048,
  stabilize: true,
  lambda: 0.6,
  bias: 0.0025,
  normalBias: 0.5,
};

export default class Lighting {
  constructor() {
    this.enabled = true;
    this._shadowSettings = { ...DEFAULT_SHADOW_SETTINGS };
    this.sun = new DirectionalLight({
      cascades: this._shadowSettings.cascadeCount,
      lambda: this._shadowSettings.lambda,
      stabilize: this._shadowSettings.stabilize,
      resolution: this._shadowSettings.resolution,
    });
    this._camera = defaultCameraState();
    this._ambientColor = [0.03, 0.03, 0.03];
    this._ambientIntensity = 1.0;
    this._shadowResources = {
      texture: null,
      view: null,
      sampler: null,
      resolution: this._shadowSettings.resolution,
    };
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

  setShadowSettings(settings = {}) {
    if (!settings || typeof settings !== 'object') {
      return;
    }
    const next = { ...this._shadowSettings };
    if (settings.cascadeCount != null) {
      next.cascadeCount = Math.max(1, Math.min(4, Math.floor(settings.cascadeCount)));
    }
    if (settings.resolution != null && Number.isFinite(settings.resolution)) {
      next.resolution = Math.max(16, Math.floor(settings.resolution));
    }
    if (settings.lambda != null && Number.isFinite(settings.lambda)) {
      next.lambda = Math.min(Math.max(settings.lambda, 0), 1);
    }
    if (settings.stabilize != null) {
      next.stabilize = Boolean(settings.stabilize);
    }
    if (settings.bias != null && Number.isFinite(settings.bias)) {
      next.bias = settings.bias;
    }
    if (settings.normalBias != null && Number.isFinite(settings.normalBias)) {
      next.normalBias = settings.normalBias;
    }
    this._shadowSettings = next;
    this.sun.setShadowSettings({
      cascades: next.cascadeCount,
      lambda: next.lambda,
      stabilize: next.stabilize,
      resolution: next.resolution,
    });
    this._shadowResources = {
      ...this._shadowResources,
      resolution: next.resolution,
    };
  }

  getShadowSettings() {
    return { ...this._shadowSettings };
  }

  setShadowMapResources(resources = {}) {
    const { texture = null, view = null, sampler = null, resolution } = resources;
    this._shadowResources = {
      texture,
      view,
      sampler,
      resolution: Number.isFinite(resolution) ? resolution : this._shadowSettings.resolution,
    };
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
        shadow: {
          mapView: null,
          sampler: null,
          resolution: this._shadowSettings.resolution,
          settings: { ...this._shadowSettings },
        },
      };
    }
    return {
      ...sun,
      shadow: {
        mapView: this._shadowResources.view,
        sampler: this._shadowResources.sampler,
        resolution: this._shadowResources.resolution,
        settings: { ...this._shadowSettings },
      },
    };
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
