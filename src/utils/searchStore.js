import { useSyncExternalStore } from "react";

// Whether the quick-search dialog is open. Kept outside React so the header
// button, the Ctrl+K shortcut and the dialog itself can all reach it.
let isOpen = false;
const listeners = new Set();

function set(next) {
  if (next === isOpen) return;
  isOpen = next;
  listeners.forEach((l) => l());
}

export const openSearch = () => set(true);
export const closeSearch = () => set(false);

export function useSearchOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => isOpen,
  );
}
