"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="theme-toggle-dock">
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        aria-pressed={isDark}
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      </button>
    </div>
  );
}
