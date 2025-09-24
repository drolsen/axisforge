import { safeSize, recreateTex } from '../util/rt.js';

const wgsl = `
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  var p = array<vec2<f32>,6>(
    vec2<f32>(-1.0,-1.0), vec2<f32>( 1.0,-1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>( 1.0,-1.0), vec2<f32>( 1.0, 1.0)
  );
  var o: VSOut;
  o.pos = vec4<f32>(p[vid], 0.0, 1.0);
  o.uv  = p[vid] * 0.5 + vec2<f32>(0.5, 0.5);
  return o;
}

@group(0) @binding(0) var normalTex: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
  let _n = textureSample(normalTex, linearSampler, in.uv);
  return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
`;

let _pipeline = null;
let _target = null;
let _size = [0, 0];
let _sampler = null;
let _aoSampler = null;
let _bindGroup = null;
let _lastNormalView = null;
let _format = 'r8unorm';

export function enable(device, format = 'r8unorm', width = 1, height = 1) {
  if (_pipeline) {
    return;
  }
  _format = format;
  const module = device.createShaderModule({ code: wgsl });
  _pipeline = device.createRenderPipeline({
    label: 'SSAOPipeline', layout: 'auto',
    vertex: { module, entryPoint: 'vs_main' },
    fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  _sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  _aoSampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
  _bindGroup = null;
  resize(device, width, height);
}

export function resize(device, width, height) {
  if (!_pipeline) {
    return false;
  }
  const [w, h] = safeSize(device, width, height);
  if (_target && _size[0] === w && _size[1] === h) {
    return false;
  }
  _size = [w, h];
  _target = recreateTex(device, {
    label: 'SSAOTexture',
    size: [w, h],
    format: _format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  }, _target);
  return true;
}

export function disable() {
  if (_target?.texture) {
    try { _target.texture.destroy(); } catch { /* ignore */ }
  }
  _target = null;
  _pipeline = null;
  _sampler = null;
  _aoSampler = null;
  _bindGroup = null;
  _lastNormalView = null;
  _size = [0, 0];
}

export function render(device, encoder, normalView) {
  if (!_pipeline || !_target || !normalView) {
    return getResources();
  }
  if (_bindGroup && _lastNormalView !== normalView) {
    _bindGroup = null;
  }
  if (!_bindGroup) {
    _bindGroup = device.createBindGroup({
      layout: _pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: normalView },
        { binding: 1, resource: _sampler },
      ],
    });
    _lastNormalView = normalView;
  }
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: _target.view,
      loadOp: 'clear',
      storeOp: 'store',
      clearValue: { r: 1, g: 1, b: 1, a: 1 },
    }],
  });
  pass.setPipeline(_pipeline);
  pass.setBindGroup(0, _bindGroup);
  pass.draw(6);
  pass.end();
  return getResources();
}

export function getResources() {
  if (!_pipeline || !_target || !_aoSampler) {
    return null;
  }
  return {
    view: _target.view,
    sampler: _aoSampler,
    size: [..._size],
  };
}
