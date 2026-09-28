import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "notes-conflict-check-"));

const { createNote, getNote, setPinned, updateNoteBody } = await import("../lib/db.ts");

// A normal update succeeds.
{
  const note = createNote("tester", "hello", "yellow");
  const result = updateNoteBody(note.id, "hello", "world");
  assert.ok("ok" in result && result.ok, "expected ok result for a fresh base");
  assert.equal(getNote(note.id)?.body, "world");
}

// A stale base returns conflict and leaves the stored body unchanged.
{
  const note = createNote("tester", "original", "yellow");
  updateNoteBody(note.id, "original", "changed by someone else");
  const result = updateNoteBody(note.id, "original", "my stale edit");
  assert.ok("conflict" in result, "expected a conflict result for a stale base");
  if ("conflict" in result) assert.equal(result.current.body, "changed by someone else");
  assert.equal(getNote(note.id)?.body, "changed by someone else");
}

// A missing id returns notFound.
{
  const result = updateNoteBody("no-such-id", "anything", "new body");
  assert.ok("notFound" in result, "expected notFound for a missing id");
}

// A pin/color change between load and save does NOT cause a conflict.
{
  const note = createNote("tester", "pin me", "yellow");
  setPinned(note.id, true); // someone else pins it while this edit is in flight
  const result = updateNoteBody(note.id, "pin me", "still not a conflict");
  assert.ok("ok" in result && result.ok, "a pin change must not trip the body conflict check");
  assert.equal(getNote(note.id)?.body, "still not a conflict");
  assert.equal(getNote(note.id)?.pinned, true);
}

console.log("notes-conflict.check.ts: all checks passed");
