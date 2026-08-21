import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";

import "./globals.css";

/** docs/08 typography: three Google faces plus the licensed Advercase display cut. */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/*
 * Advercase (Indieground, commercial license held for this project). Self-hosted
 * as woff2. Only the 700 cut is declared: next/font emits a preload link for
 * every src entry it is given, and nothing sets Advercase below 700, so listing
 * the Regular face bought a high-priority preload on every page for a file that
 * never rendered. The woff2 stays in src/fonts/ for a future lighter setting.
 */
const advercase = localFont({
  src: [{ path: "../fonts/AdvercaseFont-Bold.woff2", weight: "700", style: "normal" }],
  variable: "--font-advercase",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AngleBengal",
  description:
    "A mathematics tutor built on mental models: learn the models, practice against them, and find out which one failed when an answer goes wrong.",
  icons: { icon: "/anglebengal-mark.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * The font variables live on <html>, not <body>. Tailwind's @theme emits
     * --font-sans/-serif/-mono/-display onto :root, and a custom property is
     * substituted at the element that declares it: if the next/font variables
     * they reference sit one level down on <body>, all four resolve to invalid
     * at :root and inherit down that way, silently falling back to system fonts.
     */
    <html
      lang="en"
      className={`${archivo.variable} ${sourceSerif.variable} ${plexMono.variable} ${advercase.variable}`}
    >
      <body className="stock-textured antialiased">{children}</body>
    </html>
  );
}
