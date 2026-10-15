import { fileURLToPath } from "node:url";
import { checkToolchain } from "./toolchain.js";

const findings = checkToolchain(fileURLToPath(new URL("../", import.meta.url)));
if (findings.length) {
  console.error(
    `Toolchain configuration failed:\n${findings.map((finding) => `  ${finding}`).join("\n")}`,
  );
  process.exitCode = 1;
} else console.log("Toolchain configuration passed.");
