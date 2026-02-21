import type { Metadata } from "next";
import { VT323, Space_Grotesk } from "next/font/google";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  variable: "--font-pixel",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "700"],
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tarely — Control Plane for Autonomous AI",
  description: "Audit, govern, and operate your AI agents at scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${vt323.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-body)] bg-mac-cream text-mac-black`}>
        {children}
      </body>
    </html>
  );
}
