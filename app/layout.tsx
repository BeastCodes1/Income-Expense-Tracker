import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/app/theme-provider";
import { ThemeToggle } from "@/app/theme-toggle";
import { PwaRegister } from "@/app/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Ledger | Income & Expense Tracker",
  description: "A simple personal income and expense tracker.",
  applicationName: "Pocket Ledger",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
          <ThemeToggle />
          <PwaRegister />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
