import { defineConfig } from "vite-plus/test/config";
import { workspaceTests } from "./test.config.js";

const config = workspaceTests();
export default defineConfig({
  ...config,
  test: { ...config.test, include: ["scripts/**/*.test.ts"] },
});
