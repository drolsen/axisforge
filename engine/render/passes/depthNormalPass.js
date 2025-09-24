import { safeSize, recreateTex } from '../util/rt.js';

const wgsl = `
struct VSIn { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32> };
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) normal: vec3<f32> };
struct Camera { viewProj: mat4x4<f32> };
@group(0) @binding(0) var<uniform> uCamera: Camera;

@vertex
fn vs_main(input: VSIn) -> VSOut {
  var o: VSOut;
  o.pos = uCamera.viewProj * vec4<f32>(input.position, 1.0);
  o.normal = input.normal;
  return o;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  let n = normalize(input.normal) * 0.5 + vec3<f32>(0.5, 0.5, 0.5);
  return vec4<f32>(n, 1.0);
}
`;

let _pipeline = null;
let _targets = null;
let _size = [0, 0];
let _format = 'rgba8unorm';

export function enable(device, format = 'rgba8unorm', width = 1, height = 1) {
  if (_pipeline) {
    return;
  }
  _format = format;
  const module = device.createShaderModule({ code: wgsl });
  _pipeline = device.createRenderPipeline({
    label: 'DepthNormalPipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vs_main',
      buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
      ],
    },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'back' },
    depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
  });
  resize(device, width, height);
}

export function resize(device, width, height) {
  if (!_pipeline) {
    return false;
  }
  const [w, h] = safeSize(device, width, height);
  if (_targets && _size[0] === w && _size[1] === h) {
    return false;
  }
  _size = [w, h];
  _targets = {
    normal: recreateTex(device, {
      label: 'DepthNormalNormalTexture',
      size: [w, h],
      format: _format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }, _targets?.normal),
    depth: recreateTex(device, {
      label: 'DepthNormalDepthTexture',
      size: [w, h],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    }, _targets?.depth),
  };
  return true;
}

export function disable() {
  if (_targets?.normal?.texture) {
    try { _targets.normal.texture.destroy(); } catch { /* ignore */ }
  }
  if (_targets?.depth?.texture) {
    try { _targets.depth.texture.destroy(); } catch { /* ignore */ }
  }
  _targets = null;
  _pipeline = null;
  _size = [0, 0];
}

export function render(device, encoder) {
  if (!_pipeline || !_targets) {
    return null;
  }
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: _targets.normal.view,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 0.5, g: 0.5, b: 1.0, a: 1.0 },
    }],
    depthStencilAttachment: {
      view: _targets.depth.view,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
      depthClearValue: 1.0,
    },
  });
  pass.setPipeline(_pipeline);
  // TODO: bind camera UBO + draw meshes here
  pass.end();
  return getResources();
}

export function getResources() {
  if (!_pipeline || !_targets) {
    return null;
  }
  return {
    normalView: _targets.normal.view,
    depthView: _targets.depth.view,
    size: [..._size],
  };
}
