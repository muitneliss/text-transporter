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
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_owner_idx ON notes (owner, updated_at DESC);
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
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export function listNotes(owner: string): Note[] {
  return db()
    .prepare("SELECT * FROM notes WHERE owner = ? ORDER BY updated_at DESC")
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
    created_at: now,
    updated_at: now,
  };
  db().prepare(
    "INSERT INTO notes (id, owner, body, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(note.id, note.owner, note.body, note.color, note.created_at, note.updated_at);
  return note;
}

export function updateNote(id: string, body: string): Note | null {
  db().prepare("UPDATE notes SET body = ?, updated_at = ? WHERE id = ?").run(
    body,
    Date.now(),
    id
  );
  return getNote(id);
}

export function deleteNote(id: string) {
  db().prepare("DELETE FROM notes WHERE id = ?").run(id);
}
