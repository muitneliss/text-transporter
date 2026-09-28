import type { ReactNode } from "react";
import CodeBlock from "./CodeBlock";
import { safeHref } from "./safeHref";

/**
 * A Markdown subset rendered straight to React elements. Notes are pasted by
 * anyone who knows a board name, so nothing here builds an HTML string and
 * nothing reaches dangerouslySetInnerHTML — the only attribute a note controls
 * is a link href, and those are scheme-checked.
 *
 * Blocks: headings, fenced code, blockquotes, ordered/unordered lists, rules,
 * paragraphs. Inline: code, bold, italic, strikethrough, links, bare URLs.
 * A single newline inside a paragraph stays a line break, which is what people
 * expect of a notes app even though CommonMark would fold it into a space.
 */

const INLINE =
  /(`[^`]+`)|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(~~[\s\S]+?~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]*\]\([^\s)]+\))|(https?:\/\/[^\s<>]+)/g;

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;

  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));

    const tok = m[0];
    const k = `${key}i${n++}`;

    if (tok.startsWith("`")) {
      out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    } else if (tok.startsWith("~~")) {
      out.push(<del key={k}>{inline(tok.slice(2, -2), k)}</del>);
    } else if (tok.startsWith("[")) {
      const split = tok.indexOf("](");
      const href = safeHref(tok.slice(split + 2, -1));
      out.push(
        href ? (
          <a key={k} href={href} target="_blank" rel="noreferrer noopener">
            {inline(tok.slice(1, split), k)}
          </a>
        ) : (
          // Unsupported scheme (javascript:, data:, …): show the source text.
          <span key={k}>{tok}</span>
        )
      );
    } else if (tok.startsWith("http")) {
      out.push(
        <a key={k} href={tok} target="_blank" rel="noreferrer noopener">
          {tok}
        </a>
      );
    } else {
      out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    }

    last = at + tok.length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Inline content, with single newlines kept as visible line breaks. */
function withBreaks(text: string, key: string): ReactNode[] {
  return text.split("\n").flatMap((line, i) => {
    const parts = inline(line, `${key}l${i}`);
    return i === 0 ? parts : [<br key={`${key}br${i}`} />, ...parts];
  });
}

const FENCE = /^\s*```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s*>/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;

function startsBlock(line: string) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    RULE.test(line) ||
    QUOTE.test(line) ||
    UL.test(line) ||
    OL.test(line)
  );
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      const lang = (line.match(/^\s*```(\S*)/)?.[1] ?? "").toLowerCase() || "text";
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence, if the note ever bothered to write one
      out.push(<CodeBlock key={key()} code={buf.join("\n")} lang={lang} />);
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      // Shifted down a level: the board name already owns the page's h1.
      const Tag = `h${Math.min(heading[1].length + 1, 6)}` as "h2";
      out.push(<Tag key={key()}>{inline(heading[2], key())}</Tag>);
      i++;
      continue;
    }

    if (RULE.test(line)) {
      out.push(<hr key={key()} />);
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(lines[i++].replace(/^\s*>\s?/, ""));
      }
      out.push(
        <blockquote key={key()}>{withBreaks(buf.join("\n"), key())}</blockquote>
      );
      continue;
    }

    if (UL.test(line) || OL.test(line)) {
      const ordered = !UL.test(line);
      const re = ordered ? OL : UL;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i++].match(re)![1]);
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={key()}>
          {items.map((item, idx) => (
            <li key={idx}>{inline(item, `${idx}`)}</li>
          ))}
        </Tag>
      );
      continue;
    }

    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) {
      buf.push(lines[i++]);
    }
    out.push(<p key={key()}>{withBreaks(buf.join("\n"), key())}</p>);
  }

  return <div className="md">{out}</div>;
}
