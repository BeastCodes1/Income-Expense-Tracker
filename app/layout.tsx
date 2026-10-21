import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/app/theme-provider";
import { ThemeToggle } from "@/app/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Ledger | Income & Expense Tracker",
  description: "A simple personal income and expense tracker.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          {children}
          <ThemeToggle />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
