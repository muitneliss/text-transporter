"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const slug = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug) router.push(`/n/${encodeURIComponent(slug)}`);
  }

  return (
    <main className="home">
      <h1>Text Transporter</h1>
      <p>Type a name. Whatever you stick there follows you to any machine.</p>
      <form onSubmit={go} className="row">
        <input
          className="field"
          autoFocus
          placeholder="your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          Open
        </button>
      </form>
    </main>
  );
}
