import { NextRequest, NextResponse } from "next/server";
import { deleteNote, getNote, setPinned, updateNoteBody } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { body, pinned, baseBody } = await req.json();

  // Either field may arrive on its own: the editor sends a body, the pin button
  // sends a flag, and neither should be forced to resend the other.
  if (body === undefined && pinned === undefined)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  if (!getNote(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  // No body means this is purely a pin/color-style request: nothing else has
  // to succeed first, so applying it here is already as late as it can be.
  if (body === undefined) {
    if (pinned !== undefined) setPinned(id, Boolean(pinned));
    return NextResponse.json({ note: getNote(id) });
  }

  const text = String(body ?? "");
  if (!text.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > MAX_BODY)
    return NextResponse.json({ error: "note too long" }, { status: 413 });

  // Optional so callers that predate optimistic concurrency keep working: the
  // app's own editor always sends it, this only covers older/other clients.
  if (baseBody !== undefined && typeof baseBody !== "string")
    return NextResponse.json({ error: "invalid baseBody" }, { status: 400 });
  if (typeof baseBody === "string" && baseBody.length > MAX_BODY)
    return NextResponse.json({ error: "note too long" }, { status: 413 });

  const result = updateNoteBody(id, baseBody, text);
  if ("notFound" in result) return NextResponse.json({ error: "not found" }, { status: 404 });
  if ("conflict" in result)
    return NextResponse.json({ error: "conflict", current: result.current }, { status: 409 });

  // A combined request only pins once the body it rode in on actually landed —
  // a rejected or conflicting body must never leave a side effect behind.
  if (pinned !== undefined) setPinned(id, Boolean(pinned));
  return NextResponse.json({ note: pinned !== undefined ? getNote(id) : result.note });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  deleteNote(id);
  return new NextResponse(null, { status: 204 });
}
