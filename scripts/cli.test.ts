import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "citty";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { command } from "./cli.js";

const actions = vi.hoisted(() => ({
  plan: vi.fn(),
  pack: vi.fn(),
  publish: vi.fn(),
  checkToolchain: vi.fn(),
  assertToolchainRuntime: vi.fn(),
}));
vi.mock("./release.js", () => ({
  plan: actions.plan,
  pack: actions.pack,
  publish: actions.publish,
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
});

describe("real CLI help", () => {
  it.each(["--help", "doctor --help", "release publish --help"])(
    "shows %s successfully even when the selected Node does not exist",
    (input) => {
      const result = spawnSync(process.execPath, ["scripts/cli.ts", ...input.split(" ")], {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
        env: {
          ...process.env,
          NO_COLOR: "1",
          TOOLKIT_NODE_BINARY: join(root, ".missing-node-for-cli-help"),
        },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout).toMatch(/usage/i);
      expect(result.stdout).not.toContain("Publishing:");
      expect(result.stderr).not.toMatch(
        /Node is unavailable|Expected Node|Toolchain configuration failed/,
      );
    },
  );
});
