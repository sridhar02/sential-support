import { useEffect, type RefObject } from "react";

export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'textarea',
      'input',
      'select',
      '[tabindex]:not([tabindex="-1"])'
    ];

    const updateFocusables = () => {
      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors.join(',')));
    };

    const focusables = updateFocusables();
    focusables[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        container.dispatchEvent(new CustomEvent("focus-trap-close", { bubbles: true }));
        return;
      }
      if (event.key !== "Tab") return;
      const list = updateFocusables();
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, active]);
}
