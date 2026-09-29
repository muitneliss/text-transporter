"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { NOTE_COLORS, type NoteColor } from "@/lib/colors";
import { CheckIcon } from "@/lib/icons";

const GAP = 6;
const MARGIN = 8;

/**
 * Menu button (WAI-ARIA menu-button pattern) for a note's paper color, drawn as one more
 * toolbar button. The menu is a `popover="manual"` element: it renders in the top layer, so
 * the sheet's overflow and stacking cannot clip or cover it, and it stays in the DOM where
 * the button is (no portal, no z-index race with the backdrop). Its `position: fixed` box is
 * placed from the button's rect on open and on scroll/resize.
 */
export default function ColorMenu({
  color,
  onChoose,
}: {
  color: NoteColor;
  onChoose: (c: NoteColor) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function place() {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;
    const r = btn.getBoundingClientRect();
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(r.left, vw - w - MARGIN));
    const below = r.bottom + GAP;
    const top =
      below + h + MARGIN <= vh || r.top - GAP - h < MARGIN
        ? Math.max(MARGIN, Math.min(below, vh - h - MARGIN))
        : r.top - GAP - h;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  useLayoutEffect(() => {
    if (!open) return;
    const menu = menuRef.current;
    if (!menu) return;
    if (typeof menu.showPopover === "function") menu.showPopover();
    place();
    itemRefs.current[NOTE_COLORS.indexOf(color)]?.focus();
    return () => {
      if (typeof menu.hidePopover === "function" && menu.matches(":popover-open")) {
        menu.hidePopover();
      }
    };
    // Only re-run on open/close; `color` changing closes the menu anyway.
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
      // A click on the dimmed backdrop dismisses the menu only, not the note under it.
      if (t instanceof Element && t.classList.contains("backdrop")) e.stopPropagation();
    }
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  function focusItem(i: number) {
    const n = NOTE_COLORS.length;
    itemRefs.current[(i + n) % n]?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    // The app root is `document`, so its sibling key listeners (the modal's Esc, the `c`
    // copy shortcut) are only stopped by stopImmediatePropagation; the menu owns its keys.
    e.nativeEvent.stopImmediatePropagation();
    const i = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case "ArrowDown":
        focusItem(i + 1);
        break;
      case "ArrowUp":
        focusItem(i - 1);
        break;
      case "Home":
        focusItem(0);
        break;
      case "End":
        focusItem(NOTE_COLORS.length - 1);
        break;
      case "Escape":
        close(true);
        break;
      case "Tab":
        close(true);
        return;
      default:
        return;
    }
    e.preventDefault();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn icon-only color-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Note color: ${color}`}
        data-tip={`Note color: ${color}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="color-dot" style={{ background: `var(--paper-${color})` }} />
        <span className="color-caret" aria-hidden />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="color-menu"
          role="menu"
          aria-label="Note color"
          popover="manual"
          onKeyDown={onMenuKeyDown}
        >
          {NOTE_COLORS.map((c, i) => (
            <button
              key={c}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={c === color}
              tabIndex={-1}
              className="color-item"
              onClick={() => {
                onChoose(c);
                close(true);
              }}
            >
              <span className="color-dot" style={{ background: `var(--paper-${c})` }} />
              <span className="color-name">{c}</span>
              {c === color && <CheckIcon className="icon color-check" />}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
