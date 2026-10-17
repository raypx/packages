import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { command, main } from "./cli.js";

const actions = vi.hoisted(() => ({
  plan: vi.fn(),
  pack: vi.fn(),
  publish: vi.fn(),
  snapshot: vi.fn(),
  checkToolchain: vi.fn(),
  assertToolchainRuntime: vi.fn(),
}));
vi.mock("./release.js", () => ({
  plan: actions.plan,
  pack: actions.pack,
  publish: actions.publish,
  snapshot: actions.snapshot,
}));
vi.mock("./toolchain.js", () => ({
  checkToolchain: actions.checkToolchain,
  assertToolchainRuntime: actions.assertToolchainRuntime,
}));

const root = fileURLToPath(new URL("../", import.meta.url));

function expectNoRelease() {
  expect(actions.plan).not.toHaveBeenCalled();
  expect(actions.pack).not.toHaveBeenCalled();
  expect(actions.publish).not.toHaveBeenCalled();
}

/** Exercise the executable entry without ever loading real release operations. */
function runCli(rawArgs: string[], env: NodeJS.ProcessEnv = {}) {
  const fixture = mkdtempSync(join(tmpdir(), "voidmix-cli-"));
  const preload = join(fixture, "preload.ts");
  try {
    writeFileSync(
      preload,
      `import { mock } from "bun:test";
mock.module(${JSON.stringify(join(root, "scripts/release.ts"))}, () =>
  Object.fromEntries(["plan", "pack", "publish", "snapshot"].map(name => [name,
    (...args) => console.log(JSON.stringify({ release: name, args }))
  ]))
);
`,
    );
    return spawnSync(process.execPath, ["--preload", preload, "scripts/cli.ts", ...rawArgs], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, NO_COLOR: "1", ...env },
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

beforeEach(() => {
  for (const action of Object.values(actions)) action.mockReset();
  actions.checkToolchain.mockReturnValue([]);
  actions.assertToolchainRuntime.mockReturnValue({
    node: "24.15.0",
    bun: "1.4.3",
    nodeBinary: "/selected/node",
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("development CLI routes", () => {
  it.each([
    ["--dry-run", "release", "publish"],
    ["release", "--unexpected", "pack"],
    ["release", "--stable", "publish"],
    ["--stable", "release", "pack"],
    ["toolchain", "--unexpected", "check"],
  ])("rejects misplaced parent options before dispatch: %j", async (...rawArgs) => {
    await expect(runCommand(command, { rawArgs })).rejects.toThrow(
      "Options must follow the final subcommand",
    );
    expectNoRelease();
    expect(actions.assertToolchainRuntime).not.toHaveBeenCalled();
    expect(actions.checkToolchain).not.toHaveBeenCalled();
  });

  it("runs the doctor without invoking configuration or release checks", async () => {
    await runCommand(command, { rawArgs: ["doctor"] });
    expect(actions.assertToolchainRuntime).toHaveBeenCalledExactlyOnceWith(root);
    expect(console.log).toHaveBeenCalledWith(
      `Bun 1.4.3; Node 24.15.0 (/selected/node); ${process.platform}/${process.arch}`,
    );
    expect(actions.checkToolchain).not.toHaveBeenCalled();
    expectNoRelease();
  });

  it("propagates a doctor failure without continuing to a release", async () => {
    actions.assertToolchainRuntime.mockImplementation(() => {
      throw new Error("Node is unavailable");
    });
    await expect(runCommand(command, { rawArgs: ["doctor"] })).rejects.toThrow(
      "Node is unavailable",
    );
    expectNoRelease();
  });

  it("checks static configuration without requiring the active Node executable", async () => {
    await runCommand(command, { rawArgs: ["toolchain", "check"] });
    expect(actions.checkToolchain).toHaveBeenCalledExactlyOnceWith(root);
    expect(console.log).toHaveBeenCalledWith("Toolchain configuration passed.");
    expect(actions.assertToolchainRuntime).not.toHaveBeenCalled();
    expectNoRelease();
  });

  it("reports all configuration findings as a failed command", async () => {
    actions.checkToolchain.mockReturnValue(["Node pin drifted", "Bun pin drifted"]);
    await expect(runCommand(command, { rawArgs: ["toolchain", "check"] })).rejects.toThrow(
      "Toolchain configuration failed:\n  Node pin drifted\n  Bun pin drifted",
    );
    expect(console.log).not.toHaveBeenCalled();
    expect(actions.assertToolchainRuntime).not.toHaveBeenCalled();
    expectNoRelease();
  });

  it.each(["missing", "release missing"])("rejects unknown command %s", async (input) => {
    await expect(runCommand(command, { rawArgs: input.split(" ") })).rejects.toThrow(
      /Unknown command/,
    );
    expectNoRelease();
    expect(actions.assertToolchainRuntime).not.toHaveBeenCalled();
    expect(actions.checkToolchain).not.toHaveBeenCalled();
  });
});

describe("release CLI arguments", () => {
  it.each(["plan", "pack"] as const)("defaults %s to prerelease mode", async (name) => {
    await runCommand(command, { rawArgs: ["release", name] });
    expect(actions[name]).toHaveBeenCalledExactlyOnceWith(false);
    expect(actions.publish).not.toHaveBeenCalled();
  });

  it.each(["plan", "pack"] as const)("passes --stable to %s", async (name) => {
    await runCommand(command, { rawArgs: ["release", name, "--stable"] });
    expect(actions[name]).toHaveBeenCalledExactlyOnceWith(true);
    expect(actions.publish).not.toHaveBeenCalled();
  });

  it("defaults publish to prerelease mode without extra arguments", async () => {
    await runCommand(command, { rawArgs: ["release", "publish"] });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(false, []);
    expect(actions.plan).not.toHaveBeenCalled();
    expect(actions.pack).not.toHaveBeenCalled();
  });

  it("passes stable approval separately from the original OTP tokens", async () => {
    await runCommand(command, {
      rawArgs: ["release", "publish", "--stable", "--otp", "012345"],
    });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(true, ["--otp", "012345"]);
    expect(console.log).not.toHaveBeenCalled();
  });

  it("preserves unknown Changesets flags and their original token forms", async () => {
    const passthrough = ["--tag", "alpha", "--access=public", "--no-git-checks", "--otp=012345"];
    await runCommand(command, {
      rawArgs: ["release", "publish", ...passthrough, "--stable"],
    });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(true, passthrough);
  });

  it("passes arguments after -- to Changesets without the separator", async () => {
    const passthrough = ["--tag", "alpha", "--otp", "012345"];
    await runCommand(command, {
      rawArgs: ["release", "publish", "--stable", "--", ...passthrough],
    });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(true, passthrough);
  });

  it("does not consume a literal --stable after the passthrough separator", async () => {
    await runCommand(command, {
      rawArgs: ["release", "publish", "--", "--stable", "--otp", "012345"],
    });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(false, ["--stable", "--otp", "012345"]);
  });

  it("removes only the wrapper stable option when both sides contain it", async () => {
    await runCommand(command, {
      rawArgs: ["release", "publish", "--stable", "--", "--stable"],
    });
    expect(actions.publish).toHaveBeenCalledExactlyOnceWith(true, ["--stable"]);
  });

  it.each(["--no-stable", "--stable=false"])(
    "keeps %s as the wrapper's boolean option",
    async (option) => {
      await runCommand(command, {
        rawArgs: ["release", "publish", option, "--otp", "012345"],
      });
      expect(actions.publish).toHaveBeenCalledExactlyOnceWith(false, ["--otp", "012345"]);
    },
  );

  it.each(["plan", "pack"] as const)(
    "rejects unknown options for %s before invoking any release operation",
    async (name) => {
      await expect(
        runCommand(command, { rawArgs: ["release", name, "--unexpected"] }),
      ).rejects.toThrow("Unknown option --unexpected");
      expectNoRelease();
    },
  );

  it("rejects unexpected plan positionals before invoking any release operation", async () => {
    await expect(
      runCommand(command, { rawArgs: ["release", "plan", "unexpected"] }),
    ).rejects.toThrow("Unexpected positional arguments");
    expectNoRelease();
  });

  it("packs snapshots of changed packages without publishing by default", async () => {
    await runCommand(command, { rawArgs: ["release", "snapshot"] });
    expect(actions.snapshot).toHaveBeenCalledExactlyOnceWith([], { publish: false });
    expectNoRelease();
  });

  it("passes named packages, --publish and a string OTP to snapshot", async () => {
    await runCommand(command, {
      rawArgs: ["release", "snapshot", "intl", "env", "--publish", "--otp", "012345"],
    });
    expect(actions.snapshot).toHaveBeenCalledExactlyOnceWith(["intl", "env"], {
      publish: true,
      otp: "012345",
    });
  });

  it.each([
    [["--unexpected"], "Unknown option --unexpected"],
    [["--otp", "012345"], "--otp requires --publish."],
  ])("rejects snapshot %j before packing", async (options, message) => {
    await expect(
      runCommand(command, { rawArgs: ["release", "snapshot", ...options] }),
    ).rejects.toThrow(message);
    expect(actions.snapshot).not.toHaveBeenCalled();
  });
});

describe("real CLI help", () => {
  it.each(["--help", "-h"])(
    "forwards %s after -- through the actual main handler",
    async (help) => {
      const exit = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("Unexpected process exit");
      });
      await main(["release", "publish", "--stable", "--otp", "012345", "--", help]);
      expect(exit).not.toHaveBeenCalled();
      expect(actions.publish).toHaveBeenCalledExactlyOnceWith(true, ["--otp", "012345", help]);
      expect(console.log).not.toHaveBeenCalled();
    },
  );

  it("does not let forwarded help bypass misplaced-option validation", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("Expected failure exit");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(main(["--dry-run", "release", "publish", "--", "--help"])).rejects.toThrow(
      "Expected failure exit",
    );
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
    expectNoRelease();
  });

  it.each([
    ["--dry-run", "release", "publish"],
    ["release", "--stable", "publish"],
  ])("fails at the executable entry for misplaced options: %j", (...args) => {
    const result = runCli(args);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Options must follow the final subcommand");
    expect(result.stdout).not.toContain('"release":');
  });

  it.each(["--help", "-h"])("forwards %s after -- at the executable entry", (help) => {
    const result = runCli(["release", "publish", "--", help]);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ release: "publish", args: [false, [help]] });
  });

  it.each(["--help", "doctor --help", "release publish --help"])(
    "shows %s successfully even when the selected Node does not exist",
    (input) => {
      const result = runCli(input.split(" "), {
        TOOLKIT_NODE_BINARY: join(root, ".missing-node-for-cli-help"),
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/usage/i);
      expect(result.stdout).not.toContain('"release":');
      expect(result.stderr).not.toMatch(
        /Node is unavailable|Expected Node|Toolchain configuration failed/,
      );
    },
  );
});
