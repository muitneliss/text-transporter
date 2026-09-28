const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const CONTROL_OR_SPACE = /[\x00-\x20\x7f]/;

/**
 * Parses like a browser (via URL, resolved against a fixed base) rather than
 * sniffing the raw string, so a scheme hidden behind stripped control chars
 * (e.g. "\x01javascript:...") is still caught: it decides on the parsed
 * protocol, not on whether our own regex happened to spot a ":" up front.
 */
export function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href || CONTROL_OR_SPACE.test(href)) return null;

  let url: URL;
  try {
    url = new URL(href, "https://x.invalid");
  } catch {
    return null;
  }

  if (SAFE_PROTOCOLS.has(url.protocol)) return href;
  // Genuinely relative (no scheme of its own): resolves onto our fixed base.
  return url.origin === "https://x.invalid" ? href : null;
}
