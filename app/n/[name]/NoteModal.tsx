"use client";

import { useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/db";
import NoteDetail from "./NoteDetail";

export default function NoteModal({
  note,
  owner,
  onClose,
}: {
  note: Note;
  owner: string;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

  /** Never throw away a half-written edit without asking. */
  function tryClose() {
    if (editing && !confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  // Once on open only: refocusing on every render would yank the caret out of
  // the textarea on each keystroke.
  useEffect(() => {
    const previous = document.body.style.overflow;
    // Hold the board still behind the blur.
    document.body.style.overflow = "hidden";
    sheet.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Rebound when `editing` changes so the guard above sees the current value.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape belongs to the textarea while typing, not to the dialog.
      const el = document.activeElement;
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return;
      if (editing && !confirm("Discard your unsaved changes?")) return;
      onClose();
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  return (
    <div
      className="backdrop"
      // mousedown, not click: a selection that starts on the note and ends out
      // here should not count as clicking away.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tryClose();
      }}
    >
      <div
        ref={sheet}
        className="sheet"
        style={{ background: `var(--${note.color})` }}
        role="dialog"
        aria-modal="true"
        aria-label={note.body.trim().split("\n")[0]}
        tabIndex={-1}
      >
        <button className="sheet-close" onClick={tryClose} aria-label="Close note">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M4 4 L12 12 M12 4 L4 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Keyed so switching notes rebuilds the editor rather than carrying
            the previous note's draft and view mode across. */}
        <NoteDetail
          key={note.id}
          note={note}
          owner={owner}
          onClose={onClose}
          onEditingChange={setEditing}
        />
      </div>
    </div>
  );
}
