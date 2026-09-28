import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const g = globalThis as unknown as { __db?: DatabaseSync };

function open() {
  const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });

  const db = new DatabaseSync(path.join(dataDir, "notes.db"), { timeout: 5000 });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      owner      TEXT NOT NULL,
      body       TEXT NOT NULL,
      color      TEXT NOT NULL DEFAULT 'yellow',
      pinned     INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Boards that predate pinning already have the table, so CREATE TABLE above is
  // a no-op for them and the column has to be added in place. Existing rows take
  // the default and come out unpinned.
  const columns = db.prepare("PRAGMA table_info(notes)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "pinned")) {
    db.exec("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");
  }

  // Supersedes notes_owner_idx: every board query now orders by pinned first.
  db.exec(`
    DROP INDEX IF EXISTS notes_owner_idx;
    CREATE INDEX IF NOT EXISTS notes_board_idx
      ON notes (owner, pinned DESC, updated_at DESC);
  `);
  return db;
}

/**
 * Opened on first query, never at import time: `next build` imports every route
 * module across parallel workers, and eagerly opening the file made those workers
 * race each other for the same database ("database is locked").
 * Cached on globalThis so dev-mode hot reloads don't pile up open handles.
 */
function db() {
  return (g.__db ??= open());
}

export type Note = {
  id: string;
  owner: string;
  body: string;
  color: string;
  pinned: boolean;
  created_at: number;
  updated_at: number;
};

/** Names are case- and space-insensitive so "Yan Mad" and "yan-mad" hit the same wall. */
export function normalizeOwner(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * node:sqlite hands back null-prototype rows, which React refuses to serialize
 * into a Client Component. Copy each one into a plain object.
 */
function toNote(row: Record<string, unknown>): Note {
  return {
    id: String(row.id),
    owner: String(row.owner),
    body: String(row.body),
    color: String(row.color),
    pinned: Boolean(row.pinned),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export function listNotes(owner: string): Note[] {
  return db()
    .prepare(
      "SELECT * FROM notes WHERE owner = ? ORDER BY pinned DESC, updated_at DESC"
    )
    .all(owner)
    .map(toNote);
}

export function getNote(id: string): Note | null {
  const row = db().prepare("SELECT * FROM notes WHERE id = ?").get(id);
  return row ? toNote(row) : null;
}

export function createNote(owner: string, body: string, color: string): Note {
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(),
    owner,
    body,
    color,
    pinned: false,
    created_at: now,
    updated_at: now,
  };
  db().prepare(
    "INSERT INTO notes (id, owner, body, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(note.id, note.owner, note.body, note.color, note.created_at, note.updated_at);
  return note;
}

export type UpdateBodyResult =
  | { ok: true; note: Note }
  | { conflict: true; current: Note }
  | { notFound: true };

/**
 * Compare-and-swap on the body only: pin/color changes must never trip a
 * conflict, and saving back the same text is harmless, so `updated_at` and
 * every other column are deliberately left out of the comparison.
 * `baseBody` undefined skips the check entirely, for callers that predate it.
 */
export function updateNoteBody(id: string, baseBody: string | undefined, body: string): UpdateBodyResult {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const row = conn.prepare("SELECT * FROM notes WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      conn.exec("ROLLBACK");
      return { notFound: true };
    }
    const current = toNote(row);
    if (baseBody !== undefined && current.body !== baseBody) {
      conn.exec("ROLLBACK");
      return { conflict: true, current };
    }
    conn.prepare("UPDATE notes SET body = ?, updated_at = ? WHERE id = ?").run(
      body,
      Date.now(),
      id
    );
    conn.exec("COMMIT");
    return { ok: true, note: getNote(id)! };
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Pinning is not an edit, so updated_at stays where it is — unpinning a note
 * drops it back to whatever position its last real edit earned.
 */
export function setPinned(id: string, pinned: boolean): Note | null {
  db().prepare("UPDATE notes SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
  return getNote(id);
}

export function deleteNote(id: string) {
  db().prepare("DELETE FROM notes WHERE id = ?").run(id);
}
