"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinIcon } from "@/lib/icons";

/**
 * Used bare on the board tiles and inside the note's button bar (icon-only in
 * both places). On a tile it sits on top of the link that covers the card, so
 * the click has to be stopped from opening the note.
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

  const text = pinned ? "Unpin note" : "Pin note to top";

  return (
    <button
      className={label ? "btn icon-only" : "pin"}
      onClick={toggle}
      disabled={busy}
      aria-pressed={pinned}
      aria-label={text}
      data-tip={text}
    >
      <PinIcon className="icon" filled={pinned} />
    </button>
  );
}
