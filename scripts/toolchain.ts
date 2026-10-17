import {
  assertToolchainRuntime as assertRuntime,
  checkToolchain as checkDeclarations,
  readToolchain,
  type Toolchain,
} from "../packages/devkit/src/toolchain.js";

export { readToolchain, type Toolchain };

/** Repository policy for the shared @voidmix/devkit toolchain checks. */
export function checkToolchain(root: string): string[] {
  return checkDeclarations(root, {
    documents: ["README.md", "AGENTS.md", "docs/AGENTS.md", "docs/development/publishing.md"],
    turboGlobalDependencies: [
      ".nvmrc",
      "mise.toml",
      "scripts/toolchain.ts",
      "packages/devkit/src/toolchain.ts",
    ],
  });
}

export function assertToolchainRuntime(root: string) {
  try {
    return assertRuntime(root, { nodeBinaryEnv: "TOOLKIT_NODE_BINARY" });
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)} Run mise exec -- bun run doctor.`,
    );
  }
}
