import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";
import "./solar.css";

export const metadata: Metadata = {
  title: "SolarOps AI · Solar EPC Operations",
  description: "Read-only AI assistance for solar customers, projects, tasks, surveys, proposals, and operating knowledge.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
