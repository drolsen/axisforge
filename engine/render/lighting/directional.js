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
    cascades = 4,
  } = {}) {
    this.direction = normalize(direction);
    this.color = [...color];
    this.intensity = intensity;

    this.csm = new CascadedShadowMaps({ cascades });
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

  update(camera) {
    if (!camera) {
      return;
    }

    const cascadeData = this.csm.update(camera, this.direction);

    cascadeData.forEach((cascade, index) => {
      console.log(
        `DirectionalLight CSM Cascade ${index}: split [${cascade.near.toFixed(3)}, ${cascade.far.toFixed(3)}]`
      );
      console.log('  View Matrix:', cascade.viewMatrix);
      console.log('  Projection Matrix:', cascade.projectionMatrix);
      console.log('  ViewProjection Matrix:', cascade.viewProjectionMatrix);
    });
  }

  getSunParams() {
    return {
      direction: [...this.direction],
      color: [...this.color],
      intensity: this.intensity,
      cascades: this.csm.cascades,
      cascadeData: this.csm.cascadeData,
    };
  }
}
