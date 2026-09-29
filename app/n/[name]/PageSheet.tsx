"use client";

import { useState } from "react";
import type { Note } from "@/lib/db";
import NoteDetail from "./NoteDetail";

export default function PageSheet({ note, owner }: { note: Note; owner: string }) {
  const [color, setColor] = useState(note.color);
  return (
    <div className="sheet page" style={{ background: `var(--paper-${color})` }}>
      <NoteDetail note={note} owner={owner} onColorChange={setColor} />
    </div>
  );
}
