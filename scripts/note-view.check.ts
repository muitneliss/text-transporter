import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "note-view-check-"));

const { createNote, getNote, isNoteView, listNotes, setView, updateNoteBody } = await import("../lib/db.ts");

const a = createNote("tester", "note a", "yellow");
const b = createNote("tester", "note b", "blue");
assert.equal(a.view, "text", "new notes default to Text");

const before = listNotes("tester").map((n) => n.id);
await new Promise((r) => setTimeout(r, 5));
const set = setView(a.id, "markdown");
assert.equal(set?.view, "markdown");
assert.equal(getNote(a.id)?.view, "markdown");
assert.equal(getNote(b.id)?.view, "text", "other notes keep their own view");
assert.equal(getNote(a.id)?.updated_at, a.updated_at, "changing the view is not an edit");
assert.equal(getNote(a.id)?.body, "note a");
assert.deepEqual(listNotes("tester").map((n) => n.id), before, "changing the view must not reorder");

// A body save keeps the stored view, and a view change never trips the body conflict check.
setView(a.id, "text");
const res = updateNoteBody(a.id, "note a", "note a v2");
assert.ok("ok" in res && res.ok && res.note.view === "text");

assert.ok(isNoteView("text") && isNoteView("markdown"));
for (const bad of ["Markdown", "html", "", null, 1, {}, [], true, undefined])
  assert.equal(isNoteView(bad), false, `rejects ${JSON.stringify(bad)}`);

console.log("note-view.check.ts: all checks passed");
