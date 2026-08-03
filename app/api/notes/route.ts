import { NextRequest, NextResponse } from "next/server";
import { createNote, listNotes, normalizeOwner } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 100_000;
const COLORS = ["yellow", "pink", "blue", "green", "purple"];

export async function GET(req: NextRequest) {
  const owner = normalizeOwner(req.nextUrl.searchParams.get("owner") ?? "");
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });
  return NextResponse.json({ notes: listNotes(owner) });
}

export async function POST(req: NextRequest) {
  const { owner: rawOwner, body, color } = await req.json();
  const owner = normalizeOwner(String(rawOwner ?? ""));
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });

  const text = String(body ?? "");
  if (!text.trim()) return NextResponse.json({ error: "body required" }, { status: 400 });
  if (text.length > MAX_BODY)
    return NextResponse.json({ error: "note too long" }, { status: 413 });

  const picked = COLORS.includes(color) ? color : "yellow";
  return NextResponse.json({ note: createNote(owner, text, picked) }, { status: 201 });
}
