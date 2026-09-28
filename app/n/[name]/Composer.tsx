"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Markdown from "@/lib/markdown";

const COLORS = ["yellow", "pink", "blue", "green", "purple"];

export default function Composer({ owner }: { owner: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [color, setColor] = useState("yellow");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  // Matches the server-rendered default (⌘) until mount, then corrects for
  // non-Apple platforms — reading navigator during render would desync from
  // what the server sent and fail hydration.
  const [isMac, setIsMac] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uaData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
    const platform = uaData?.platform ?? navigator.platform ?? "";
    setIsMac(/mac/i.test(platform));
  }, []);

  // Safari and Firefox on macOS don't focus a clicked button, so without this
  // the ⌘/Ctrl+Enter listener on the wrapper below never sees a keydown once
  // Preview is showing — nothing inside it holds focus.
  useEffect(() => {
    if (mode === "preview") previewRef.current?.focus();
  }, [mode]);

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
      setMode("write");
      router.refresh();
    } catch {
      alert("Could not save that note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onKeyDown={(e) => {
        // On the wrapper rather than just the textarea, so ⌘/Ctrl+Enter also
        // saves while Preview is showing (there's no textarea to catch it there).
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
      }}
    >
      <div
        className="composer"
        style={{ background: `color-mix(in srgb, var(--paper-${color}) 55%, var(--surface))` }}
      >
        {mode === "write" ? (
          <textarea
            id="composer-field"
            className="field"
            placeholder="Write a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        ) : (
          <div className="field composer-preview" ref={previewRef} tabIndex={0}>
            {body.trim() ? <Markdown source={body} /> : <p className="muted">Nothing to preview yet.</p>}
          </div>
        )}
      </div>

      <div className="composer-controls">
        <div className="swatches" role="group" aria-label="Note color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch"
              aria-pressed={color === c}
              aria-label={c}
              style={{ background: `var(--paper-${c})` }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="composer-actions">
          <div className="seg" role="group" aria-label="Composer view">
            <button
              id="composer-write-tab"
              type="button"
              className="seg-btn"
              aria-pressed={mode === "write"}
              onClick={() => setMode("write")}
            >
              Write
            </button>
            <button
              type="button"
              className="seg-btn"
              aria-pressed={mode === "preview"}
              onClick={() => setMode("preview")}
            >
              Preview
            </button>
          </div>
          <span className="hint">
            <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>+<kbd>Enter</kbd> to save
          </span>
          <button className="btn primary" onClick={save} disabled={!body.trim() || saving}>
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
    </div>
  );
}
