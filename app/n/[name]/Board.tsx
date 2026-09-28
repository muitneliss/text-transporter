"use client";

import { useMemo, useState, useEffect } from "react";
import type { Note } from "@/lib/db";
import Composer from "./Composer";
import NoteGrid from "./NoteGrid";
import NoteModal from "./NoteModal";

const COLORS = ["yellow", "pink", "blue", "green", "purple"];

function isTypingTarget(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

/** `/` focuses search, `n` focuses the composer, Esc blurs the active field
 *  unless a note is open (its own modal owns Esc there). */
function useBoardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const active = document.activeElement as HTMLElement | null;
        if (isTypingTarget(active) && !document.querySelector(".backdrop")) active?.blur();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isTypingTarget(document.activeElement)) return;
      // Don't steal focus from an open note: its modal or Expand reader owns
      // the keyboard while up.
      if (document.querySelector(".backdrop") || document.querySelector("dialog[open]")) return;

      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("board-search")?.focus();
      } else if (e.key === "n") {
        e.preventDefault();
        document.getElementById("composer-write-tab")?.click();
        requestAnimationFrame(() => {
          document.getElementById("composer-field")?.focus();
        });
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export default function Board({ owner, notes }: { owner: string; notes: Note[] }) {
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useBoardShortcuts();

  // Looked up against the unfiltered list, so a note stays open — instead of
  // silently closing — when it stops matching the search or filters, e.g.
  // unpinning it while the "pinned" chip is on, or editing out the search term.
  const open = notes.find((n) => n.id === openId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (q && !n.body.toLowerCase().includes(q)) return false;
      if (colors.length && !colors.includes(n.color)) return false;
      if (pinnedOnly && !n.pinned) return false;
      return true;
    });
  }, [notes, query, colors, pinnedOnly]);

  const filtersActive = query.trim() !== "" || colors.length > 0 || pinnedOnly;

  function toggleColor(c: string) {
    setColors((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
  }

  function clearFilters() {
    setQuery("");
    setColors([]);
    setPinnedOnly(false);
  }

  return (
    <>
      <Composer owner={owner} />

      <hr className="divider" />

      {notes.length === 0 ? (
        <div className="empty">Nothing here yet. Add a note above.</div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <input
                id="board-search"
                className="field search-field"
                type="search"
                placeholder="Search notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd className="search-hint">/</kbd>
            </div>

            <div className="chips">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="chip"
                  aria-pressed={colors.includes(c)}
                  onClick={() => toggleColor(c)}
                >
                  <span className="chip-dot" style={{ background: `var(--paper-${c})` }} />
                  {c}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                aria-pressed={pinnedOnly}
                onClick={() => setPinnedOnly((v) => !v)}
              >
                pinned
              </button>
              {filtersActive && (
                <button type="button" className="chip clear" onClick={clearFilters}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">
              <span>No notes match your search or filters.</span>
              <button type="button" className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <NoteGrid notes={filtered} owner={owner} onOpen={setOpenId} />
          )}
        </>
      )}

      {open && (
        <NoteModal note={open} owner={owner} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
