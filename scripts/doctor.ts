import { fileURLToPath } from "node:url";
import { assertToolchainRuntime } from "./toolchain.js";

const root = fileURLToPath(new URL("../", import.meta.url));
try {
  const { node, bun, nodeBinary } = assertToolchainRuntime(root);
  console.log(`Bun ${bun}; Node ${node} (${nodeBinary}); ${process.platform}/${process.arch}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
