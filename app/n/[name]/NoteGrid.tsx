"use client";

import Link from "next/link";
import { useState } from "react";
import type { Note } from "@/lib/db";
import PinButton from "./PinButton";
import NoteModal from "./NoteModal";

function preview(body: string) {
  return body.length > 400 ? body.slice(0, 400) + "…" : body;
}

/** The first line doubles as the note's title; whatever follows is the preview. */
function splitTitle(body: string) {
  const trimmed = body.trim();
  const br = trimmed.indexOf("\n");
  if (br === -1) return { title: trimmed, rest: "" };
  return { title: trimmed.slice(0, br), rest: trimmed.slice(br + 1).trim() };
}

export default function NoteGrid({
  notes,
  owner,
}: {
  notes: Note[];
  owner: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Looked up rather than copied, so an edit, a pin or a delete on the server
  // flows straight back into the open sheet — and closes it when the note goes.
  const open = notes.find((n) => n.id === openId) ?? null;

  return (
    <>
      <div className="grid">
        {notes.map((n) => {
          const { title, rest } = splitTitle(n.body);
          return (
            <article
              key={n.id}
              className={n.pinned ? "note pinned" : "note"}
              style={{ background: `var(--${n.color})` }}
            >
              {/* Covers the whole tile so the card stays one click target, while
                  leaving the pin button outside the anchor. It keeps a real href
                  so the permalink still works in a new tab. */}
              <Link
                className="open"
                href={`/n/${encodeURIComponent(owner)}/${n.id}`}
                aria-label={title}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  setOpenId(n.id);
                }}
              />
              <div className="title">{title}</div>
              {rest && <pre>{preview(rest)}</pre>}
              <div className="stamp">
                {new Date(n.updated_at).toLocaleString()}
              </div>
              <PinButton id={n.id} pinned={n.pinned} />
            </article>
          );
        })}
      </div>

      {open && (
        <NoteModal note={open} owner={owner} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
