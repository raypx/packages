import { loader } from "fumadocs-core/source";
import { pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content",
  docs: {
    async: true,
    schema: pageSchema.extend({ sourcePath: z.string() }),
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/docs",
});

export function getSourceUrl(sourcePath: string) {
  const encodedPath = sourcePath.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/raypx/packages/blob/main/${encodedPath}`;
}
