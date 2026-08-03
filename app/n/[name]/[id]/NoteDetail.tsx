"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Note } from "@/lib/db";

export default function NoteDetail({ note, owner }: { note: Note; owner: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
      router.push(`/n/${encodeURIComponent(owner)}`);
      router.refresh();
    } catch {
      setBusy(false);
      alert("Could not delete.");
    }
  }

  return (
    <div className="detail">
      <div className="stripe" style={{ background: `var(--${note.color})` }} />

      {editing ? (
        <textarea
          className="field"
          style={{ minHeight: 320 }}
          value={body}
          autoFocus
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
          }}
        />
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
            <button className="btn danger" onClick={remove} disabled={busy}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
