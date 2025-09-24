let device = null;

export function setDevice(gpuDevice) {
  device = gpuDevice || null;
}

export function getDevice() {
  if (!device) {
    throw new Error('GPU device has not been initialized. Call initWebGPU() first.');
  }
  return device;
}

export function tryGetDevice() {
  return device;
}
