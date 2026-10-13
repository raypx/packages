import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryUrl = "https://github.com/raypx/packages";
const defaultRepositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

/** Canonical sources remain readable on GitHub and in the published packages. */
export const documentationPages = Object.freeze(
  [
    {
      slug: "index",
      sourcePath: "docs/README.md",
      title: "Overview",
      description: "Reusable Raypx libraries, their current APIs and extension designs.",
    },
    {
      slug: "drizzle/index",
      sourcePath: "packages/drizzle/README.md",
      title: "Drizzle",
      description: "PostgreSQL helpers, JSONB expressions and query diagnostics for postgres.js.",
    },
    {
      slug: "drizzle/drizzle-plus",
      sourcePath: "docs/drizzle/drizzle-plus-capabilities.md",
      title: "drizzle-plus inventory",
      description: "The complete pinned upstream capability inventory and merge recommendations.",
    },
    {
      slug: "drizzle/better-drizzle",
      sourcePath: "docs/drizzle/better-drizzle-capabilities.md",
      title: "better-drizzle inventory",
      description: "The complete pinned upstream API, plugin, rule and error-code inventory.",
    },
    {
      slug: "drizzle/merge-plan",
      sourcePath: "docs/drizzle/merge-plan.md",
      title: "Merge and extension plan",
      description:
        "Module boundaries, shared semantics and acceptance criteria for future extensions.",
    },
    {
      slug: "drizzle/provenance",
      sourcePath: "packages/drizzle/NOTICE.md",
      title: "Source provenance",
      description: "Pinned source revisions, adaptation notices and retained upstream licenses.",
    },
    {
      slug: "intl/index",
      sourcePath: "packages/intl/README.md",
      title: "Intl",
      description:
        "Locale negotiation, ICU translation, Intl formatting and isolated React providers.",
    },
    {
      slug: "development/index",
      sourcePath: "README.md",
      title: "Development and releases",
      description: "Repository setup, verification and independent package publication.",
    },
    {
      slug: "development/changesets",
      sourcePath: ".changeset/README.md",
      title: "Changesets workflow",
      description: "Independent versions, initial publication and subsequent release preparation.",
    },
  ].map((page) => Object.freeze(page)),
);

export const navigationMetadata = Object.freeze({
  "meta.json": {
    title: "Raypx Packages",
    pages: ["index", "drizzle", "intl", "development"],
  },
  "drizzle/meta.json": {
    title: "Drizzle",
    pages: ["index", "drizzle-plus", "better-drizzle", "merge-plan", "provenance"],
  },
  "intl/meta.json": { title: "Intl", pages: ["index"] },
  "development/meta.json": { title: "Development", pages: ["index", "changesets"] },
});

const sourceRoutes = new Map(
  documentationPages.map((page) => [page.sourcePath, routeFor(page.slug)]),
);

function routeFor(slug) {
  return `/docs${slug === "index" ? "" : `/${slug.replace(/\/index$/, "")}`}`;
}

function splitSuffix(target) {
  const index = target.search(/[?#]/);
  return index < 0 ? [target, ""] : [target.slice(0, index), target.slice(index)];
}

function encodeRepositoryPath(sourcePath) {
  return sourcePath.split("/").map(encodeURIComponent).join("/");
}

/**
 * Resolve a Markdown destination without reading files or changing its anchor.
 * existingPaths contains repository-relative file paths; directory links are not supported.
 */
export function resolveContentLink(target, { sourcePath, existingPaths }) {
  if (!target || target.startsWith("#") || target.startsWith("?")) return target;
  const [destination, suffix] = splitSuffix(
    target.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1"),
  );
  let repositoryPath;
  if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith("//")) {
    const prefix = `${repositoryUrl}/blob/main/`;
    if (!destination.startsWith(prefix)) return target;
    repositoryPath = path.posix.normalize(decodeURIComponent(destination.slice(prefix.length)));
  } else {
    if (destination === "/docs" || [...sourceRoutes.values()].includes(destination)) return target;
    repositoryPath = path.posix.normalize(
      destination.startsWith("/")
        ? decodeURIComponent(destination.slice(1))
        : path.posix.join(path.posix.dirname(sourcePath), decodeURIComponent(destination)),
    );
  }

  if (
    repositoryPath === ".." ||
    repositoryPath.startsWith("../") ||
    !existingPaths.has(repositoryPath)
  ) {
    throw new Error(
      `Invalid documentation link in ${sourcePath}: ${target}. Local targets must be existing repository files.`,
    );
  }

  const route = sourceRoutes.get(repositoryPath);
  return `${route ?? `${repositoryUrl}/blob/main/${encodeRepositoryPath(repositoryPath)}`}${suffix}`;
}

function closingBracket(line, start) {
  let depth = 1;
  for (let index = start + 1; index < line.length; index++) {
    if (line[index] === "\\") index++;
    else if (line[index] === "[") depth++;
    else if (line[index] === "]" && --depth === 0) return index;
  }
  return -1;
}

function destinationRange(line, start) {
  let index = start;
  while (/\s/.test(line[index] ?? "") && index < line.length) index++;
  if (line[index] === "<") {
    const end = line.indexOf(">", index + 1);
    return end < 0 ? undefined : [index + 1, end];
  }
  const begin = index;
  let depth = 0;
  for (; index < line.length; index++) {
    if (line[index] === "\\") index++;
    else if (line[index] === "(") depth++;
    else if (line[index] === ")") {
      if (depth === 0) break;
      depth--;
    } else if (/\s/.test(line[index]) && depth === 0) break;
  }
  return index === begin ? undefined : [begin, index];
}

function hasInlineLinkEnding(line, start) {
  let index = start;
  if (line[index] === ">") index++;
  while (/\s/.test(line[index] ?? "") && index < line.length) index++;
  const delimiter = line[index];
  if (delimiter === '"' || delimiter === "'" || delimiter === "(") {
    const ending = delimiter === "(" ? ")" : delimiter;
    for (index++; index < line.length; index++) {
      if (line[index] === "\\") index++;
      else if (line[index] === ending) break;
    }
    index++;
    while (/\s/.test(line[index] ?? "") && index < line.length) index++;
  }
  return line[index] === ")";
}

function rewriteLine(line, options) {
  const replacements = [];
  const reference = /^ {0,3}\[[^\]]+\]:\s*/.exec(line);
  if (reference) {
    const range = destinationRange(line, reference[0].length);
    if (range) replacements.push({ start: range[0], end: range[1] });
  } else {
    for (let index = 0; index < line.length; index++) {
      if (line[index] === "\\") {
        index++;
      } else if (line[index] === "`") {
        let size = 1;
        while (line[index + size] === "`") size++;
        const closing = line.indexOf("`".repeat(size), index + size);
        if (closing >= 0) index = closing + size - 1;
      } else if (line[index] === "[") {
        const closing = closingBracket(line, index);
        if (closing < 0 || line[closing + 1] !== "(") continue;
        const range = destinationRange(line, closing + 2);
        if (range && hasInlineLinkEnding(line, range[1])) {
          replacements.push({ start: range[0], end: range[1] });
          index = range[1];
        }
      } else if (line[index] === "<") {
        const closing = line.indexOf(">", index + 1);
        const target = line.slice(index + 1, closing);
        if (closing < 0 || !/^https?:\/\//i.test(target)) continue;
        const resolved = resolveContentLink(target, options);
        if (target !== resolved) {
          replacements.push({
            start: index,
            end: closing + 1,
            value: `[${target.replaceAll("[", "\\[").replaceAll("]", "\\]")}](${resolved})`,
          });
        }
        index = closing;
      }
    }
  }

  for (const { start, end, value } of replacements.reverse()) {
    const target = line.slice(start, end);
    line = `${line.slice(0, start)}${value ?? resolveContentLink(target, options)}${line.slice(end)}`;
  }
  return line;
}

/** Rewrite inline and reference links while leaving fenced and inline code intact. */
export function rewriteMarkdownLinks(markdown, options) {
  let fence;
  return markdown
    .split("\n")
    .map((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
        return line;
      }
      if (fence || /^ {4}|^\t/.test(line)) return line;
      return rewriteLine(line, options);
    })
    .join("\n");
}

export function renderContentPage(page, markdown, { existingPaths }) {
  const body = rewriteMarkdownLinks(markdown.replace(/^# [^\n]+\r?\n(?:\r?\n)?/, ""), {
    sourcePath: page.sourcePath,
    existingPaths,
  });
  const frontmatter = ["title", "description", "sourcePath"]
    .map((key) => `${key}: ${JSON.stringify(page[key])}`)
    .join("\n");
  return `---\n${frontmatter}\n---\n\n${body}`;
}

function repositoryFiles(repositoryRoot, directory = "") {
  const files = new Set();
  for (const entry of readdirSync(path.join(repositoryRoot, directory), { withFileTypes: true })) {
    const relative = path.posix.join(directory, entry.name);
    if (
      [
        ".git",
        "node_modules",
        ".turbo",
        ".source",
        ".output",
        ".tanstack",
        "dist",
        "coverage",
      ].includes(entry.name)
    )
      continue;
    if (relative === "docs/content") continue;
    if (entry.isFile()) files.add(relative);
    else if (entry.isDirectory()) {
      for (const file of repositoryFiles(repositoryRoot, relative)) files.add(file);
    }
  }
  return files;
}

/** Generate build-only Markdown views from the unchanged canonical sources. */
export function syncContent({
  repositoryRoot = defaultRepositoryRoot,
  contentDirectory = path.join(repositoryRoot, "docs/content"),
} = {}) {
  const existingPaths = repositoryFiles(repositoryRoot);
  const outputs = documentationPages.map((page) => ({
    outputPath: `${page.slug}.md`,
    text: renderContentPage(
      page,
      readFileSync(path.join(repositoryRoot, page.sourcePath), "utf8"),
      { existingPaths },
    ),
  }));
  outputs.push(
    ...Object.entries(navigationMetadata).map(([outputPath, metadata]) => ({
      outputPath,
      text: `${JSON.stringify(metadata, null, 2)}\n`,
    })),
  );

  const slugs = new Set(documentationPages.map((page) => page.slug));
  if (slugs.size !== documentationPages.length || sourceRoutes.size !== documentationPages.length) {
    throw new Error("Documentation source paths and page slugs must be unique.");
  }
  for (const output of outputs) {
    const destination = path.join(contentDirectory, output.outputPath);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, output.text);
  }
  return { pages: documentationPages.length, files: outputs.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = syncContent();
  console.log(`Generated ${result.pages} documentation pages from canonical Markdown sources.`);
}
