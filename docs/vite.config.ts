import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { documentationPages, getContentUrl, getDocumentationPath } from "./src/lib/pages";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const documentationPaths = documentationPages.map((page) => getDocumentationPath(page.slug));

type MarkdownNode = {
  type: string;
  depth?: number;
  url?: string;
  children?: MarkdownNode[];
};

export default defineConfig({
  server: { port: 3100, strictPort: true },
  plugins: [
    nitro({
      preset: "bun",
      serverDir: false,
      serverEntry: false,
    }),
    fumadocsMdx({
      index: false,
      macro: { include: ["src/lib/source.ts"] },
      globalOptions: {
        mdxOptions: {
          remarkPlugins: (defaults) => [
            () => (tree: MarkdownNode, file: { path: string }) => {
              const sourcePath = relative(repositoryRoot, file.path).replaceAll("\\", "/");
              const heading = tree.children?.[0];
              if (heading?.type === "heading" && heading.depth === 1) tree.children?.shift();

              function rewriteLinks(node: MarkdownNode) {
                if ((node.type === "link" || node.type === "definition") && node.url) {
                  node.url = getContentUrl(node.url, sourcePath);
                }
                node.children?.forEach(rewriteLinks);
              }
              rewriteLinks(tree);
            },
            ...defaults,
          ],
        },
      },
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: ["/", ...documentationPaths, "/api/search"].map((path) => ({ path })),
      sitemap: { enabled: false },
    }),
    react(),
  ],
});
