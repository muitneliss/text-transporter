import { NextRequest, NextResponse } from "next/server";
import { deleteNote, updateNote } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { body } = await req.json();
  const text = String(body ?? "");
  if (!text.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > MAX_BODY)
    return NextResponse.json({ error: "note too long" }, { status: 413 });

  const note = updateNote(id, text);
  if (!note) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ note });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  deleteNote(id);
  return new NextResponse(null, { status: 204 });
}
