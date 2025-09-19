const FLOAT_SIZE = 4;
const STANDARD_PBR_FLOATS = 8;
const STANDARD_PBR_BUFFER_SIZE = STANDARD_PBR_FLOATS * FLOAT_SIZE;

export const STANDARD_PBR_BINDINGS = {
  UNIFORM: 0,
  ALBEDO_TEXTURE: 1,
  ALBEDO_SAMPLER: 2,
  NORMAL_TEXTURE: 3,
  NORMAL_SAMPLER: 4,
  ORM_TEXTURE: 5,
  ORM_SAMPLER: 6
};

export function createStandardPBRLayout(device) {
  return device.createBindGroupLayout({
    label: 'StandardPBRMaterialLayout',
    entries: [
      { binding: STANDARD_PBR_BINDINGS.UNIFORM, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.ORM_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.ORM_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
    ]
  });
}

export function allocateStandardPBRUniform(device, material) {
  const data = material.toUniformArray(new Float32Array(STANDARD_PBR_FLOATS));
  const buffer = device.createBuffer({
    size: STANDARD_PBR_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: 'StandardPBRMaterialUniform'
  });
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return { buffer, data, size: STANDARD_PBR_BUFFER_SIZE };
}

export function updateStandardPBRUniform(device, uniform, material) {
  material.toUniformArray(uniform.data);
  device.queue.writeBuffer(uniform.buffer, 0, uniform.data.buffer, uniform.data.byteOffset, uniform.data.byteLength);
}

export function describeStandardPBRBindings(material, uniform) {
  const { albedo, normal, orm } = material.maps;
  return {
    label: 'StandardPBRMaterial',
    entries: [
      { binding: STANDARD_PBR_BINDINGS.UNIFORM, resource: { buffer: uniform.buffer } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_TEXTURE, resource: albedo.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_SAMPLER, resource: albedo.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_TEXTURE, resource: normal.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_SAMPLER, resource: normal.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.ORM_TEXTURE, resource: orm.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.ORM_SAMPLER, resource: orm.sampler ?? null }
    ]
  };
}

export function createStandardPBRBindGroup(device, layout, descriptor) {
  if (!layout) {
    throw new Error('A bind group layout is required to create a Standard PBR bind group.');
  }
  const ready = descriptor.entries.every(entry => entry.resource !== null);
  if (!ready) {
    console.debug('[Materials] Standard PBR bind group incomplete, awaiting texture or sampler resources.');
    return null;
  }
  const entries = descriptor.entries.map(entry => ({
    binding: entry.binding,
    resource: entry.resource
  }));
  return device.createBindGroup({
    label: descriptor.label,
    layout,
    entries
  });
}
