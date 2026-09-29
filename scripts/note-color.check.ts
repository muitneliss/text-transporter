import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "note-color-check-"));

const { createNote, getNote, listNotes, setColor, updateNoteBody } = await import("../lib/db.ts");
const { NOTE_COLORS, isNoteColor } = await import("../lib/colors.ts");

assert.deepEqual([...NOTE_COLORS], ["yellow", "pink", "blue", "green", "purple"]);
for (const c of NOTE_COLORS) assert.ok(isNoteColor(c));
for (const bad of ["red", "Yellow", "", null, 1, {}, [], true, undefined, ["yellow"]])
  assert.equal(isNoteColor(bad), false, `rejects ${JSON.stringify(bad)}`);

const a = createNote("tester", "note a", "yellow");
const b = createNote("tester", "note b", "blue");
const c = createNote("tester", "note c", "green");
const order = listNotes("tester").map((n) => n.id);
const bBefore = JSON.stringify(getNote(b.id));
await new Promise((r) => setTimeout(r, 5));

for (const color of NOTE_COLORS) {
  const set = setColor(a.id, color);
  assert.equal(set?.color, color);
  assert.equal(getNote(a.id)?.color, color);
  assert.equal(getNote(a.id)?.updated_at, a.updated_at, "recoloring is not an edit");
  assert.equal(getNote(a.id)?.body, "note a");
  assert.deepEqual(listNotes("tester").map((n) => n.id), order, "recoloring must not reorder");
}
assert.equal(JSON.stringify(getNote(b.id)), bBefore, "other notes are untouched");
assert.equal(getNote(c.id)?.color, "green");
assert.equal(setColor("missing", "pink"), null);

// A recolor never trips the body conflict check, and a body save keeps the color.
setColor(a.id, "pink");
const res = updateNoteBody(a.id, "note a", "note a v2");
assert.ok("ok" in res && res.ok && res.note.color === "pink");
console.log("note-color.check.ts: all checks passed");
