import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import {
  documentationPages,
  navigationMetadata,
  renderContentPage,
  resolveContentLink,
  rewriteMarkdownLinks,
  syncContent,
} from "./sync-content.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const existingPaths = new Set([
  ...documentationPages.map((page) => page.sourcePath),
  "packages/drizzle/LICENSE",
  "packages/drizzle/src/columns.ts",
  "docs/file (with spaces).md",
]);
const options = { sourcePath: "docs/drizzle/merge-plan.md", existingPaths };

describe("canonical documentation links", () => {
  test("maps all nine canonical sources to stable public routes", () => {
    const expected = [
      "/docs",
      "/docs/drizzle",
      "/docs/drizzle/drizzle-plus",
      "/docs/drizzle/better-drizzle",
      "/docs/drizzle/merge-plan",
      "/docs/drizzle/provenance",
      "/docs/intl",
      "/docs/development",
      "/docs/development/changesets",
    ];
    expect(documentationPages).toHaveLength(expected.length);
    expect(
      documentationPages.map((page) => resolveContentLink(`/${page.sourcePath}`, options)),
    ).toEqual(expected);
    expect(navigationMetadata["meta.json"].pages).toEqual([
      "index",
      "drizzle",
      "intl",
      "development",
    ]);
  });

  test("resolves relative files and preserves query strings and heading anchors", () => {
    expect(
      resolveContentLink("drizzle-plus-capabilities.md#complete-query-feature-inventory", options),
    ).toBe("/docs/drizzle/drizzle-plus#complete-query-feature-inventory");
    expect(
      resolveContentLink("../../packages/intl/README.md?view=all#translate-and-format", options),
    ).toBe("/docs/intl?view=all#translate-and-format");
    expect(resolveContentLink("#available-foundation", options)).toBe("#available-foundation");
  });

  test("rewrites this repository's canonical GitHub links and retains external sources", () => {
    expect(
      resolveContentLink(
        "https://github.com/raypx/packages/blob/main/docs/drizzle/merge-plan.md#plugins-and-transaction-lifecycle",
        options,
      ),
    ).toBe("/docs/drizzle/merge-plan#plugins-and-transaction-lifecycle");
    for (const target of [
      "https://github.com/alloc/drizzle-plus/blob/5840bdb/src/extensions/internal.ts",
      "https://github.com/almeidazs/better-drizzle",
      "https://github.com/raypx/packages",
      "mailto:maintainers@example.com",
      "//www.postgresql.org/docs/18/functions-uuid.html",
    ])
      expect(resolveContentLink(target, options)).toBe(target);
  });

  test("links unregistered files and full license texts to their repository sources", () => {
    expect(resolveContentLink("../../packages/drizzle/LICENSE", options)).toBe(
      "https://github.com/raypx/packages/blob/main/packages/drizzle/LICENSE",
    );
    expect(resolveContentLink("../../packages/drizzle/src/columns.ts#L10", options)).toBe(
      "https://github.com/raypx/packages/blob/main/packages/drizzle/src/columns.ts#L10",
    );
    expect(resolveContentLink("../file%20(with%20spaces).md", options)).toBe(
      "https://github.com/raypx/packages/blob/main/docs/file%20(with%20spaces).md",
    );
  });

  test("rejects missing files, directories and paths outside the repository", () => {
    for (const target of ["missing.md", "../", "../../../private.md"]) {
      expect(() => resolveContentLink(target, options)).toThrow(
        /Local targets must be existing repository files/,
      );
    }
    expect(() =>
      resolveContentLink("https://github.com/raypx/packages/blob/main/docs/missing.md", options),
    ).toThrow(/docs\/drizzle\/merge-plan.md/);
  });

  test("parses inline links, reference destinations and titles without rewriting code examples", () => {
    const source = [
      '[Read `API`](drizzle-plus-capabilities.md#types "Title")',
      '[reference]: <../../packages/intl/README.md#translate-and-format> "Intl"',
      "[License](../../packages/drizzle/LICENSE)",
      "[Details](<../file%20(with%20spaces).md>)",
      "[Escaped](../file%20\\(with%20spaces\\).md)",
      "`[example](missing.md)`",
      "```ts",
      "[example](missing.md)",
      "```",
      "    [indented example](missing.md)",
    ].join("\n");
    expect(rewriteMarkdownLinks(source, options)).toBe(
      [
        '[Read `API`](/docs/drizzle/drizzle-plus#types "Title")',
        '[reference]: </docs/intl#translate-and-format> "Intl"',
        "[License](https://github.com/raypx/packages/blob/main/packages/drizzle/LICENSE)",
        "[Details](<https://github.com/raypx/packages/blob/main/docs/file%20(with%20spaces).md>)",
        "[Escaped](https://github.com/raypx/packages/blob/main/docs/file%20(with%20spaces).md)",
        "`[example](missing.md)`",
        "```ts",
        "[example](missing.md)",
        "```",
        "    [indented example](missing.md)",
      ].join("\n"),
    );
  });

  test("retains automatic link labels when their destinations become internal routes", () => {
    const target =
      "https://github.com/raypx/packages/blob/main/packages/intl/README.md#use-isolated-react-providers";
    expect(rewriteMarkdownLinks(`<${target}>`, options)).toBe(
      `[${target}](/docs/intl#use-isolated-react-providers)`,
    );
    expect(rewriteMarkdownLinks("<https://www.postgresql.org/docs/18/>", options)).toBe(
      "<https://www.postgresql.org/docs/18/>",
    );
  });

  test("leaves incomplete links and escaped Markdown syntax as literal text", () => {
    expect(rewriteMarkdownLinks("[literal](missing.md", options)).toBe("[literal](missing.md");
    expect(rewriteMarkdownLinks("\\[literal](missing.md)", options)).toBe(
      "\\[literal](missing.md)",
    );
  });
});

describe("generated content", () => {
  test("validates links against source files rather than transient build output", () => {
    const fixture = mkdtempSync(path.join(tmpdir(), "raypx-docs-source-"));
    try {
      for (const page of documentationPages) {
        const destination = path.join(fixture, page.sourcePath);
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, "# Guide\n\nCanonical documentation.\n");
      }
      mkdirSync(path.join(fixture, "packages/drizzle/dist/postgres"), { recursive: true });
      writeFileSync(
        path.join(fixture, "packages/drizzle/dist/postgres/transient.md"),
        "Generated output.",
      );
      writeFileSync(
        path.join(fixture, "docs/README.md"),
        "# Guide\n\n[Transient](../packages/drizzle/dist/postgres/transient.md)\n",
      );
      expect(() => syncContent({ repositoryRoot: fixture })).toThrow(
        /Local targets must be existing repository files/,
      );
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  test("provides English page metadata while retaining every body heading and code sample", () => {
    const page = documentationPages[1];
    const markdown =
      '# @raypx/drizzle\n\nCurrent APIs.\n\n## JSONB semantics\n\n```ts\nconst x = "{path}";\n```\n';
    const output = renderContentPage(page, markdown, { existingPaths });
    expect(output).toContain('title: "Drizzle"');
    expect(output).toContain('sourcePath: "packages/drizzle/README.md"');
    expect(output).not.toContain("# @raypx/drizzle");
    expect(output.split("---\n\n")[1]).toBe(markdown.replace(/^# [^\n]+\n\n/, ""));
  });

  test("builds every real canonical document without losing capability tables or API examples", () => {
    const contentDirectory = mkdtempSync(path.join(tmpdir(), "raypx-docs-content-"));
    try {
      expect(syncContent({ repositoryRoot, contentDirectory })).toEqual({ pages: 9, files: 13 });
      for (const page of documentationPages) {
        const original = readFileSync(path.join(repositoryRoot, page.sourcePath), "utf8");
        const generated = readFileSync(path.join(contentDirectory, `${page.slug}.md`), "utf8");
        const tables = (text) => text.split("\n").filter((line) => line.startsWith("|")).length;
        const codeBlocks = (text) => text.match(/```[^\n]*\n[\s\S]*?\n```/g) ?? [];
        const identifiers = (text) =>
          [...text.matchAll(/(?<!`)`([^`\n]+)`(?!`)/g)]
            .map((match) => match[1])
            .sort((left, right) => left.localeCompare(right));
        expect(tables(generated), page.sourcePath).toBe(tables(original));
        expect(codeBlocks(generated), page.sourcePath).toEqual(codeBlocks(original));
        expect(identifiers(generated), page.sourcePath).toEqual(identifiers(original));
        for (const line of original.split("\n").slice(1)) {
          if (line && !line.includes("](")) expect(generated, page.sourcePath).toContain(line);
        }
      }
      const better = readFileSync(path.join(contentDirectory, "drizzle/better-drizzle.md"), "utf8");
      expect(better).toContain("All 26 ESLint rules");
      expect(better).toContain("Complete error codes");
      expect(better).toContain("235");
      const intl = readFileSync(path.join(contentDirectory, "intl/index.md"), "utf8");
      expect(intl).toContain('zh: { greeting: "你好" }');
      expect(readFileSync(path.join(contentDirectory, "meta.json"), "utf8")).toBe(
        `${JSON.stringify(navigationMetadata["meta.json"], null, 2)}\n`,
      );
    } finally {
      rmSync(contentDirectory, { recursive: true, force: true });
    }
  });
});
