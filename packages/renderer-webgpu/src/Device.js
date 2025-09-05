export async function createDevice(canvas) {
  if (!('gpu' in navigator)) {
    throw new Error('WebGPU not supported');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No GPU adapter');
  }
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const features = Array.from(device.features.values());
  const limits = { ...device.limits };

  function resize(w = canvas.clientWidth, h = canvas.clientHeight) {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(Math.floor(w * dpr), 1);
    const height = Math.max(Math.floor(h * dpr), 1);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    context.configure({
      device,
      format,
      alphaMode: 'opaque',
    });
  }

  resize();

  console.log('webgpu.features', features);
  console.log('webgpu.limits', limits);

  return { device, adapter, context, format, features, limits, resize };
}

export default createDevice;
