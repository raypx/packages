import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "@dotenvx/dotenvx";

/**
 * Copies the current environment and layers local dotenv files beneath it; values
 * already set in the process win. Loaded secrets are never printed.
 */
export function developmentEnvironment(
  root: string,
  files: readonly string[] = [".env.local", ".env"],
): NodeJS.ProcessEnv {
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  for (const file of files) {
    const path = join(root, file);
    if (existsSync(path)) config({ path, processEnv: env, quiet: true });
  }
  return env;
}

/** Runs a command with inherited output, forwarding interrupts and rejecting on failure. */
export function run(
  command: string,
  args: string[],
  cwd: string,
  env = process.env,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit", windowsHide: true });
    const forward = (signal: NodeJS.Signals) => {
      child.kill(signal);
    };
    const interrupt = () => forward("SIGINT");
    const terminate = () => forward("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    const cleanup = () => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
    };
    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`${command} exited ${code ?? signal}`));
    });
  });
}

export interface TurboOptions {
  /** Load development dotenv files for these tasks. */
  developmentTasks?: readonly string[];
  /** Environment entries added to every task, such as a cache platform key. */
  env?: Record<string, string>;
  /** Only when this variable is `"true"` are remote cache credentials passed through. */
  trustedCacheEnv?: string;
}

/**
 * Runs a Turbo task under Bun. Untrusted runs drop remote cache credentials and use
 * the local cache only, so forks never read or write the shared remote cache.
 */
export function turbo(
  root: string,
  task: string,
  args: string[] = [],
  {
    developmentTasks = ["dev", "build"],
    env: extra = {},
    trustedCacheEnv = "DEVKIT_REMOTE_CACHE_TRUSTED",
  }: TurboOptions = {},
): Promise<void> {
  const env = {
    ...(developmentTasks.includes(task) ? developmentEnvironment(root) : process.env),
    ...extra,
  };
  if (env[trustedCacheEnv] !== "true") {
    for (const key of ["TURBO_TOKEN", "TURBO_TEAM", "TURBO_REMOTE_CACHE_SIGNATURE_KEY"])
      delete env[key];
    delete env.TURBO_REMOTE_ONLY;
    args = ["--cache=local:rw", ...args];
  }
  return run(process.execPath, ["--bun", "turbo", "run", task, ...args], root, env);
}
