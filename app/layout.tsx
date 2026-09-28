import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text Transporter",
  description: "Sticky notes for moving text between machines.",
};

/** Android: without this, the on-screen keyboard overlays the page instead of
 *  shrinking it, so a sticky action bar sized off the viewport sits behind
 *  the keyboard rather than above it. */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
