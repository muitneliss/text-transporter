"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <circle
        cx="8"
        cy="5.4"
        r="3.4"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 8.8 V14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Used bare on the board tiles and with a label in the note's button bar.
 * On a tile it sits on top of the link that covers the card, so the click has
 * to be stopped from opening the note.
 */
export default function PinButton({
  id,
  pinned,
  label = false,
}: {
  id: string;
  pinned: boolean;
  label?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pinned: !pinned }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Could not change the pin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      className={label ? "btn with-icon" : "pin"}
      onClick={toggle}
      disabled={busy}
      aria-pressed={pinned}
      aria-label={pinned ? "Unpin note" : "Pin note to the top"}
      title={pinned ? "Unpin" : "Pin to top"}
    >
      <PinIcon filled={pinned} />
      {label && <span>{pinned ? "Pinned" : "Pin"}</span>}
    </button>
  );
}
