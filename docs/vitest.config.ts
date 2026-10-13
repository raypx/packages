import { workspaceTests } from "../test.config.js";

const config = workspaceTests();

export default {
  ...config,
  test: { ...config.test, include: ["scripts/**/*.test.mjs"] },
};
