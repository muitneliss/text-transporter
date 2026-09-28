"use client";

import Link from "next/link";
import type { Note } from "@/lib/db";
import PinButton from "./PinButton";

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
  onOpen,
}: {
  notes: Note[];
  owner: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid">
      {notes.map((n) => {
        const { title, rest } = splitTitle(n.body);
        return (
          <article
            key={n.id}
            className={n.pinned ? "note pinned" : "note"}
            style={{ background: `var(--paper-${n.color})` }}
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
                onOpen(n.id);
              }}
            />
            <PinButton id={n.id} pinned={n.pinned} />
            <div className="title">{title}</div>
            {rest && <pre>{preview(rest)}</pre>}
            <div className="stamp">
              {new Date(n.updated_at).toLocaleString()}
            </div>
          </article>
        );
      })}
    </div>
  );
}
