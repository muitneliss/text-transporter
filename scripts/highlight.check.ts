import assert from "node:assert/strict";
import { highlight } from "../lib/highlight.ts";
import { safeHref } from "../lib/safeHref.ts";

function roundTrips(code: string, lang: string) {
  const tokens = highlight(code, lang);
  const joined = tokens.map((t) => t.text).join("");
  assert.equal(joined, code, `round-trip failed for lang=${lang}: ${JSON.stringify(code)}`);
}

const SAMPLES: Record<string, string> = {
  js: `function add(a, b) {\n  // sum two numbers\n  return a + b;\n}\nconst s = \`hi \${add(1,2)}\`;`,
  jsx: `const el = <div className="a">{value}</div>;`,
  ts: `interface Point { x: number; y: number }\nconst p: Point = { x: 1, y: 2 };\nfoo.bar();`,
  tsx: `const el: JSX.Element = <span id="x">{n}</span>;`,
  py: `def add(a, b):\n    # sum\n    return a + b\nprint(add(1, 2))`,
  json: `{"a": 1, "b": [true, false, null], "c": "str"}`,
  sh: `#!/bin/bash\nfor f in *.txt; do\n  echo "$f"\ndone`,
  bash: `if [ -f "$1" ]; then echo "ok"; fi`,
  shell: `local x=1; echo $x`,
  css: `.a { color: red; background: url(x.png); } /* note */`,
  html: `<div class="a"><!-- c --><span>text</span></div>`,
  xml: `<root attr="1"><child/></root>`,
  sql: `SELECT id, name FROM users WHERE id = 1; -- comment`,
  go: `func main() {\n\t// go\n\tfmt.Println("hi")\n}`,
  rust: `fn main() {\n    // rust\n    println!("hi {}", 1);\n}`,
  yaml: `name: test\nvalue: 1\nflag: true # comment`,
};

for (const [lang, code] of Object.entries(SAMPLES)) {
  roundTrips(code, lang);
}

const ADVERSARIAL: [string, string][] = [
  ["js", ""],
  ["py", "   \n\t  "],
  ["js", `const s = "unterminated`],
  ["js", `/* unterminated comment`],
  ["py", `x = 'unterminated`],
  ["css", `/* unterminated`],
  ["html", `</script>`],
  ["html", `<script>alert(1)</script>`],
  ["unknownlang", `some ${"\u0000"} weird \n text`],
  ["sql", `SELECT 'it''s here' FROM t; /* open`],
];

for (const [lang, code] of ADVERSARIAL) {
  roundTrips(code, lang);
}

const tsTokens = highlight("interface Foo { x: number }", "ts");
assert.ok(
  tsTokens.some((t) => t.cls === "tk-kw" && t.text === "interface"),
  "expected a tk-kw token for TS keyword 'interface'"
);

// Catastrophic-backtracking regression guard: identifier-style rules that end
// in a lookahead (fn calls, css/html/yaml "prop:" rules) used to rescan the
// tail of a long word from every position, and the old \d+\.?\d* number rule
// went quadratic once a long digit run met a non-boundary character. Each
// language must stay linear on both shapes.
const LANGUAGES = ["js", "jsx", "ts", "tsx", "py", "json", "sh", "css", "html", "sql", "go", "rust", "yaml"];
const TIME_LIMIT_MS = 250;

function assertFast(label: string, code: string, lang: string) {
  const t0 = performance.now();
  const tokens = highlight(code, lang);
  const elapsed = performance.now() - t0;
  assert.ok(
    elapsed < TIME_LIMIT_MS,
    `${label} lang=${lang} took ${elapsed.toFixed(1)}ms, expected under ${TIME_LIMIT_MS}ms`
  );
  assert.equal(tokens.map((t) => t.text).join(""), code, `round-trip failed for ${label} lang=${lang}`);
}

const WORD_INPUT = "a".repeat(100_000);
const DIGIT_INPUT = "9".repeat(99_999) + "z"; // 100k chars, still all-but-one digit

for (const lang of LANGUAGES) {
  assertFast("single-word", WORD_INPUT, lang);
  assertFast("single-digit-run", DIGIT_INPUT, lang);
}

const REJECTED_HREFS = [
  "\x01javascript:alert(1)",
  "\x1fdata:text/html,evil",
  " javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  "java\tscript:alert(1)",
  "vbscript:alert(1)",
];
for (const href of REJECTED_HREFS) {
  assert.equal(safeHref(href), null, `expected safeHref to reject ${JSON.stringify(href)}`);
}

const ALLOWED_HREFS = ["https://a.b", "mailto:x@y.z", "/n/foo", "#h"];
for (const href of ALLOWED_HREFS) {
  assert.equal(safeHref(href), href, `expected safeHref to allow ${JSON.stringify(href)}`);
}

console.log(
  `highlight.check: ${Object.keys(SAMPLES).length} language samples + ${ADVERSARIAL.length} adversarial cases + ` +
    `${LANGUAGES.length * 2} perf cases + ${REJECTED_HREFS.length + ALLOWED_HREFS.length} safeHref cases OK`
);
