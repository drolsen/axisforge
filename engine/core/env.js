// Browser-safe environment helpers. NO Node-only globals.
export const nowMs = () => performance.now();

// Detect "dev" heuristically (no bundler env). Keep it simple & robust.
export const isDev =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "development") ||
  (typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1"));
