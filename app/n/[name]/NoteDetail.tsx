"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Note } from "@/lib/db";
import Markdown from "@/lib/markdown";
import { copyText } from "@/lib/clipboard";
import { CopyIcon, CheckIcon, PencilIcon, TrashIcon, ExpandIcon, MinimizeIcon } from "@/lib/icons";
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
  /** The body as it was when edit mode was entered — sent back as `baseBody` so the
   *  server can tell a stale save from a fresh one. */
  const [baseBody, setBaseBody] = useState(note.body);
  /** The freshest body this component actually knows about, from our own save's
   *  response or a conflict's `current` — NOT the `note` prop, which only catches
   *  up once `router.refresh()` finishes. View mode, Edit and Cancel all read this
   *  instead, so a quick Edit right after a successful save can't hand the server
   *  a stale `baseBody` and manufacture a conflict with yourself. */
  const [latest, setLatest] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  /** Set only when a save/delete lands on a note someone else already changed.
   *  The draft in `body` is never touched by any of these — only the three
   *  panel actions (or Cancel) may replace or discard it. */
  const [conflict, setConflict] = useState<
    | null
    | { kind: "conflict"; current: Note }
    | { kind: "notFound" }
    | { kind: "network"; message?: string }
  >(null);
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
  const conflictRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const copied = copyTick > 0;
  /** One expression gates the overlay's markup and the effect that opens it, so
   *  `expanded` can never outlive the overlay and slam it back over the editor. */
  const overlayOpen = expanded && !editing;

  // Lets the modal know there are unsaved edits worth guarding.
  useEffect(() => onEditingChange?.(editing), [editing, onEditingChange]);

  // iOS Safari doesn't shrink 100dvh when the on-screen keyboard opens, so a
  // full-bleed mobile editor sized off it would sit half behind the keyboard.
  // visualViewport does shrink, so --vvh (read by the mobile CSS) tracks it
  // instead while editing; Android's own fix is the layout's viewport export.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!editing || !vv) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--vvh", `${vv.height}px`);
    update();
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      root.style.removeProperty("--vvh");
    };
  }, [editing]);

  // Catches up whenever the prop eventually does (an external change, a pin
  // toggle's refresh, first mount) — but our own save() already moved `latest`
  // ahead of the prop the moment it got a response, so this never has to be
  // the first to know.
  useEffect(() => {
    setLatest(note.body);
  }, [note.body]);

  // autoFocus alone tends to land the caret at the start of a pre-filled field;
  // editing a note is almost always adding to the end, so put it there explicitly.
  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, [editing]);

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

  // Moves focus onto the panel the moment it appears and announces it via role="alert",
  // rather than leaving focus stranded in a textarea the user can no longer usefully type into.
  useEffect(() => {
    if (conflict) conflictRef.current?.focus();
  }, [conflict]);

  async function copy() {
    const ok = await copyText(latest);
    if (ok) setCopyTick((tick) => tick + 1);
    else alert("Clipboard blocked — select the text and copy manually.");
  }

  // 'c' copies the open note, as long as focus isn't in a field and no
  // modifier is held — same guard the board's own shortcuts use.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (editing) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el as HTMLElement | null)?.isContentEditable
      )
        return;
      copy();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, latest]);

  /** `base` defaults to what edit mode started from; "Overwrite with mine" passes
   *  the other side's current body instead, so a repeat conflict is possible but a
   *  stale overwrite is not. */
  async function save(base: string = baseBody) {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, baseBody: base }),
      });
      if (res.status === 409) {
        const { current } = await res.json();
        setLatest(current.body);
        // A retry whose earlier response got lost looks identical to a real
        // conflict from here — but if the stored text already matches what we
        // just tried to save, our save landed; there is nothing to resolve.
        if (current.body === body) {
          setConflict(null);
          setEditing(false);
          router.refresh();
          return;
        }
        setConflict({ kind: "conflict", current });
        return;
      }
      if (res.status === 404) {
        setConflict({ kind: "notFound" });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setConflict({ kind: "network", message: data?.error });
        return;
      }
      const { note: saved } = await res.json();
      setLatest(saved.body);
      setConflict(null);
      setEditing(false);
      router.refresh();
    } catch {
      setConflict({ kind: "network" });
    } finally {
      setBusy(false);
    }
  }

  /** Keeps the draft, drops the conflict it's tied to, and posts it as a brand
   *  new note under the same owner/color — used for both a save conflict and a
   *  delete-while-editing, so neither ever has to touch the note that beat it. */
  async function saveAsNew() {
    setBusy(true);
    try {
      const res = await fetch(`/api/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner, body, color: note.color }),
      });
      if (!res.ok) throw new Error();
      // The note this editor points at may itself be gone (a notFound conflict):
      // refreshing this same URL in place would 404 it, so leave rather than reload.
      const wasDeleted = conflict?.kind === "notFound";
      setConflict(null);
      setEditing(false);
      if (wasDeleted) {
        if (onClose) onClose();
        else router.push(`/n/${encodeURIComponent(owner)}`);
      }
      router.refresh();
    } catch {
      alert("Could not save as a new note.");
    } finally {
      setBusy(false);
    }
  }

  /** Throws the draft away and shows whatever the other side actually saved. */
  function discardMine(current: Note) {
    setBody(current.body);
    setLatest(current.body);
    setConflict(null);
    setEditing(false);
    router.refresh();
  }

  /** The note itself is gone — nothing to load, so this just leaves the editor. */
  function discardAfterDelete() {
    setConflict(null);
    if (onClose) onClose();
    else router.push(`/n/${encodeURIComponent(owner)}`);
    router.refresh();
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
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
        />
      ) : rendered ? (
        <Markdown source={latest} />
      ) : (
        <pre>{latest}</pre>
      )}

      {editing && conflict && (
        <div
          className="conflict"
          role="alert"
          tabIndex={-1}
          ref={conflictRef}
        >
          {conflict.kind === "conflict" && (
            <>
              <p className="conflict-msg">
                Someone else saved this note while you were editing. Your draft is
                still here — theirs is below.
              </p>
              <pre className="conflict-body">{conflict.current.body}</pre>
              <div className="conflict-actions">
                <button className="btn primary" onClick={() => save(conflict.current.body)} disabled={busy}>
                  Overwrite with mine
                </button>
                <button className="btn" onClick={saveAsNew} disabled={busy}>
                  Save mine as a new note
                </button>
                <button className="btn" onClick={() => discardMine(conflict.current)} disabled={busy}>
                  Discard mine
                </button>
              </div>
            </>
          )}
          {conflict.kind === "notFound" && (
            <>
              <p className="conflict-msg">
                This note was deleted while you were editing. Your draft is still here.
              </p>
              <div className="conflict-actions">
                <button className="btn primary" onClick={saveAsNew} disabled={busy}>
                  Save as a new note
                </button>
                <button className="btn" onClick={discardAfterDelete} disabled={busy}>
                  Discard
                </button>
              </div>
            </>
          )}
          {conflict.kind === "network" && (
            <>
              <p className="conflict-msg">
                {conflict.message ?? "Could not reach the server."} Your draft is still here.
              </p>
              <div className="conflict-actions">
                <button className="btn primary" onClick={() => save()} disabled={busy}>
                  Retry
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>

      <div className="bar">
        {editing ? (
          <>
            <button className="btn primary" onClick={() => save()} disabled={busy || !body.trim()}>
              Save
            </button>
            <button
              className="btn"
              onClick={() => {
                setBody(latest);
                setConflict(null);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              className="btn primary icon-only"
              onClick={copy}
              aria-label={copied ? "Copied" : "Copy note"}
              data-tip={copied ? "Copied" : "Copy note (c)"}
            >
              {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
            </button>
            {/* Editing exits the expanded view rather than merely outranking it: leaving
                `expanded` set would let Cancel or Save hand the overlay straight back. */}
            <button
              className="btn icon-only"
              onClick={() => {
                setExpanded(false);
                setBaseBody(latest);
                setBody(latest);
                setConflict(null);
                setEditing(true);
              }}
              aria-label="Edit note"
              data-tip="Edit note"
            >
              <PencilIcon className="icon" />
            </button>
            <PinButton id={note.id} pinned={note.pinned} label />
            <button
              className="btn danger icon-only"
              onClick={remove}
              disabled={busy}
              aria-label="Delete note"
              data-tip="Delete note"
            >
              <TrashIcon className="icon" />
            </button>
            {/* After Delete but before the toggle, which owns the right edge: every
                existing control keeps the position muscle memory expects. */}
            {canExpand && (
              <button
                className="btn icon-only"
                ref={expandRef}
                aria-haspopup="dialog"
                aria-label="Expand note"
                data-tip="Expand note"
                onClick={() => setExpanded(true)}
              >
                <ExpandIcon className="icon" />
              </button>
            )}

            {viewToggle}
          </>
        )}
      </div>

      {/*
        Portalled to <body> for the cascade, not the stacking: showModal() already lifts
        the dialog into the top layer, but this component renders inside a pastel .sheet
        on both the board and the permalink page, and `.sheet .btn`, `.sheet .md a` and
        friends would repaint the dark reader as ink on paper. Outside that wrapper the
        overlay just inherits the app's own dark styling.
      */}
      {canExpand &&
        createPortal(
          <dialog
            className="expand"
            ref={dialogRef}
            style={{ background: `var(--paper-${note.color})` }}
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
                <div className="expand-stripe" />

                {/* The other live region lives outside this dialog, which
                    showModal() makes inert while open — screen readers won't
                    reach it, so the announcement needs its own copy in here. */}
                <span className="sr-only" aria-live="polite">
                  {copied ? "Copied" : ""}
                </span>

                <div className="expand-bar">
                  <div className="expand-meta">
                    {latest.length.toLocaleString()} characters · Esc closes
                  </div>
                  {viewToggle}
                  <button
                    className="btn primary icon-only tip-below"
                    onClick={copy}
                    aria-label={copied ? "Copied" : "Copy note"}
                    data-tip={copied ? "Copied" : "Copy note (c)"}
                  >
                    {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
                  </button>
                  {/* Clears the state and lets the effect close the dialog, rather than
                      closing the dialog and waiting to hear about it. */}
                  <button
                    className="btn icon-only tip-below"
                    onClick={() => setExpanded(false)}
                    aria-label="Close expanded view"
                    data-tip="Close (Esc)"
                  >
                    <MinimizeIcon className="icon" />
                  </button>
                </div>

                {/*
                  tabIndex is not decoration: Chrome and Safari do not focus scrollable
                  regions on their own, so without it Page Down and the arrow keys do
                  nothing on a long note. role and label give that tab stop a name. It
                  reads `latest`, never the `body` draft, so it always agrees with what
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
                    <Markdown source={latest} />
                  ) : (
                    <pre className="expand-text">{latest}</pre>
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
