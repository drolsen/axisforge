const now = () => {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
};

const frameStats = {
  fps: 0,
  cpuFrameTime: 0,
  gpuAdapterName: '',
  totalDrawCalls: 0,
  passes: {},
  renderCpuTime: 0,
  meshInstances: {
    total: 0,
    visible: 0,
    culled: 0,
  },
};

let frameStartTime = 0;

export function beginFrame() {
  frameStartTime = now();
  frameStats.totalDrawCalls = 0;
  frameStats.passes = {};
  frameStats.meshInstances.total = 0;
  frameStats.meshInstances.visible = 0;
  frameStats.meshInstances.culled = 0;
}

export function endFrame() {
  frameStats.renderCpuTime = now() - frameStartTime;
}

export function markPass(name) {
  const passName = name || 'Pass';
  if (!frameStats.passes[passName]) {
    frameStats.passes[passName] = { drawCalls: 0 };
  }
}

export function recordDrawCall(name, count = 1) {
  const passName = name || 'Pass';
  markPass(passName);
  frameStats.passes[passName].drawCalls += count;
  frameStats.totalDrawCalls += count;
}

export function setMeshInstanceStats({ total = 0, visible = 0, culled = 0 } = {}) {
  frameStats.meshInstances.total = total;
  frameStats.meshInstances.visible = visible;
  frameStats.meshInstances.culled = culled;
}

export function updateFrameMetrics(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return;
  }

  const fps = 1 / deltaSeconds;
  const frameTimeMs = deltaSeconds * 1000;

  if (frameStats.fps === 0) {
    frameStats.fps = fps;
    frameStats.cpuFrameTime = frameTimeMs;
  } else {
    const smoothing = 0.9;
    frameStats.fps = frameStats.fps * smoothing + fps * (1 - smoothing);
    frameStats.cpuFrameTime = frameStats.cpuFrameTime * smoothing + frameTimeMs * (1 - smoothing);
  }
}

export function setGPUAdapterName(name) {
  frameStats.gpuAdapterName = name || '';
}

export function getFrameStats() {
  return frameStats;
}
