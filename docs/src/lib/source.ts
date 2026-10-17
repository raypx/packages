import { loader } from "fumadocs-core/source";
import type { MetaData, StaticSource } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";
import { documentationPages, navigationMetadata } from "./pages";

export { getSourceUrl } from "./pages";

export const docs = defineDocs({
  dir: "..",
  docs: {
    async: true,
    files: [
      "docs/README.md",
      "docs/drizzle/*.md",
      "docs/intl/*.md",
      "docs/development/*.md",
      "packages/drizzle/README.md",
      "packages/drizzle/NOTICE.md",
      "packages/env/README.md",
      "packages/intl/README.md",
      "packages/tsconfig/README.md",
      "README.md",
    ],
    schema: ({ path }) =>
      z.object({}).transform(() => {
        const page = [...documentationPages]
          .sort((left, right) => right.sourcePath.length - left.sourcePath.length)
          .find((entry) => path.replaceAll("\\", "/").endsWith(`/${entry.sourcePath}`));
        if (!page) throw new Error(`Unregistered documentation source: ${path}`);
        return page;
      }),
  },
  meta: { files: [] },
});

const contentSource: StaticSource<{
  pageData: (typeof docs.docs)[number];
  metaData: MetaData;
}> = {
  files: [
    ...docs.docs.map((page) => ({
      type: "page" as const,
      path: `${page.slug}.md`,
      absolutePath: page.info.fullPath,
      data: page,
    })),
    ...Object.entries(navigationMetadata).map(([path, data]) => ({
      type: "meta" as const,
      path,
      data,
    })),
  ],
};

export const source = loader({
  source: contentSource,
  baseUrl: "/docs",
});
