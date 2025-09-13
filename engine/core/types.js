function isVector3(v) {
  return v && typeof v === 'object'
    && typeof v.x === 'number'
    && typeof v.y === 'number'
    && typeof v.z === 'number';
}

function isColor3(v) {
  return v && typeof v === 'object'
    && typeof v.r === 'number' && v.r >= 0 && v.r <= 1
    && typeof v.g === 'number' && v.g >= 0 && v.g <= 1
    && typeof v.b === 'number' && v.b >= 0 && v.b <= 1;
}

function isJSONSerializable(v) {
  try {
    JSON.stringify(v);
    return true;
  } catch {
    return false;
  }
}

function isValidAttribute(v) {
  const type = typeof v;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (isVector3(v) || isColor3(v)) return true;
  return isJSONSerializable(v);
}

export { isVector3, isColor3, isValidAttribute };
