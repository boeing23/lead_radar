import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elise Lead Radar",
  description: "Inbound lead enrichment + 'Why Now?' detection for EliseAI SDRs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      {/*
        suppressHydrationWarning on <body>: browser extensions like Grammarly
        inject attributes (data-gr-ext-installed, data-new-gr-c-s-check-loaded)
        onto the body after SSR, which React otherwise flags as a hydration
        mismatch. The attributes are cosmetic and don't affect app state.
      */}
      <body className="font-sans antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
