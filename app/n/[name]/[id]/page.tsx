import Link from "next/link";
import { notFound } from "next/navigation";
import { getNote, normalizeOwner } from "@/lib/db";
import PageSheet from "../PageSheet";

export const dynamic = "force-dynamic";

export default async function NotePage({
  params,
}: {
  params: Promise<{ name: string; id: string }>;
}) {
  const { name, id } = await params;
  const owner = normalizeOwner(decodeURIComponent(name));
  const note = getNote(id);
  if (!note || note.owner !== owner) notFound();

  return (
    <main className="wrap">
      <div className="top">
        <div>
          <h1>{owner}</h1>
          <div className="sub">
            created {new Date(note.created_at).toLocaleString()}
          </div>
        </div>
        <Link className="back" href={`/n/${encodeURIComponent(owner)}`}>
          ← all notes
        </Link>
      </div>

      {/* The same sheet of paper the board opens in a modal, sized to the page:
          opening a note by URL should not turn it grey. */}
      <PageSheet note={note} owner={owner} />
    </main>
  );
}
