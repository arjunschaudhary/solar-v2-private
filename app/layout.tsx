import type { Metadata } from "next";
import "./globals.css";
import "./solar.css";

export const metadata: Metadata = {
  title: "Solar EPC · Operations",
  description: "Manage solar enquiries, follow-ups, site visits, and proposals.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
