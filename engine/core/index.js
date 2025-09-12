import Lighting from '../services/Lighting.js';

export class Instance {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.parent = null;
  }
  Add(child) {
    child.parent = this;
    this.children.push(child);
  }
}

const Services = new Map();
Services.set('Lighting', new Lighting());

export function GetService(name) {
  return Services.get(name);
}

export { Services };
