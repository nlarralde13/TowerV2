import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Tower MVP",
  description: "Playable MVP vertical slice shell for The Tower.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
