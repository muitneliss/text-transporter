import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Text Transporter",
  description: "Sticky notes for moving text between machines.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
