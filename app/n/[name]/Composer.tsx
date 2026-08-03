"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const COLORS = ["yellow", "pink", "blue", "green", "purple"];

export default function Composer({ owner }: { owner: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [color, setColor] = useState("yellow");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner, body, color }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBody("");
      router.refresh();
    } catch {
      alert("Could not save that note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="composer">
      <textarea
        className="field"
        placeholder="Paste or type anything…  (⌘/Ctrl + Enter to stick it)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
        }}
      />
      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className="swatch"
              aria-pressed={color === c}
              aria-label={c}
              style={{ background: `var(--${c})` }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button className="btn primary" onClick={save} disabled={!body.trim() || saving}>
          {saving ? "Sticking…" : "Stick it"}
        </button>
      </div>
    </div>
  );
}
