export default class Instance {
  constructor({ name = '', mesh = null, children = [], matrix = null } = {}) {
    this.name = name;
    this.mesh = mesh;
    this.children = children;
    this.matrix = matrix;
  }
}
