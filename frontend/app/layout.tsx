import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { PWARegistrar } from "@/components/PWARegistrar";

const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "600", "700"] });

export const metadata: Metadata = {
  title: "ClinIQ",
  description: "AI-powered clinical decision support for frontline health workers",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={sourceSans.className} suppressHydrationWarning>
        <PWARegistrar />
        {children}
      </body>
    </html>
  );
}
