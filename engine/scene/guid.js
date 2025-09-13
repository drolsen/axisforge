import { randomUUID } from 'node:crypto';

// Generate a stable GUID for scene nodes. Uses Node's crypto API to
// produce a UUID v4 string. Keeping this in a module allows swapping
// implementations later without touching callers.
export function guid() {
  return randomUUID();
}

export default guid;
