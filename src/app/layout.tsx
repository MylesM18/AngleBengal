import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";

import "./globals.css";

/** docs/08 typography: three faces, all from Google Fonts. */
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
    <html lang="en">
      <body
        className={`${archivo.variable} ${sourceSerif.variable} ${plexMono.variable} stock-textured antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
