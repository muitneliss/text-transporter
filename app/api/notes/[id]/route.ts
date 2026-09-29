import { NextRequest, NextResponse } from "next/server";
import { isNoteColor } from "@/lib/colors";
import { deleteNote, getNote, isNoteView, setColor, setPinned, setView, updateNoteBody } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { body, pinned, baseBody, view, color } = await req.json();

  // Either field may arrive on its own: the editor sends a body, the pin button
  // sends a flag, and neither should be forced to resend the other.
  if (body === undefined && pinned === undefined && view === undefined && color === undefined)
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  // The view is not an edit and must never ride on the conflict-checked body path,
  // where a rejected body would silently drop it.
  if (body !== undefined && view !== undefined)
    return NextResponse.json({ error: "view cannot be combined with body" }, { status: 400 });

  // Checked before anything is applied so a bad view can't leave a half-done request.
  if (view !== undefined && !isNoteView(view))
    return NextResponse.json({ error: "invalid view" }, { status: 400 });

  // Same reasoning as the view: a recolor is not an edit.
  if (body !== undefined && color !== undefined)
    return NextResponse.json({ error: "color cannot be combined with body" }, { status: 400 });

  if (color !== undefined && !isNoteColor(color))
    return NextResponse.json({ error: "invalid color" }, { status: 400 });

  if (!getNote(id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  // No body means this is purely a pin/view request: nothing else has to
  // succeed first, so applying it here is already as late as it can be.
  if (body === undefined) {
    if (pinned !== undefined) setPinned(id, Boolean(pinned));
    if (view !== undefined) setView(id, view);
    if (color !== undefined) setColor(id, color);
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
