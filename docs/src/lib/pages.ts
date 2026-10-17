export const documentationPages = [
  {
    slug: "index",
    sourcePath: "docs/README.md",
    title: "Overview",
    description: "Reusable Voidmix libraries, their current APIs and extension designs.",
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
    slug: "env/index",
    sourcePath: "packages/env/README.md",
    title: "Env",
    description:
      "Typed environment validation, nested presets, defaults and guarded client access.",
  },
  {
    slug: "intl/index",
    sourcePath: "packages/intl/README.md",
    title: "Intl",
    description:
      "Locale negotiation, typed ICU translation, Intl formatting and controlled React providers.",
  },
  {
    slug: "intl/migration",
    sourcePath: "docs/intl/migration.md",
    title: "Controlled provider migration",
    description: "Runtime ownership, typed messages, platform preferences and alpha migration.",
  },
  {
    slug: "tsconfig/index",
    sourcePath: "packages/tsconfig/README.md",
    title: "TSConfig",
    description:
      "Strict TypeScript presets for ESM libraries, browser applications and Node runtimes.",
  },
  {
    slug: "development/index",
    sourcePath: "README.md",
    title: "Development and releases",
    description: "Repository setup, verification and independent package publication.",
  },
  {
    slug: "development/changesets",
    sourcePath: "docs/development/changesets.md",
    title: "Changesets workflow",
    description: "Independent versions, initial publication and subsequent release preparation.",
  },
  {
    slug: "development/publishing",
    sourcePath: "docs/development/publishing.md",
    title: "Publishing",
    description: "Setup, alpha releases, CI publication, stable graduation and recovery.",
  },
];

export const navigationMetadata = {
  "meta.json": {
    title: "Voidmix",
    pages: ["index", "drizzle", "env", "intl", "tsconfig", "development"],
  },
  "drizzle/meta.json": {
    title: "Drizzle",
    pages: ["index", "drizzle-plus", "better-drizzle", "merge-plan", "provenance"],
  },
  "env/meta.json": { title: "Env", pages: ["index"] },
  "intl/meta.json": { title: "Intl", pages: ["index", "migration"] },
  "tsconfig/meta.json": { title: "TSConfig", pages: ["index"] },
  "development/meta.json": { title: "Development", pages: ["index", "changesets", "publishing"] },
};

export function getDocumentationPath(slug: string) {
  return `/docs${slug === "index" ? "" : `/${slug.replace(/\/index$/, "")}`}`;
}

const repositorySourceUrl = "https://github.com/raypx/voidmix/blob/main/";

export function getSourceUrl(sourcePath: string) {
  return `${repositorySourceUrl}${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
}

export function getContentUrl(href: string, sourcePath: string) {
  if (href.startsWith("#") || href.startsWith("?") || /^\/docs(?:\/|$)/.test(href)) return href;

  const url = new URL(href, getSourceUrl(sourcePath));
  if (!url.href.startsWith(repositorySourceUrl)) return href;

  const target = decodeURIComponent(url.pathname.slice("/raypx/voidmix/blob/main/".length));
  const page = documentationPages.find((entry) => entry.sourcePath === target);
  return page ? `${getDocumentationPath(page.slug)}${url.search}${url.hash}` : url.href;
}
