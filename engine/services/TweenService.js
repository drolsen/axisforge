import { Signal } from '../core/signal.js';
import { applyEasing } from './easing.js';

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const raf = globalThis.requestAnimationFrame || (cb => setTimeout(() => cb(now()), 16));
const caf = globalThis.cancelAnimationFrame || clearTimeout;

class Tween {
  constructor(instance, info, goals) {
    this.Instance = instance;
    this.Info = {
      Time: info.Time,
      EasingStyle: info.EasingStyle || 'Linear',
      EasingDirection: info.EasingDirection || 'In',
      DelayTime: info.DelayTime || 0,
      RepeatCount: info.RepeatCount || 0,
      Reverses: info.Reverses || false,
    };
    this.PropertyGoals = {};
    this._initial = {};
    for (const [prop, goal] of Object.entries(goals)) {
      const start = instance[prop];
      if (typeof start === 'number' && typeof goal === 'number') {
        this._initial[prop] = start;
        this.PropertyGoals[prop] = goal;
      }
    }
    this.Completed = new Signal();
    this.State = 'Idle';
    this._rafId = null;
    this._startTime = null;
    this._elapsed = 0;
    this._remaining = this.Info.RepeatCount;
    this._directionForward = true;
  }

  _schedule() {
    this._rafId = raf(ts => this._update(ts));
  }

  Play() {
    if (this.State === 'playing') return;
    if (this._rafId) caf(this._rafId);
    this.State = 'playing';
    this._startTime = null;
    this._elapsed = 0;
    this._remaining = this.Info.RepeatCount;
    this._directionForward = true;
    for (const prop in this._initial) {
      this.Instance.setProperty(prop, this._initial[prop]);
    }
    this._schedule();
  }

  Pause() {
    if (this.State !== 'playing') return;
    this.State = 'paused';
    if (this._rafId) {
      caf(this._rafId);
      this._rafId = null;
    }
    this._elapsed = now() - this._startTime;
  }

  Resume() {
    if (this.State !== 'paused') return;
    this.State = 'playing';
    this._startTime = now() - this._elapsed;
    this._schedule();
  }

  Cancel() {
    if (this._rafId) {
      caf(this._rafId);
      this._rafId = null;
    }
    this.State = 'canceled';
    for (const prop in this._initial) {
      this.Instance.setProperty(prop, this._initial[prop]);
    }
  }

  _update(timestamp) {
    if (this.State !== 'playing') return;
    if (this._startTime === null) {
      this._startTime = timestamp + this.Info.DelayTime * 1000;
    }
    const elapsed = timestamp - this._startTime;
    if (elapsed < 0) {
      this._schedule();
      return;
    }
    this._elapsed = elapsed;
    const duration = this.Info.Time * 1000;
    let progress = Math.min(elapsed / duration, 1);
    const eased = applyEasing(this.Info.EasingStyle, this.Info.EasingDirection, progress);
    for (const prop in this.PropertyGoals) {
      const start = this._directionForward ? this._initial[prop] : this.PropertyGoals[prop];
      const end = this._directionForward ? this.PropertyGoals[prop] : this._initial[prop];
      const value = start + (end - start) * eased;
      this.Instance.setProperty(prop, value);
    }
    if (progress < 1) {
      this._schedule();
    } else {
      if (this._remaining === -1 || this._remaining > 0) {
        if (this._remaining > 0) this._remaining--;
        if (this.Info.Reverses) this._directionForward = !this._directionForward;
        this._startTime = timestamp;
        this._elapsed = 0;
        this._schedule();
      } else {
        this.State = 'completed';
        this.Completed.Fire(this);
      }
    }
  }
}

export default class TweenService {
  constructor() {
    this.Create = (instance, info, goals) => new Tween(instance, info, goals);
  }
}

