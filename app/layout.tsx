import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Kanit, Charmonman, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["400", "700"],
});

const charmonman = Charmonman({
  variable: "--font-charmonman",
  subsets: ["thai", "latin"],
  weight: ["400", "700"],
});

const ibmPlexThai = IBM_Plex_Sans_Thai({
  variable: "--font-ibm-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "PixPresent · FaceFind",
  description: "Find event photos by face — for photographers and their guests.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${kanit.variable} ${charmonman.variable} ${ibmPlexThai.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
