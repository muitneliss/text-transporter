"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@/lib/db";
import Markdown from "@/lib/markdown";
import PinButton from "./PinButton";

/**
 * The note's contents and controls, with no frame of its own: the board wraps it
 * in a sticky-shaped modal sheet, the permalink page wraps it in a panel.
 * Pass onClose when it lives in the modal — Delete closes instead of navigating.
 */
export default function NoteDetail({
  note,
  owner,
  onClose,
  onEditingChange,
}: {
  note: Note;
  owner: string;
  onClose?: () => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** A counter, not a boolean: copying again has to restart the 1500ms window, and only
   *  a value that actually changes re-runs the effect that owns the timer. */
  const [copyTick, setCopyTick] = useState(0);
  /** Gates both the Expand button and the portal below. Doubles as the mounted flag the
   *  portal needs, and keeps showModal off browsers that lack it — it would throw out of
   *  an effect, and with no error boundary here the whole note would disappear. */
  const [canExpand, setCanExpand] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const readerScroll = useRef(0);

  const copied = copyTick > 0;
  /** One expression gates the overlay's markup and the effect that opens it, so
   *  `expanded` can never outlive the overlay and slam it back over the editor. */
  const overlayOpen = expanded && !editing;

  // Lets the modal know there are unsaved edits worth guarding.
  useEffect(() => onEditingChange?.(editing), [editing, onEditingChange]);

  useEffect(() => {
    setCanExpand(
      typeof HTMLDialogElement !== "undefined" && "showModal" in HTMLDialogElement.prototype
    );
  }, []);

  // The timer belongs to the render that started it: copying again replaces it and
  // unmounting clears it, so nothing sets state after teardown.
  useEffect(() => {
    if (copyTick === 0) return;
    const timer = setTimeout(() => setCopyTick(0), 1500);
    return () => clearTimeout(timer);
  }, [copyTick]);

  /**
   * showModal() rather than a plain <dialog open>: only the modal form makes the rest of
   * the document inert, which keeps find-in-page, Select All and screen readers out of
   * the copy of this note sitting behind it. It also brings the top layer, a Tab trap and
   * Escape for free. The .open guards keep it idempotent under double-invoked effects.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (overlayOpen && !dialog.open) {
      dialog.showModal();
      const reader = readerRef.current;
      if (reader) {
        reader.scrollTop = readerScroll.current;
        // preventScroll so focusing does not undo the offset just restored.
        reader.focus({ preventScroll: true });
      }
    } else if (!overlayOpen && dialog.open) {
      dialog.close();
    }
  }, [overlayOpen]);

  // Deleting the note tears this component down while the dialog may still be modal.
  // Closing it runs the close steps rather than removing an open modal from the document.
  useEffect(() => {
    const dialog = dialogRef.current;
    return () => dialog?.close();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(note.body);
      setCopyTick((tick) => tick + 1);
    } catch {
      alert("Clipboard blocked — select the text and copy manually.");
    }
  }

  async function save() {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      alert("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this note?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (onClose) onClose();
      else router.push(`/n/${encodeURIComponent(owner)}`);
      router.refresh();
    } catch {
      setBusy(false);
      alert("Could not delete.");
    }
  }

  const viewToggle = (
    <div className="seg" role="group" aria-label="Render as">
      <button className="seg-btn" aria-pressed={!rendered} onClick={() => setRendered(false)}>
        Text
      </button>
      <button className="seg-btn" aria-pressed={rendered} onClick={() => setRendered(true)}>
        Markdown
      </button>
    </div>
  );

  return (
    <>
      {editing ? (
        <textarea
          className="field"
          value={body}
          autoFocus
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
        />
      ) : rendered ? (
        <Markdown source={note.body} />
      ) : (
        <pre>{note.body}</pre>
      )}

      <div className="bar">
        {editing ? (
          <>
            <button className="btn primary" onClick={save} disabled={busy || !body.trim()}>
              Save
            </button>
            <button
              className="btn"
              onClick={() => {
                setBody(note.body);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" onClick={copy}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            {/* Editing exits the expanded view rather than merely outranking it: leaving
                `expanded` set would let Cancel or Save hand the overlay straight back. */}
            <button
              className="btn"
              onClick={() => {
                setExpanded(false);
                setEditing(true);
              }}
            >
              Edit
            </button>
            <PinButton id={note.id} pinned={note.pinned} label />
            <button className="btn danger" onClick={remove} disabled={busy}>
              Delete
            </button>
            {/* After Delete but before the toggle, which owns the right edge: every
                existing control keeps the position muscle memory expects. */}
            {canExpand && (
              <button
                className="btn"
                ref={expandRef}
                aria-haspopup="dialog"
                onClick={() => setExpanded(true)}
              >
                Expand
              </button>
            )}

            {viewToggle}
          </>
        )}
      </div>

      {/*
        Portalled to <body> for the cascade, not the stacking: showModal() already lifts
        the dialog into the top layer, but this component renders inside .sheet on the
        board and .detail on the permalink page, and `.sheet .btn`, `.sheet .md a` and
        `.detail pre` would all repaint the dark reader as ink-on-paper. Outside both
        wrappers the overlay just inherits the app's own dark styling.
      */}
      {canExpand &&
        createPortal(
          <dialog
            className="expand"
            ref={dialogRef}
            aria-label="Expanded note"
            // Escape asks to close here. Clearing the state — rather than letting the
            // dialog close itself and reporting it afterwards — keeps React the single
            // source of truth, which is what the effect above syncs the DOM to.
            onCancel={() => setExpanded(false)}
            onClose={() => {
              // A backstop, plus the one place focus is handed back. Both `cancel` and
              // `close` come from queued tasks a background tab can defer, so nothing that
              // has to be correct is left to them alone. The reading position is NOT read
              // off the reader here — by now the dialog is display:none, and a box-less
              // element reports scrollTop 0.
              setExpanded(false);
              expandRef.current?.focus();
            }}
          >
            {overlayOpen && (
              <>
                <div className="expand-stripe" style={{ background: `var(--${note.color})` }} />

                <div className="expand-bar">
                  <div className="expand-meta">
                    {note.body.length.toLocaleString()} characters · Esc closes
                  </div>
                  {viewToggle}
                  <button className="btn primary" onClick={copy}>
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                  {/* Clears the state and lets the effect close the dialog, rather than
                      closing the dialog and waiting to hear about it. */}
                  <button className="btn" onClick={() => setExpanded(false)}>
                    Close
                  </button>
                </div>

                {/*
                  tabIndex is not decoration: Chrome and Safari do not focus scrollable
                  regions on their own, so without it Page Down and the arrow keys do
                  nothing on a long note. role and label give that tab stop a name. It
                  reads note.body, never the `body` draft, so it always agrees with what
                  Copy puts on the clipboard.
                */}
                <div
                  className="expand-reader"
                  ref={readerRef}
                  tabIndex={0}
                  role="region"
                  aria-label="Note text"
                  onScroll={(e) => {
                    readerScroll.current = e.currentTarget.scrollTop;
                  }}
                >
                  {rendered ? (
                    <Markdown source={note.body} />
                  ) : (
                    <pre className="expand-text">{note.body}</pre>
                  )}
                </div>
              </>
            )}
          </dialog>,
          document.body
        )}
    </>
  );
}
