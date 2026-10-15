import { fileURLToPath } from "node:url";
import { defineCommand, runMain } from "citty";

const root = fileURLToPath(new URL("../", import.meta.url));
const stableArg = {
  type: "boolean",
  default: false,
  description: "Allow an approved stable release",
} as const;

function assertArguments(args: { _: string[] }, allowed: string[]) {
  const unknown = Object.keys(args).find((key) => key !== "_" && !allowed.includes(key));
  if (unknown) throw new Error(`Unknown option --${unknown}`);
  if (args._.length) throw new Error("Unexpected positional arguments.");
}

/** Citty discards arguments before a selected subcommand; reject options there. */
function assertSubcommandPosition({ rawArgs }: { rawArgs: string[] }) {
  if (rawArgs[0]?.startsWith("-")) throw new Error("Options must follow the final subcommand.");
}

/** Remove only our wrapper option; Changesets receives its original argument tokens. */
function publishArguments(rawArgs: string[]): string[] {
  const separator = rawArgs.indexOf("--");
  const end = separator < 0 ? rawArgs.length : separator;
  return [
    ...rawArgs.slice(0, end).filter((arg) => !/^--(?:no-)?stable(?:=|$)/.test(arg)),
    ...rawArgs.slice(separator < 0 ? rawArgs.length : separator + 1),
  ];
}

export const command = defineCommand({
  meta: { name: "voidmix-dev", description: "Voidmix repository development and release tools" },
  setup: assertSubcommandPosition,
  subCommands: {
    doctor: defineCommand({
      meta: { name: "doctor", description: "Check the active Node and Bun executables" },
      run: async ({ args }) => {
        assertArguments(args, []);
        const { assertToolchainRuntime } = await import("./toolchain.js");
        const { node, bun, nodeBinary } = assertToolchainRuntime(root);
        console.log(
          `Bun ${bun}; Node ${node} (${nodeBinary}); ${process.platform}/${process.arch}`,
        );
      },
    }),
    toolchain: defineCommand({
      meta: { name: "toolchain", description: "Inspect development toolchain configuration" },
      setup: assertSubcommandPosition,
      subCommands: {
        check: defineCommand({
          meta: {
            name: "check",
            description: "Check version sources, CI setup and configuration drift",
          },
          run: async ({ args }) => {
            assertArguments(args, []);
            const { checkToolchain } = await import("./toolchain.js");
            const findings = checkToolchain(root);
            if (findings.length)
              throw new Error(
                `Toolchain configuration failed:\n${findings.map((finding) => `  ${finding}`).join("\n")}`,
              );
            console.log("Toolchain configuration passed.");
          },
        }),
      },
    }),
    release: defineCommand({
      meta: {
        name: "release",
        description: "Plan, pack or publish independently versioned libraries",
      },
      setup: assertSubcommandPosition,
      subCommands: {
        plan: defineCommand({
          meta: {
            name: "plan",
            description: "Preview unpublished versions without changing repository files",
          },
          args: { stable: stableArg },
          run: async ({ args }) => {
            assertArguments(args, ["stable"]);
            const { plan } = await import("./release.js");
            await plan(args.stable);
          },
        }),
        pack: defineCommand({
          meta: { name: "pack", description: "Build and verify release archives locally" },
          args: { stable: stableArg },
          run: async ({ args }) => {
            assertArguments(args, ["stable"]);
            const { pack } = await import("./release.js");
            await pack(args.stable);
          },
        }),
        publish: defineCommand({
          meta: {
            name: "publish",
            description: "Publish verified archives; pass additional Changesets arguments after --",
          },
          args: {
            stable: stableArg,
            otp: { type: "string", description: "One-time password passed to Changesets" },
          },
          run: async ({ args, rawArgs }) => {
            const { publish } = await import("./release.js");
            await publish(args.stable, publishArguments(rawArgs));
          },
        }),
      },
    }),
  },
});

export async function main(rawArgs = process.argv.slice(2)): Promise<void> {
  const separator = rawArgs.indexOf("--");
  const wrapperArgs = separator < 0 ? rawArgs : rawArgs.slice(0, separator);
  const help = wrapperArgs.some((arg) => arg === "--help" || arg === "-h");
  // Declaring help disables citty's global scan, so forwarded help reaches Changesets.
  const entry: typeof command = help
    ? command
    : {
        ...command,
        args: { help: { type: "boolean", alias: "h", description: "Show command help" } },
      };
  await runMain(entry, { rawArgs });
}

if (import.meta.main) await main();
