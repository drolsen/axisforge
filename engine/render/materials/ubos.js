const FLOAT_SIZE = 4;
const STANDARD_PBR_FLOATS = 12;
const STANDARD_PBR_BUFFER_SIZE = STANDARD_PBR_FLOATS * FLOAT_SIZE;

export const STANDARD_PBR_BINDINGS = {
  UNIFORM: 0,
  ALBEDO_TEXTURE: 1,
  ALBEDO_SAMPLER: 2,
  METALLIC_ROUGHNESS_TEXTURE: 3,
  METALLIC_ROUGHNESS_SAMPLER: 4,
  NORMAL_TEXTURE: 5,
  NORMAL_SAMPLER: 6,
  OCCLUSION_TEXTURE: 7,
  OCCLUSION_SAMPLER: 8,
  EMISSIVE_TEXTURE: 9,
  EMISSIVE_SAMPLER: 10,
};

export function createStandardPBRLayout(device) {
  return device.createBindGroupLayout({
    label: 'StandardPBRMaterialLayout',
    entries: [
      { binding: STANDARD_PBR_BINDINGS.UNIFORM, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_TEXTURE, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_SAMPLER, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
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
  const { albedo, metallicRoughness, normal, occlusion, emissive } = material.maps;
  return {
    label: 'StandardPBRMaterial',
    entries: [
      { binding: STANDARD_PBR_BINDINGS.UNIFORM, resource: { buffer: uniform.buffer } },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_TEXTURE, resource: albedo.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.ALBEDO_SAMPLER, resource: albedo.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_TEXTURE, resource: metallicRoughness.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.METALLIC_ROUGHNESS_SAMPLER, resource: metallicRoughness.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_TEXTURE, resource: normal.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.NORMAL_SAMPLER, resource: normal.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_TEXTURE, resource: occlusion.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.OCCLUSION_SAMPLER, resource: occlusion.sampler ?? null },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_TEXTURE, resource: emissive.texture ?? null },
      { binding: STANDARD_PBR_BINDINGS.EMISSIVE_SAMPLER, resource: emissive.sampler ?? null },
    ]
  };
}

export function createStandardPBRBindGroup(device, layout, descriptor, fallbacks = {}) {
  if (!layout) {
    throw new Error('A bind group layout is required to create a Standard PBR bind group.');
  }
  const entries = descriptor.entries.map(entry => ({
    binding: entry.binding,
    resource: entry.resource ?? fallbacks[entry.binding]
  }));
  if (entries.some(entry => entry.resource == null)) {
    throw new Error('Missing resources for Standard PBR bind group.');
  }
  return device.createBindGroup({
    label: descriptor.label,
    layout,
    entries
  });
}
