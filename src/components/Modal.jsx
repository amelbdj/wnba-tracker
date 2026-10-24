import { useEffect, useRef, useState } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

// The overlay + panel every dialog in the app uses. Escape and a click on the
// backdrop close it; Tab stays inside it; focus moves in when it opens and
// goes back to whatever opened it (the match card, say) when it closes; and
// the page behind doesn't scroll.
export default function Modal({ onClose, label, className = "", overlayClassName = "", children }) {
  const panel = useRef(null);
  // Read before any child autofocuses, so focus can go back to what opened it.
  const [opener] = useState(() => document.activeElement);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const node = panel.current;
    // A child (the search field, say) may already have taken focus.
    if (node && !node.contains(document.activeElement)) node.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const items = [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  return (
    <div className={`modal${overlayClassName ? ` ${overlayClassName}` : ""}`} onClick={onClose}>
      <div
        ref={panel}
        className={`modal-content${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
