import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "schema-ts-playground-theme";

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    // ?theme=dark|light|system overrides the stored preference (shareable links).
    const fromUrl = new URLSearchParams(window.location.search).get("theme");
    if (fromUrl === "light" || fromUrl === "dark" || fromUrl === "system") {
      return fromUrl;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "light";
  });
  const [systemDark, setSystemDark] = useState(getSystemDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) =>
      setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolved: "light" | "dark" =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode, resolved]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={`Theme: ${mode}`}
      aria-label="Toggle theme"
      onClick={() => setMode(NEXT_MODE[mode])}
    >
      <Icon />
    </Button>
  );
}
