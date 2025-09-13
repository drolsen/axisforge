import Lighting from '../services/Lighting.js';
import CollectionService from '../services/CollectionService.js';
import TweenService from '../services/TweenService.js';
import UserInputService from '../services/UserInputService.js';
import RunService from '../services/RunService.js';
import { Signal } from './signal.js';
import { isValidAttribute } from './types.js';

class Instance {
  constructor(className = 'Instance') {
    this.ClassName = className;
    this.Name = className;
    this.Children = [];
    this.Attributes = new Map();
    this._parent = null;

    this.AncestryChanged = new Signal();
    this.ChildAdded = new Signal();
    this.ChildRemoved = new Signal();
    this.Changed = new Signal();
  }

  get Parent() {
    return this._parent;
  }

  set Parent(newParent) {
    this.setParent(newParent);
  }

  setParent(newParent) {
    if (this._parent === newParent) return;
    const oldParent = this._parent;
    if (oldParent) {
      const idx = oldParent.Children.indexOf(this);
      if (idx !== -1) oldParent.Children.splice(idx, 1);
      oldParent.ChildRemoved.Fire(this);
    }

    this._parent = newParent;
    this.Changed.Fire('Parent');

    if (newParent) {
      newParent.Children.push(this);
      newParent.ChildAdded.Fire(this);
    }

    const affected = [this, ...this.GetDescendants()];
    for (const inst of affected) {
      inst.AncestryChanged.Fire(inst, inst.Parent);
    }
  }

  setProperty(name, value) {
    if (this[name] === value) return;
    this[name] = value;
    this.Changed.Fire(name);
  }

  Add(child) {
    child.Parent = this;
  }

  Remove() {
    this.ClearAllChildren();
    this.Parent = null;
  }

  FindFirstChild(name) {
    return this.Children.find(c => c.Name === name) || null;
  }

  GetChildren() {
    return [...this.Children];
  }

  GetDescendants() {
    const result = [];
    const walk = obj => {
      for (const child of obj.Children) {
        result.push(child);
        walk(child);
      }
    };
    walk(this);
    return result;
  }

  SetAttribute(k, v) {
    if (!isValidAttribute(v)) throw new Error('Invalid attribute value');
    this.Attributes.set(k, v);
    this.Changed.Fire(k);
  }

  GetAttribute(k) {
    return this.Attributes.get(k);
  }

  GetAttributes() {
    return Object.fromEntries(this.Attributes.entries());
  }

  ClearAllChildren() {
    for (const child of [...this.Children]) {
      child.Parent = null;
    }
  }
}

const Services = new Map();

const lighting = new Instance('Lighting');
Object.assign(lighting, new Lighting());
Services.set('Lighting', lighting);

const collectionService = new Instance('CollectionService');
Object.assign(collectionService, new CollectionService());
Services.set('CollectionService', collectionService);

const tweenService = new Instance('TweenService');
Object.assign(tweenService, new TweenService());
Services.set('TweenService', tweenService);

const userInputService = new Instance('UserInputService');
const userInputImpl = new UserInputService();
Object.assign(userInputService, userInputImpl);
Object.defineProperty(userInputService, 'MouseBehavior', {
  get: () => userInputImpl.MouseBehavior,
  set: v => {
    userInputImpl.MouseBehavior = v;
  },
});
Object.defineProperty(userInputService, 'MouseDeltaSensitivity', {
  get: () => userInputImpl.MouseDeltaSensitivity,
  set: v => {
    userInputImpl.MouseDeltaSensitivity = v;
  },
});
Services.set('UserInputService', userInputService);

const runService = new Instance('RunService');
Object.assign(runService, new RunService());
Services.set('RunService', runService);

function GetService(name) {
  return Services.get(name);
}

export { Instance, Services, GetService };
