let _cache = null;

function makeTex(device, format, dataUint8, usage = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST) {
  const texture = device.createTexture({
    size: [1, 1, 1],
    format,
    usage,
    dimension: '2d',
  });
  device.queue.writeTexture(
    { texture },
    dataUint8,
    { bytesPerRow: dataUint8.byteLength, rowsPerImage: 1 },
    { width: 1, height: 1, depthOrArrayLayers: 1 },
  );
  return texture.createView();
}

export function ensureDefaultMaterialResources(device) {
  if (_cache && _cache.device === device) {
    return _cache;
  }

  _cache = null;

  const whiteSRGB = new Uint8Array([255, 255, 255, 255]);
  const blackSRGB = new Uint8Array([0, 0, 0, 255]);
  const normalLin = new Uint8Array([128, 128, 255, 255]);
  const aoLin = new Uint8Array([255, 255, 255, 255]);
  const mrLin = new Uint8Array([0, 255, 255, 255]);

  const baseColorView = makeTex(device, 'rgba8unorm-srgb', whiteSRGB);
  const emissiveView = makeTex(device, 'rgba8unorm-srgb', blackSRGB);
  const normalView = makeTex(device, 'rgba8unorm', normalLin);
  const occlusionView = makeTex(device, 'rgba8unorm', aoLin);
  const metallicRoughView = makeTex(device, 'rgba8unorm', mrLin);

  const linearSampler = device.createSampler({
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  });
  const repeatSampler = device.createSampler({
    addressModeU: 'repeat',
    addressModeV: 'repeat',
    minFilter: 'linear',
    magFilter: 'linear',
    mipmapFilter: 'linear',
  });

  _cache = {
    device,
    baseColorView,
    emissiveView,
    normalView,
    occlusionView,
    metallicRoughView,
    linearSampler,
    repeatSampler,
  };
  return _cache;
}
