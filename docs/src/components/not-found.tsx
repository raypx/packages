export function NotFound() {
  return (
    <main className="docs-not-found" aria-labelledby="not-found-title">
      <p className="text-sm text-fd-muted-foreground">404</p>
      <h1 id="not-found-title" className="mt-3 text-3xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-fd-muted-foreground">
        The documentation page you requested is unavailable or has moved.
      </p>
      <a
        href="/docs"
        className="mt-7 inline-flex rounded-md bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
      >
        Browse documentation
      </a>
    </main>
  );
}
