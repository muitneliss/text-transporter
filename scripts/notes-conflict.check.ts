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

// No baseBody (older/other callers): applies unconditionally, no conflict check.
{
  const note = createNote("tester", "some body", "yellow");
  const result = updateNoteBody(note.id, undefined, "overwrite without a base");
  assert.ok("ok" in result && result.ok, "omitting baseBody must skip the conflict check");
  assert.equal(getNote(note.id)?.body, "overwrite without a base");
}

// A thrown error mid-transaction must not leave a stuck lock: the rollback
// still fires (guarded by conn.isTransaction, not blind), and the next call
// against the same note succeeds normally rather than hanging or erroring.
{
  const note = createNote("tester", "before throw", "yellow");
  assert.throws(() => updateNoteBody(note.id, "before throw", undefined as unknown as string));
  const result = updateNoteBody(note.id, "before throw", "recovered");
  assert.ok("ok" in result && result.ok, "a later call must still work after a mid-transaction throw");
  assert.equal(getNote(note.id)?.body, "recovered");
}

console.log("notes-conflict.check.ts: all checks passed");
