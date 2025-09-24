import { Instance } from '../../engine/core/index.js';
import Lighting from '../../engine/services/Lighting.js';
import CollectionService from '../../engine/services/CollectionService.js';
import TweenService from '../../engine/services/TweenService.js';
import UserInputService from '../../engine/services/UserInputService.js';
import { RunService } from '../../engine/services/RunService.js';
import PhysicsService from '../../engine/services/PhysicsService.js';
import { Signal } from '../../engine/core/signal.js';
import { deserialize } from '../../engine/scene/deserialize.js';

const DEFAULT_SCENE = {
  guid: 'axisforge-default-root',
  className: 'DataModel',
  name: 'Game',
  properties: {},
  attributes: {},
  children: [
    {
      guid: 'axisforge-default-workspace',
      className: 'Workspace',
      name: 'Workspace',
      properties: {},
      attributes: {},
      children: [],
    },
  ],
};

const DEFAULT_SERVICE_NAMES = [
  'Workspace',
  'Players',
  'ReplicatedStorage',
  'ServerStorage',
  'StarterPlayer',
  'StarterGui',
  'StarterPack',
  'StarterCharacterScripts',
  'StarterPlayerScripts',
  'SoundService',
  'GuiService',
  'ReplicatedFirst',
  'DataModel',
];

let playSession = null;
const listeners = new Set();

function getGlobal() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  return {};
}

function notifyState() {
  const state = isPlaying();
  for (const listener of [...listeners]) {
    try {
      listener(state);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }
}

function normalizeSceneData(data) {
  if (!data) return null;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch (err) {
    return null;
  }
}

function resolveSceneJSON() {
  const globalObj = getGlobal();
  const keys = [
    '__AXISFORGE_SCENE_JSON__',
    '__AXISFORGE_SCENE__',
    '__AXISFORGE_CURRENT_SCENE__',
  ];

  for (const key of keys) {
    if (key in globalObj) {
      const json = normalizeSceneData(globalObj[key]);
      if (json) return json;
    }
  }

  if (globalObj.localStorage && typeof globalObj.localStorage.getItem === 'function') {
    const stored = globalObj.localStorage.getItem('axisforge.scene');
    const normalized = normalizeSceneData(stored);
    if (normalized) return normalized;
  }

  return JSON.stringify(DEFAULT_SCENE);
}

function createServiceRegistry() {
  const services = new Map();

  const register = (name, implFactory) => {
    const inst = new Instance(name);
    if (typeof implFactory === 'function') {
      const impl = implFactory();
      Object.assign(inst, impl);
      if (name === 'UserInputService') {
        Object.defineProperty(inst, 'MouseBehavior', {
          get: () => impl.MouseBehavior,
          set: value => {
            impl.MouseBehavior = value;
          },
        });
        Object.defineProperty(inst, 'MouseDeltaSensitivity', {
          get: () => impl.MouseDeltaSensitivity,
          set: value => {
            impl.MouseDeltaSensitivity = value;
          },
        });
      }
    }
    services.set(name, inst);
    return inst;
  };

  register('Lighting', () => new Lighting());
  register('CollectionService', () => new CollectionService());
  register('TweenService', () => new TweenService());

  const userInputImpl = new UserInputService();
  const userInputService = new Instance('UserInputService');
  Object.assign(userInputService, userInputImpl);
  Object.defineProperty(userInputService, 'MouseBehavior', {
    get: () => userInputImpl.MouseBehavior,
    set: value => {
      userInputImpl.MouseBehavior = value;
    },
  });
  Object.defineProperty(userInputService, 'MouseDeltaSensitivity', {
    get: () => userInputImpl.MouseDeltaSensitivity,
    set: value => {
      userInputImpl.MouseDeltaSensitivity = value;
    },
  });
  services.set('UserInputService', userInputService);

  const runService = new RunService.constructor();
  runService.Name = 'RunService';
  runService.ClassName = 'RunService';
  services.set('RunService', runService);

  const physicsService = new PhysicsService();
  const physicsInstance = new Instance('PhysicsService');
  Object.assign(physicsInstance, physicsService);
  services.set('PhysicsService', physicsInstance);

  for (const name of DEFAULT_SERVICE_NAMES) {
    if (!services.has(name)) {
      services.set(name, new Instance(name));
    }
  }

  return {
    services,
    runService,
    userInputService,
  };
}

function createRuntime(sceneJSON) {
  const registry = createServiceRegistry();
  const getService = name => registry.services.get(name) || null;

  const root = deserialize(sceneJSON, { getService });
  if (root && root.ClassName && !registry.services.has(root.ClassName)) {
    registry.services.set(root.ClassName, root);
  }

  return {
    ...registry,
    getService,
    root,
    sceneJSON,
  };
}

function patchConsole() {
  if (typeof console === 'undefined') return () => {};
  const previous = console.log;
  if (typeof previous !== 'function') return () => {};
  console.log = (...args) => {
    previous.call(console, '[PLAY]', ...args);
  };
  return () => {
    console.log = previous;
  };
}

function startRunLoop(runService) {
  if (!runService || typeof runService._step !== 'function') return null;

  const step = () => {
    try {
      runService._step();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PLAY] RunService loop error', err);
    }
  };

  if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
    let rafId = null;
    const frame = () => {
      step();
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }

  const interval = setInterval(step, 1000 / 60);
  return () => clearInterval(interval);
}

function registerCleanup(result, session) {
  if (!result) return;
  if (typeof result === 'function') {
    session.cleanup.push(result);
  } else if (typeof result.dispose === 'function') {
    session.cleanup.push(() => result.dispose());
  } else if (typeof result.stop === 'function') {
    session.cleanup.push(() => result.stop());
  }
}

function executeClientModule(session, code) {
  if (!code || !code.trim()) return;

  const axisforge = session.runtimeAPI;
  const module = { exports: {} };
  const exports = module.exports;
  const require = () => {
    throw new Error('require() is not available in play mode.');
  };

  const fn = new Function('module', 'exports', 'require', 'axisforge', 'scene', code);
  fn(module, exports, require, axisforge, axisforge.scene);

  const exported = module.exports;
  if (typeof exported === 'function') {
    registerCleanup(exported(axisforge), session);
    return;
  }

  const candidates = [
    exported && exported.default,
    exported && exported.main,
    exported && exported.start,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      registerCleanup(candidate(axisforge), session);
      return;
    }
  }
}

async function runClientScript(session) {
  if (typeof fetch !== 'function') return;
  try {
    const response = await fetch('main.client.js', { cache: 'no-store' });
    if (!response.ok) return;
    const code = await response.text();
    executeClientModule(session, code);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PLAY] Failed to load main.client.js', err);
    throw err;
  }
}

function buildRuntimeAPI(runtime, session) {
  const api = {
    Instance,
    Signal,
    GetService: runtime.getService,
    services: runtime.services,
    scene: runtime.root,
    root: runtime.root,
    sceneJSON: runtime.sceneJSON,
    stop: () => stopPlay(),
    onStop(fn) {
      if (typeof fn !== 'function') return () => {};
      session.cleanup.push(fn);
      return () => {
        const idx = session.cleanup.indexOf(fn);
        if (idx !== -1) {
          session.cleanup.splice(idx, 1);
        }
      };
    },
  };
  api.addCleanup = api.onStop;
  return api;
}

export function isPlaying() {
  return Boolean(playSession);
}

export function onPlayStateChange(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function startPlay() {
  if (playSession) return playSession.runtimeAPI;

  const sceneJSON = resolveSceneJSON();
  const runtime = createRuntime(sceneJSON);
  const session = {
    runtime,
    cleanup: [],
    afterCleanup: [],
    loopCleanup: null,
    consoleRestore: null,
    runtimeAPI: null,
  };

  session.runtimeAPI = buildRuntimeAPI(runtime, session);
  const globalObj = getGlobal();
  const previousAxisforge = globalObj.axisforge;
  globalObj.axisforge = session.runtimeAPI;
  session.afterCleanup.push(() => {
    if (previousAxisforge === undefined) {
      delete globalObj.axisforge;
    } else {
      globalObj.axisforge = previousAxisforge;
    }
  });

  session.consoleRestore = patchConsole();
  if (session.consoleRestore) {
    session.afterCleanup.push(() => session.consoleRestore && session.consoleRestore());
  }

  const runLoopCleanup = startRunLoop(runtime.getService('RunService'));
  if (runLoopCleanup) {
    session.loopCleanup = runLoopCleanup;
  }

  const userInput = runtime.getService('UserInputService');
  if (userInput && typeof userInput.AttachCanvas === 'function' && typeof document !== 'undefined') {
    const canvas = document.getElementById('viewport');
    if (canvas) {
      userInput.AttachCanvas(canvas);
      session.afterCleanup.push(() => {
        if (typeof userInput.DetachCanvas === 'function') {
          userInput.DetachCanvas();
        }
      });
    }
  }

  playSession = session;
  notifyState();

  try {
    await runClientScript(session);
    return session.runtimeAPI;
  } catch (err) {
    stopPlay();
    throw err;
  }
}

export function stopPlay() {
  if (!playSession) return;
  const session = playSession;
  playSession = null;

  if (typeof session.loopCleanup === 'function') {
    try {
      session.loopCleanup();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PLAY] Error stopping loop', err);
    }
  }

  for (const fn of [...session.cleanup].reverse()) {
    try {
      fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PLAY] Cleanup error', err);
    }
  }
  session.cleanup.length = 0;

  for (const fn of [...session.afterCleanup].reverse()) {
    try {
      fn();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PLAY] Teardown error', err);
    }
  }
  session.afterCleanup.length = 0;

  notifyState();
}

export default {
  startPlay,
  stopPlay,
  isPlaying,
  onPlayStateChange,
};

