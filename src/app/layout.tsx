import type { Metadata } from "next";
import { Epilogue, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const epilogue = Epilogue({ subsets: ["latin"], variable: "--font-epilogue" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

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
    <html lang="en" className={`light ${epilogue.variable} ${hanken.variable} ${jetbrains.variable}`}>
      <head>
        {/* We keep Material Symbols as a standard link because next/font/google doesn't fully support icon fonts natively */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
