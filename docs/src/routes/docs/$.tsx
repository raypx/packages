import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  EditOnGitHub,
} from "fumadocs-ui/layouts/docs/page";
import { Suspense, use } from "react";
import { z } from "zod";
import { getMDXComponents } from "../../components/mdx";
import { baseOptions } from "../../lib/layout.shared";
import { docs, getSourceUrl, source } from "../../lib/source";

const loadPage = createServerFn({ method: "GET" })
  .validator(z.array(z.string()))
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.data.info.path,
      title: page.data.title,
      description: page.data.description ?? "",
      sourceUrl: getSourceUrl(page.data.sourcePath),
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    if (!source.getPage(slugs)) throw notFound();
    const data = await loadPage({ data: slugs });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Voidmix` },
          { name: "description", content: loaderData.description },
          { property: "og:title", content: `${loaderData.title} | Voidmix` },
          { property: "og:description", content: loaderData.description },
          { property: "og:type", content: "article" },
        ]
      : [],
  }),
  component: DocumentationPage,
});

function PageContent({ path, sourceUrl }: { path: string; sourceUrl: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`Documentation content is unavailable: ${path}`);
  const { toc } = use(page.load());
  const Content = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="mb-6 flex border-b border-fd-border pb-4">
        <EditOnGitHub href={sourceUrl} target="_blank" rel="noreferrer">
          View source on GitHub
        </EditOnGitHub>
      </div>
      <DocsBody>
        <Content components={getMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function DocumentationPage() {
  const { path, sourceUrl, pageTree } = useFumadocsLoader(Route.useLoaderData());
  return (
    <DocsLayout {...baseOptions()} tree={pageTree}>
      <Suspense>
        <PageContent path={path} sourceUrl={sourceUrl} />
      </Suspense>
    </DocsLayout>
  );
}
