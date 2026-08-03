import Link from "next/link";
import { listNotes, normalizeOwner } from "@/lib/db";
import Composer from "./Composer";

export const dynamic = "force-dynamic";

function preview(body: string) {
  return body.length > 400 ? body.slice(0, 400) + "…" : body;
}

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

      {notes.length === 0 ? (
        <div className="empty">Nothing here yet. Paste something above.</div>
      ) : (
        <div className="grid">
          {notes.map((n) => (
            <Link
              key={n.id}
              href={`/n/${encodeURIComponent(owner)}/${n.id}`}
              className="note"
              style={{ background: `var(--${n.color})` }}
            >
              <pre>{preview(n.body)}</pre>
              <div className="stamp">
                {new Date(n.updated_at).toLocaleString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
