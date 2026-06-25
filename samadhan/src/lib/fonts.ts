import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";

// Cohere font roles → documented Google fallbacks (DESIGN.md Known Gaps).
export const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
