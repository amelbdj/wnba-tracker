import { Suspense, lazy, useEffect } from "react";
import { closeSearch, openSearch, useSearchOpen } from "../utils/searchStore";

// Loaded only when the search is first opened.
const SearchModal = lazy(() => import("./SearchModal"));

// Mounted once for the whole app: Ctrl/Cmd+K toggles the search from any
// page, and the header button opens it through the same store.
export default function GlobalSearch() {
  const open = useSearchOpen();

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closeSearch();
        else openSearch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return open ? (
    <Suspense fallback={null}>
      <SearchModal />
    </Suspense>
  ) : null;
}
