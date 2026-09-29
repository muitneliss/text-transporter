export const NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple"] as const;

export type NoteColor = (typeof NOTE_COLORS)[number];

export function isNoteColor(v: unknown): v is NoteColor {
  return typeof v === "string" && (NOTE_COLORS as readonly string[]).includes(v);
}
