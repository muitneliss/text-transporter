"use client";

import { useMemo, useState } from "react";
import { highlight } from "./highlight";
import { copyText } from "./clipboard";
import { CopyIcon, CheckIcon } from "./icons";

export default function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    copyText(code).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-lang">{lang}</span>
        <button
          type="button"
          className="codeblock-copy tip-below tip-left"
          aria-label={copied ? "Copied" : "Copy code"}
          data-tip={copied ? "Copied" : "Copy code"}
          data-copied={copied ? "true" : "false"}
          onClick={handleCopy}
        >
          {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
      <pre className="codeblock-pre">
        <code className={`language-${lang}`}>
          {tokens.map((t, i) => (t.cls ? <span key={i} className={t.cls}>{t.text}</span> : t.text))}
        </code>
      </pre>
    </div>
  );
}
