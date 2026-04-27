import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bags Partner Attribution OS",
  description:
    "Bags-native partner revenue attribution for creators and KOLs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
