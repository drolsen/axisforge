import DirectionalLight from '../render/lighting/directional.js';
import { nowMs } from '../core/env.js';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpVec3(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function saturate(value) {
  return clamp(value, 0, 1);
}

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
    this._ambientComputedColor = [...this._ambientColor];
    this._ambientComputedIntensity = this._ambientIntensity;
    this._ambientOverrideColor = null;
    this._ambientOverrideIntensity = null;
    this._timeOfDay = 14;
    this._timeAnimating = false;
    this._timeSpeed = 0.05; // hours per second
    this._lastUpdateSeconds = nowMs() / 1000;
    this._sunDirection = [0, -1, 0];
    this._sunColor = [1, 1, 1];
    this._sunIntensity = 3.5;
    this._sunAzimuth = 0;
    this._sunElevation = 0;
    this._turbidity = 2.5;
    this._groundAlbedo = [0.2, 0.2, 0.2];
    this._shadowResources = {
      texture: null,
      view: null,
      sampler: null,
      resolution: this._shadowSettings.resolution,
    };
    this._updateFromTimeOfDay();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }

  setSunDirection(direction) {
    if (Array.isArray(direction) && direction.length >= 3) {
      this._sunDirection = [direction[0], direction[1], direction[2]];
      this.sun.setDirection(direction);
    }
  }

  setSunColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      this._sunColor = [color[0], color[1], color[2]];
      this.sun.setColor(color);
    }
  }

  setSunIntensity(intensity) {
    if (Number.isFinite(intensity)) {
      this._sunIntensity = Math.max(0, intensity);
      this.sun.setIntensity(this._sunIntensity);
    }
  }

  setAmbientColor(color) {
    if (Array.isArray(color) && color.length >= 3) {
      this._ambientOverrideColor = [
        Number(color[0]) || 0,
        Number(color[1]) || 0,
        Number(color[2]) || 0,
      ];
      this._ambientColor = [...this._ambientOverrideColor];
    }
  }

  setAmbientIntensity(intensity) {
    if (typeof intensity === 'number') {
      if (Number.isFinite(intensity)) {
        this._ambientOverrideIntensity = Math.max(0, intensity);
        this._ambientIntensity = this._ambientOverrideIntensity;
      }
    }
  }

  setTimeOfDay(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    let hours = value % 24;
    if (hours < 0) {
      hours += 24;
    }
    this._timeOfDay = hours;
    this._updateFromTimeOfDay();
  }

  getTimeOfDay() {
    return this._timeOfDay;
  }

  setTimeAnimating(enabled) {
    this._timeAnimating = Boolean(enabled);
  }

  isTimeAnimating() {
    return this._timeAnimating;
  }

  setTimeSpeed(hoursPerSecond) {
    if (Number.isFinite(hoursPerSecond)) {
      this._timeSpeed = hoursPerSecond;
    }
  }

  getTimeSpeed() {
    return this._timeSpeed;
  }

  setTurbidity(value) {
    if (!Number.isFinite(value)) {
      return;
    }
    this._turbidity = clamp(value, 1.0, 12.0);
  }

  getTurbidity() {
    return this._turbidity;
  }

  setGroundAlbedo(value) {
    if (Array.isArray(value) && value.length >= 3) {
      this._groundAlbedo = [
        clamp(Number(value[0]) || 0, 0, 1),
        clamp(Number(value[1]) || 0, 0, 1),
        clamp(Number(value[2]) || 0, 0, 1),
      ];
    } else if (Number.isFinite(value)) {
      const v = clamp(value, 0, 1);
      this._groundAlbedo = [v, v, v];
    }
  }

  getGroundAlbedo() {
    return [...this._groundAlbedo];
  }

  getSunAngles() {
    return {
      azimuth: this._sunAzimuth,
      elevation: this._sunElevation,
    };
  }

  getSkyState() {
    return {
      timeOfDay: this._timeOfDay,
      azimuth: this._sunAzimuth,
      elevation: this._sunElevation,
      turbidity: this._turbidity,
      groundAlbedo: [...this._groundAlbedo],
      sunDirection: [...this._sunDirection],
      sunColor: [...this._sunColor],
      sunIntensity: this._sunIntensity,
    };
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

    const now = nowMs() / 1000;
    const dt = now - this._lastUpdateSeconds;
    this._lastUpdateSeconds = now;
    if (this._timeAnimating && Number.isFinite(dt) && dt > 0) {
      const deltaHours = dt * this._timeSpeed;
      if (Number.isFinite(deltaHours)) {
        this._timeOfDay = (this._timeOfDay + deltaHours) % 24;
        if (this._timeOfDay < 0) {
          this._timeOfDay += 24;
        }
      }
    }

    this._updateFromTimeOfDay();
    this.sun.update(this._camera);
  }

  _updateFromTimeOfDay() {
    const dayFraction = (this._timeOfDay % 24) / 24;
    const solarAngle = (dayFraction - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(solarAngle);
    const elevation = sunHeight * (Math.PI / 2);
    const azimuth = dayFraction * Math.PI * 2;
    const cosElevation = Math.cos(elevation);

    const direction = [
      Math.sin(azimuth) * cosElevation,
      Math.sin(elevation),
      Math.cos(azimuth) * cosElevation,
    ];

    const daylight = saturate((sunHeight + 0.02) * 0.5 + 0.5);
    const twilight = saturate(1.0 - (sunHeight + 0.1) / 0.2);

    const warmColor = [1.05, 0.55, 0.35];
    const coolColor = [1.0, 0.98, 0.94];
    const eveningColor = [1.2, 0.64, 0.3];
    const baseSun = lerpVec3(warmColor, coolColor, Math.pow(daylight, 0.35));
    const sunColor = lerpVec3(baseSun, eveningColor, twilight * (1.0 - daylight));

    const lightFactor = Math.max(0, sunHeight + 0.03);
    const intensityBase = Math.pow(lightFactor, 1.2);
    const sunIntensity = lightFactor > 0 ? 18 * intensityBase + 2.5 * intensityBase * intensityBase : 0;

    const nightAmbient = [0.015, 0.02, 0.05];
    const dayAmbient = [0.35, 0.38, 0.45];
    const ambientColor = lerpVec3(nightAmbient, dayAmbient, Math.pow(daylight, 0.45));
    const ambientIntensity = lerp(0.05, 1.1, Math.pow(daylight, 0.55));

    this._sunDirection = direction;
    this._sunColor = sunColor;
    this._sunIntensity = sunIntensity;
    this._sunElevation = elevation;
    this._sunAzimuth = azimuth;
    this.sun.setDirection(direction);
    this.sun.setColor(sunColor);
    this.sun.setIntensity(sunIntensity);

    this._ambientComputedColor = ambientColor;
    this._ambientComputedIntensity = ambientIntensity;
    this._ambientColor = this._ambientOverrideColor ? [...this._ambientOverrideColor] : [...ambientColor];
    this._ambientIntensity = this._ambientOverrideIntensity ?? ambientIntensity;
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

  get TimeOfDay() {
    return this.getTimeOfDay();
  }

  set TimeOfDay(value) {
    this.setTimeOfDay(value);
  }

  get SunAzimuth() {
    return this._sunAzimuth;
  }

  get SunElevation() {
    return this._sunElevation;
  }

  get AmbientColor() {
    return [...this._ambientColor];
  }

  get AmbientIntensity() {
    return this._ambientIntensity;
  }
}
