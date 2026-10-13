import { readdirSync } from "node:fs";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { getSlugs } from "fumadocs-core/source";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

const documentationPaths = readdirSync("content", { recursive: true, encoding: "utf8" })
  .filter((file) => /\.mdx?$/.test(file))
  .map((file) => `/docs/${getSlugs(file).join("/")}`.replace(/\/$/, ""));

export default defineConfig({
  server: { port: 3100, strictPort: true },
  plugins: [
    nitro({
      preset: "bun",
      serverDir: false,
      serverEntry: false,
    }),
    fumadocsMdx({ index: false, macro: { include: ["src/lib/source.ts"] } }),
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
