import assert from "node:assert/strict";
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalProcess = Object.getOwnPropertyDescriptor(globalThis, "process");
Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
Object.defineProperty(globalThis, "process", { configurable: true, value: undefined });
try {
  const { result } = await import("./dist/browser.mjs");
  assert.equal(result.mode, "test");
  assert.equal(result.appName, "artifact-client");
  assert.equal(result.apiUrl, "https://api.example.test");
  assert.equal(result.blocked, true);
  assert.deepEqual(result.keys.sort(), ["NODE_ENV", "VITE_API_URL", "VITE_APP_NAME"]);
} finally {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete globalThis.window;
  if (originalProcess) Object.defineProperty(globalThis, "process", originalProcess);
  else delete globalThis.process;
}
