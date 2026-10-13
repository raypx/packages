import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: "Raypx Packages", url: "/docs" },
    githubUrl: "https://github.com/raypx/packages",
  };
}
