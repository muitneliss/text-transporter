import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const g = globalThis as unknown as { __db?: DatabaseSync };

function open() {
  const db = new DatabaseSync(path.join(dataDir, "notes.db"));
  db.exec("PRAGMA journal_mode = WAL");
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

// Cached on globalThis so dev-mode hot reloads don't pile up open handles.
export const db = (g.__db ??= open());

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

export function listNotes(owner: string): Note[] {
  return db
    .prepare("SELECT * FROM notes WHERE owner = ? ORDER BY updated_at DESC")
    .all(owner) as unknown as Note[];
}

export function getNote(id: string): Note | null {
  const row = db.prepare("SELECT * FROM notes WHERE id = ?").get(id);
  return row ? (row as unknown as Note) : null;
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
  db.prepare(
    "INSERT INTO notes (id, owner, body, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(note.id, note.owner, note.body, note.color, note.created_at, note.updated_at);
  return note;
}

export function updateNote(id: string, body: string): Note | null {
  db.prepare("UPDATE notes SET body = ?, updated_at = ? WHERE id = ?").run(
    body,
    Date.now(),
    id
  );
  return getNote(id);
}

export function deleteNote(id: string) {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}
