export async function copyText(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.writeText &&
    typeof window !== "undefined" &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy fallback below
    }
  }

  if (typeof document === "undefined") return false;

  // Everything outside an open <dialog> is inert, so a textarea appended to
  // document.body can't be focused or selected there — attach it inside the
  // open dialog instead, or execCommand("copy") silently no-ops. Focus isn't
  // a reliable signal for which dialog is open (Safari doesn't focus clicked
  // buttons, and a click on plain text leaves focus on <body>), so prefer the
  // actual open modal and only fall back to the focused element's dialog.
  const previousFocus = document.activeElement as HTMLElement | null;
  let modal: HTMLElement | null = null;
  try {
    modal = document.querySelector("dialog:modal");
  } catch {
    // :modal not supported in this browser
  }
  const container =
    modal ?? (previousFocus?.closest("dialog") as HTMLElement | null) ?? document.body;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";
  container.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    container.removeChild(textarea);
    previousFocus?.focus();
  }
}
