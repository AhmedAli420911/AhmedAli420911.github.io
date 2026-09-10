import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EverWarm Home Comfort — HVAC Inquiry Capture System",
  description: "Explore fictional website forms, after-hours intake, missed-call recovery, and staff inquiry tracking. Test information only.",
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
