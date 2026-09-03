import Link from "next/link";
import { listNotes, normalizeOwner } from "@/lib/db";
import Composer from "./Composer";
import NoteGrid from "./NoteGrid";

export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const owner = normalizeOwner(decodeURIComponent(name));
  const notes = listNotes(owner);

  return (
    <main className="wrap">
      <div className="top">
        <div>
          <h1>{owner}</h1>
          <div className="sub">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </div>
        </div>
        <Link className="back" href="/">
          ← switch name
        </Link>
      </div>

      <Composer owner={owner} />

      <hr className="divider" />

      {notes.length === 0 ? (
        <div className="empty">Nothing here yet. Paste something above.</div>
      ) : (
        <NoteGrid notes={notes} owner={owner} />
      )}
    </main>
  );
}
