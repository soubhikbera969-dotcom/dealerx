import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";

export type AccentColor = {
  id: string;
  label: string;
  hex: string; // for swatch
  // HSL pieces (no hsl() wrapper) so we can set CSS vars directly
  primary: string;
  primaryForeground: string;
  ring: string;
  accent: string;
};

export const ACCENT_PALETTE: AccentColor[] = [
  { id: "blue",    label: "Ocean Blue",   hex: "#3b82f6", primary: "217 91% 60%", primaryForeground: "0 0% 100%", ring: "217 91% 60%", accent: "263 70% 58%" },
  { id: "violet",  label: "Royal Violet", hex: "#8b5cf6", primary: "262 83% 62%", primaryForeground: "0 0% 100%", ring: "262 83% 62%", accent: "292 84% 61%" },
  { id: "emerald", label: "Emerald",      hex: "#10b981", primary: "160 84% 39%", primaryForeground: "0 0% 100%", ring: "160 84% 39%", accent: "173 80% 40%" },
  { id: "rose",    label: "Rose",         hex: "#f43f5e", primary: "346 84% 58%", primaryForeground: "0 0% 100%", ring: "346 84% 58%", accent: "330 81% 60%" },
  { id: "amber",   label: "Sunset Amber", hex: "#f59e0b", primary: "38 92% 50%",  primaryForeground: "20 14% 10%", ring: "38 92% 50%",  accent: "24 95% 53%" },
  { id: "slate",   label: "Graphite",     hex: "#475569", primary: "215 25% 35%", primaryForeground: "0 0% 100%", ring: "215 25% 35%", accent: "215 19% 50%" },
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  accent: AccentColor;
  setAccentById: (id: string) => void;
  palette: AccentColor[];
}

const DEFAULT_ACCENT = ACCENT_PALETTE[0];

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  accent: DEFAULT_ACCENT,
  setAccentById: () => {},
  palette: ACCENT_PALETTE,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "light";
    }
    return "light";
  });

  const [accent, setAccent] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("accent-color");
      const found = ACCENT_PALETTE.find((a) => a.id === saved);
      if (found) return found;
    }
    return DEFAULT_ACCENT;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", accent.primary);
    root.style.setProperty("--primary-foreground", accent.primaryForeground);
    root.style.setProperty("--ring", accent.ring);
    root.style.setProperty("--accent", accent.accent);
    root.style.setProperty("--sidebar-primary", accent.primary);
    root.style.setProperty("--sidebar-primary-foreground", accent.primaryForeground);
    root.style.setProperty("--sidebar-ring", accent.ring);
    localStorage.setItem("accent-color", accent.id);
  }, [accent]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const setAccentById = (id: string) => {
    const found = ACCENT_PALETTE.find((a) => a.id === id);
    if (found) setAccent(found);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccentById, palette: ACCENT_PALETTE }}>
      {children}
    </ThemeContext.Provider>
  );
}
