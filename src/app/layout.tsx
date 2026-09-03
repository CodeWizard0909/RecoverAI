import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecoverAI Dashboard",
  description: "Autonomous Revenue Recovery Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="" href="https://fonts.gstatic.com" rel="preconnect" />
        <link href="https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,400..700;1,400..700&family=Hanken+Grotesk:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
