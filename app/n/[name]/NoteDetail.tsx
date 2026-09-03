"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [copied, setCopied] = useState(false);
  const [rendered, setRendered] = useState(false);

  // Lets the modal know there are unsaved edits worth guarding.
  useEffect(() => onEditingChange?.(editing), [editing, onEditingChange]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(note.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <PinButton id={note.id} pinned={note.pinned} label />
            <button className="btn danger" onClick={remove} disabled={busy}>
              Delete
            </button>

            <div className="seg" role="group" aria-label="Render as">
              <button
                className="seg-btn"
                aria-pressed={!rendered}
                onClick={() => setRendered(false)}
              >
                Text
              </button>
              <button
                className="seg-btn"
                aria-pressed={rendered}
                onClick={() => setRendered(true)}
              >
                Markdown
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
