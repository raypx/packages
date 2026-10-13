import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogFooter,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SearchItemType,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";

const defaultItems: SearchItemType[] = [
  { type: "page", id: "overview", content: "Overview", url: "/docs" },
  { type: "page", id: "drizzle", content: "Drizzle", url: "/docs/drizzle" },
  { type: "page", id: "intl", content: "Intl", url: "/docs/intl" },
];

function EmptySearchResults() {
  return (
    <p role="status" className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
      No matching pages. Try an API name or a shorter search.
    </p>
  );
}

export default function DocsSearchDialog(props: SharedProps) {
  const search = useStaticSearch({ from: "/api/search" });

  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent className="docs-search">
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput aria-label="Search documentation" />
          <SearchDialogClose />
        </SearchDialogHeader>
        {search.error ? (
          <p role="alert" className="px-4 py-10 text-center text-sm text-fd-muted-foreground">
            Search is unavailable. Reload the page to try again, or browse the documentation
            sidebar.
          </p>
        ) : (
          <SearchDialogList defaultItems={defaultItems} Empty={EmptySearchResults} />
        )}
        <SearchDialogFooter>
          <p role="status" aria-live="polite" className="text-xs text-fd-muted-foreground">
            {search.isLoading
              ? "Searching documentation…"
              : "Search APIs, guides, and capability inventories."}
          </p>
          <p className="mt-2 text-xs text-fd-muted-foreground">
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to
            close
          </p>
        </SearchDialogFooter>
      </SearchDialogContent>
    </SearchDialog>
  );
}
