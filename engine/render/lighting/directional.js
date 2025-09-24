import CascadedShadowMaps from './csm.js';

const DEFAULT_DIRECTION = [0, -1, 0];
const DEFAULT_COLOR = [1, 0.956, 0.839];
const DEFAULT_INTENSITY = 3.5;

function normalize(vec) {
  const length = Math.hypot(vec[0], vec[1], vec[2]);
  if (length === 0) {
    return [...DEFAULT_DIRECTION];
  }
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

export default class DirectionalLight {
  constructor({
    direction = DEFAULT_DIRECTION,
    color = DEFAULT_COLOR,
    intensity = DEFAULT_INTENSITY,
    cascades = 3,
    lambda = 0.5,
    stabilize = true,
    resolution = 2048,
  } = {}) {
    this.direction = normalize(direction);
    this.color = [...color];
    this.intensity = intensity;

    this.shadowSettings = {
      cascades,
      lambda,
      stabilize,
      resolution,
    };

    this.csm = new CascadedShadowMaps({
      cascades,
      lambda,
      stabilize,
      resolution,
    });
  }

  setDirection(vec) {
    this.direction = normalize(vec);
  }

  setColor(color) {
    this.color = [...color];
  }

  setIntensity(value) {
    this.intensity = value;
  }

  setShadowSettings(settings = {}) {
    if (!settings || typeof settings !== 'object') {
      return;
    }
    const next = { ...this.shadowSettings };
    if (settings.cascades != null) {
      next.cascades = settings.cascades;
    }
    if (settings.lambda != null) {
      next.lambda = settings.lambda;
    }
    if (settings.stabilize != null) {
      next.stabilize = settings.stabilize;
    }
    if (settings.resolution != null) {
      next.resolution = settings.resolution;
    }
    this.shadowSettings = next;
    this.csm.setCascadeCount(next.cascades);
    this.csm.setLambda(next.lambda);
    this.csm.setStabilize(next.stabilize);
    this.csm.setResolution(next.resolution);
  }

  update(camera) {
    if (!camera) {
      return;
    }

    this.csm.update(camera, this.direction);
  }

  getSunParams() {
    return {
      direction: [...this.direction],
      color: [...this.color],
      intensity: this.intensity,
      cascades: this.csm.cascades,
      cascadeData: this.csm.cascadeData,
      shadowSettings: { ...this.shadowSettings },
    };
  }
}
