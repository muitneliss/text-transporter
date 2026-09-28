export type Token = { text: string; cls?: string };

interface Rule {
  re: RegExp; // sticky ('y'), never global
  cls: string;
}

function scan(code: string, rules: Rule[]): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let plainStart = -1;

  const flushPlain = (end: number) => {
    if (plainStart >= 0 && end > plainStart) {
      tokens.push({ text: code.slice(plainStart, end) });
    }
    plainStart = -1;
  };

  while (pos < code.length) {
    let matched = false;
    for (const rule of rules) {
      rule.re.lastIndex = pos;
      const m = rule.re.exec(code);
      if (m && m[0].length > 0) {
        flushPlain(pos);
        tokens.push({ text: m[0], cls: rule.cls });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (plainStart < 0) plainStart = pos;
      pos++;
    }
  }
  flushPlain(code.length);
  return tokens;
}

// Leading boundary before every identifier-style rule that ends in a lookahead:
// without it, a failed match at position N is retried at N+1, N+2, ... and each
// retry re-backtracks over the whole remaining run, going quadratic on a single
// long unbroken word (see NO_IDENT_BEFORE below).
const NO_IDENT_BEFORE = "(?<![A-Za-z0-9_$-])";

const NUM = { re: /\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/y, cls: "tk-num" };
const STR_DQ = { re: /"(?:\\.|[^"\\\n])*"?/y, cls: "tk-str" };
const STR_SQ = { re: /'(?:\\.|[^'\\\n])*'?/y, cls: "tk-str" };
const STR_BT = { re: /`(?:\\.|[^`\\])*`?/y, cls: "tk-str" };
const LINE_COM_SLASH = { re: /\/\/[^\n]*/y, cls: "tk-com" };
const BLOCK_COM_C = { re: /\/\*[\s\S]*?\*\//y, cls: "tk-com" };
const BLOCK_COM_C_UNTERM = { re: /\/\*[\s\S]*/y, cls: "tk-com" };
const FN_CALL = { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z_$][A-Za-z0-9_$]*(?=\\s*\\()`, "y"), cls: "tk-fn" };
const PROP_ACCESS = { re: /(?<=\.)[A-Za-z_$][A-Za-z0-9_$]*/y, cls: "tk-prop" };

function kw(words: string[], flags = "y"): Rule {
  return { re: new RegExp(`\\b(?:${words.join("|")})\\b`, flags), cls: "tk-kw" };
}

function clikeRules(keywords: string[], opts: { tag?: boolean; backtick?: boolean } = {}): Rule[] {
  const rules: Rule[] = [LINE_COM_SLASH, BLOCK_COM_C, BLOCK_COM_C_UNTERM, STR_DQ, STR_SQ];
  if (opts.backtick) rules.push(STR_BT);
  rules.push(NUM, kw(keywords));
  if (opts.tag) rules.push({ re: /<\/?[A-Za-z][A-Za-z0-9.:-]*/y, cls: "tk-tag" });
  rules.push(FN_CALL, PROP_ACCESS);
  return rules;
}

const JS_KW = [
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "default", "break", "continue", "new", "class", "extends", "super",
  "this", "typeof", "instanceof", "in", "of", "try", "catch", "finally", "throw", "yield",
  "async", "await", "import", "export", "from", "as", "delete", "void", "null", "undefined",
  "true", "false", "static", "get", "set",
];
const TS_KW = [
  ...JS_KW, "interface", "type", "enum", "implements", "namespace", "declare", "public",
  "private", "protected", "readonly", "abstract", "is", "keyof", "infer", "satisfies",
];
const GO_KW = [
  "func", "package", "import", "var", "const", "type", "struct", "interface", "map", "chan",
  "go", "defer", "return", "if", "else", "for", "range", "switch", "case", "default", "break",
  "continue", "fallthrough", "goto", "select", "nil", "true", "false", "iota",
];
const RUST_KW = [
  "fn", "let", "mut", "pub", "struct", "enum", "impl", "trait", "use", "mod", "match", "if",
  "else", "for", "while", "loop", "return", "break", "continue", "self", "Self", "super",
  "crate", "as", "where", "async", "await", "move", "ref", "unsafe", "dyn", "static", "const",
  "true", "false", "None", "Some", "Ok", "Err", "in",
];
const PY_KW = [
  "def", "class", "import", "from", "as", "return", "if", "elif", "else", "for", "while",
  "in", "is", "not", "and", "or", "None", "True", "False", "try", "except", "finally", "with",
  "lambda", "pass", "break", "continue", "yield", "raise", "global", "nonlocal", "assert",
  "del", "async", "await",
];
const SH_KW = [
  "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function",
  "return", "in", "until", "select", "time", "exit", "export", "local", "readonly", "declare",
  "source", "alias", "unset", "shift", "trap", "echo", "set",
];
const SQL_KW = [
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "JOIN",
  "LEFT", "RIGHT", "INNER", "OUTER", "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET",
  "AS", "AND", "OR", "NOT", "NULL", "IS", "IN", "LIKE", "BETWEEN", "CREATE", "TABLE", "ALTER",
  "DROP", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT", "UNIQUE", "INDEX", "VIEW",
  "UNION", "ALL", "DISTINCT", "CASE", "WHEN", "THEN", "ELSE", "END", "EXISTS",
];

const RULES: Record<string, Rule[]> = {
  js: clikeRules(JS_KW, { backtick: true }),
  jsx: clikeRules(JS_KW, { backtick: true, tag: true }),
  ts: clikeRules(TS_KW, { backtick: true }),
  tsx: clikeRules(TS_KW, { backtick: true, tag: true }),
  go: clikeRules(GO_KW, { backtick: true }),
  rust: clikeRules(RUST_KW),
  py: [
    { re: /#[^\n]*/y, cls: "tk-com" },
    { re: /"""[\s\S]*?(?:"""|$)/y, cls: "tk-str" },
    { re: /'''[\s\S]*?(?:'''|$)/y, cls: "tk-str" },
    STR_DQ,
    STR_SQ,
    NUM,
    kw(PY_KW),
    { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`, "y"), cls: "tk-fn" },
    { re: /(?<=\.)[A-Za-z_][A-Za-z0-9_]*/y, cls: "tk-prop" },
  ],
  json: [
    STR_DQ,
    { re: /-?\b\d+(?:\.\d*)?(?:[eE][+-]?\d+)?\b/y, cls: "tk-num" },
    { re: /\b(?:true|false|null)\b/y, cls: "tk-kw" },
  ],
  sh: [
    { re: /#[^\n]*/y, cls: "tk-com" },
    STR_DQ,
    { re: /'[^'\n]*'?/y, cls: "tk-str" },
    { re: /\b\d+(?:\.\d*)?\b/y, cls: "tk-num" },
    kw(SH_KW),
    { re: /\$\{[^}\n]*\}?|\$[A-Za-z_][A-Za-z0-9_]*|\$[0-9@#*?$!-]/y, cls: "tk-prop" },
    { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`, "y"), cls: "tk-fn" },
  ],
  css: [
    BLOCK_COM_C,
    BLOCK_COM_C_UNTERM,
    STR_DQ,
    STR_SQ,
    { re: /@[A-Za-z-]+/y, cls: "tk-kw" },
    { re: /-?\d+(?:\.\d*)?(?:[a-zA-Z%]+)?/y, cls: "tk-num" },
    { re: new RegExp(`${NO_IDENT_BEFORE}[a-zA-Z-]+(?=\\s*\\()`, "y"), cls: "tk-fn" },
    { re: new RegExp(`${NO_IDENT_BEFORE}[a-zA-Z-]+(?=\\s*:)`, "y"), cls: "tk-prop" },
  ],
  html: [
    { re: /<!--[\s\S]*?-->/y, cls: "tk-com" },
    { re: /<!--[\s\S]*/y, cls: "tk-com" },
    { re: /"[^"\n]*"?/y, cls: "tk-str" },
    { re: /'[^'\n]*'?/y, cls: "tk-str" },
    { re: /<\/?[A-Za-z][A-Za-z0-9:-]*/y, cls: "tk-tag" },
    { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z-]+(?=\\s*=\\s*["'])`, "y"), cls: "tk-prop" },
  ],
  sql: [
    { re: /--[^\n]*/y, cls: "tk-com" },
    BLOCK_COM_C,
    BLOCK_COM_C_UNTERM,
    { re: /'(?:''|[^'\n])*'?/y, cls: "tk-str" },
    { re: /\b\d+(?:\.\d*)?\b/y, cls: "tk-num" },
    kw(SQL_KW, "iy"),
    { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`, "y"), cls: "tk-fn" },
  ],
  yaml: [
    { re: /#[^\n]*/y, cls: "tk-com" },
    STR_DQ,
    { re: /'[^'\n]*'?/y, cls: "tk-str" },
    { re: /\b\d+(?:\.\d*)?\b/y, cls: "tk-num" },
    { re: /\b(?:true|false|null|yes|no)\b/iy, cls: "tk-kw" },
    { re: new RegExp(`${NO_IDENT_BEFORE}[A-Za-z0-9_-]+(?=\\s*:(?:\\s|$))`, "y"), cls: "tk-prop" },
  ],
};

const ALIASES: Record<string, string> = {
  js: "js", javascript: "js", mjs: "js", cjs: "js",
  jsx: "jsx",
  ts: "ts", typescript: "ts",
  tsx: "tsx",
  py: "py", python: "py",
  json: "json",
  sh: "sh", bash: "sh", shell: "sh", zsh: "sh",
  css: "css",
  html: "html", xml: "html", svg: "html",
  sql: "sql",
  go: "go", golang: "go",
  rust: "rust", rs: "rust",
  yaml: "yaml", yml: "yaml",
};

export function highlight(code: string, lang: string): Token[] {
  const rules = RULES[ALIASES[lang.toLowerCase()] ?? ""];
  if (!rules) return code ? [{ text: code }] : [];
  return scan(code, rules);
}
