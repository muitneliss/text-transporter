import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
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

// A database from before the view column: opening it adds the column, keeps every
// row byte-for-byte, reads as Text, and a second open changes nothing.
{
  const legacyDir = mkdtempSync(path.join(tmpdir(), "note-view-legacy-"));
  const legacy = new DatabaseSync(path.join(legacyDir, "notes.db"));
  legacy.exec(`
    CREATE TABLE notes (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, body TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'yellow', pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    INSERT INTO notes VALUES ('l1', 'legacy', 'one', 'yellow', 1, 100, 300);
    INSERT INTO notes VALUES ('l2', 'legacy', 'two', 'blue', 0, 200, 200);
  `);
  legacy.close();

  const dump = () => {
    const db = new DatabaseSync(path.join(legacyDir, "notes.db"));
    const rows = db.prepare("SELECT id, owner, body, color, pinned, created_at, updated_at FROM notes ORDER BY id").all();
    const hasView = (db.prepare("PRAGMA table_info(notes)").all() as { name: string }[]).some((c) => c.name === "view");
    const views = hasView ? db.prepare("SELECT view FROM notes ORDER BY id").all().map((r) => r.view) : null;
    db.close();
    return JSON.stringify({ rows, views });
  };
  const open = () =>
    execFileSync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--no-warnings",
        "--input-type=module",
        "-e",
        `const { listNotes } = await import(${JSON.stringify(new URL("../lib/db.ts", import.meta.url).href)}); console.log(JSON.stringify(listNotes("legacy").map((n) => [n.id, n.view, n.pinned])));`,
      ],
      { env: { ...process.env, DATA_DIR: legacyDir }, encoding: "utf8" }
    ).trim();

  const rowsOnly = (d: string) => JSON.stringify(JSON.parse(d).rows);
  const before = dump();
  assert.equal(JSON.parse(before).views, null, "fixture starts without the view column");
  assert.deepEqual(JSON.parse(open()), [["l1", "text", true], ["l2", "text", false]]);
  const afterFirst = dump();
  assert.equal(rowsOnly(afterFirst), rowsOnly(before), "migration must not change any existing column");
  assert.deepEqual(JSON.parse(afterFirst).views, ["text", "text"]);
  open();
  assert.equal(dump(), afterFirst, "a second open is a no-op");
}

console.log("note-view.check.ts: all checks passed");
