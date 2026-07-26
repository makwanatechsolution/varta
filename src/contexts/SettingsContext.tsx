import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark" | "amoled" | "midnight";
export type ChatWallpaper = "varta_dark" | "whatsapp_dark" | "telegram_night" | "amoled_pattern" | "light_paper" | "emerald_soft";
export type FontSizeScale = "small" | "medium" | "large";
export type TimeFormatMode = "12" | "24";

interface SettingsState {
  theme: ThemeMode;
  accentColor: string;
  chatWallpaper: ChatWallpaper;
  fontSize: FontSizeScale;
  enterToSend: boolean;
  soundAlerts: boolean;
  timeFormat: TimeFormatMode;
  appLanguage: string;
  autoStart: boolean;
  autoUpdate: boolean;
  defaultTab: string;
  appPin: string;
}

interface SettingsContextValue extends SettingsState {
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (color: string) => void;
  setChatWallpaper: (wallpaper: ChatWallpaper) => void;
  setFontSize: (size: FontSizeScale) => void;
  setEnterToSend: (enabled: boolean) => void;
  setSoundAlerts: (enabled: boolean) => void;
  setTimeFormat: (mode: TimeFormatMode) => void;
  setAppLanguage: (lang: string) => void;
  setAutoStart: (enabled: boolean) => void;
  setAutoUpdate: (enabled: boolean) => void;
  setDefaultTab: (tab: string) => void;
  setAppPin: (pin: string) => void;
  resolvedTheme: "light" | "dark" | "amoled" | "midnight";
}

const DEFAULT_ACCENT = "#1E88C7";

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const PRESET_ACCENTS = [
  { name: "Varta Blue", hex: "#1E88C7" },
  { name: "WhatsApp Green", hex: "#25D366" },
  { name: "Telegram Cyan", hex: "#0088CC" },
  { name: "Royal Indigo", hex: "#6366F1" },
  { name: "Sunset Amber", hex: "#F59E0B" },
  { name: "Rose Pink", hex: "#EC4899" },
  { name: "Emerald Mint", hex: "#10B981" }
];

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(
    () => (localStorage.getItem("varta_theme_mode") as ThemeMode) || "system"
  );
  const [accentColor, setAccentColorState] = useState<string>(
    () => localStorage.getItem("varta_accent_color") || DEFAULT_ACCENT
  );
  const [chatWallpaper, setChatWallpaperState] = useState<ChatWallpaper>(
    () => (localStorage.getItem("varta_chat_wallpaper") as ChatWallpaper) || "varta_dark"
  );
  const [fontSize, setFontSizeState] = useState<FontSizeScale>(
    () => (localStorage.getItem("varta_font_size") as FontSizeScale) || "medium"
  );
  const [enterToSend, setEnterToSendState] = useState<boolean>(
    () => localStorage.getItem("varta_enter_to_send") !== "false"
  );
  const [soundAlerts, setSoundAlertsState] = useState<boolean>(
    () => localStorage.getItem("varta_sound_alerts") !== "false"
  );
  const [timeFormat, setTimeFormatState] = useState<TimeFormatMode>(
    () => (localStorage.getItem("varta_time_format") as TimeFormatMode) || "24"
  );
  const [appLanguage, setAppLanguageState] = useState<string>(
    () => localStorage.getItem("varta_lang") || "English (US)"
  );
  const [autoStart, setAutoStartState] = useState<boolean>(
    () => localStorage.getItem("varta_autostart") !== "false"
  );
  const [autoUpdate, setAutoUpdateState] = useState<boolean>(
    () => localStorage.getItem("varta_autoupdate") !== "false"
  );
  const [defaultTab, setDefaultTabState] = useState<string>(
    () => localStorage.getItem("varta_launchtab") || "All Chats"
  );
  const [appPin, setAppPinState] = useState<string>(
    () => localStorage.getItem("varta_app_pin") || ""
  );

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "amoled" | "midnight">("dark");

  // Apply Theme & Accent Color Live to DOM
  const applyThemeToDOM = useCallback((currentTheme: ThemeMode, currentAccent: string) => {
    let effective: "light" | "dark" | "amoled" | "midnight" = "dark";

    if (currentTheme === "system") {
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      effective = isSystemDark ? "dark" : "light";
    } else {
      effective = currentTheme;
    }

    setResolvedTheme(effective);

    const root = document.documentElement;
    root.classList.remove("light", "dark", "amoled", "midnight");
    root.classList.add(effective);

    // Apply custom accent color CSS properties
    root.style.setProperty("--color-primary", currentAccent);
    root.style.setProperty("--color-accent", currentAccent);
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme, accentColor);

    // Listen to System OS Theme changes if in System (Auto) mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyThemeToDOM("system", accentColor);
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme, accentColor, applyThemeToDOM]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem("varta_theme_mode", newTheme);
  };

  const setAccentColor = (color: string) => {
    const validHex = /^#([0-9A-F]{3}){1,2}$/i.test(color) ? color : DEFAULT_ACCENT;
    setAccentColorState(validHex);
    localStorage.setItem("varta_accent_color", validHex);
  };

  const setChatWallpaper = (wallpaper: ChatWallpaper) => {
    setChatWallpaperState(wallpaper);
    localStorage.setItem("varta_chat_wallpaper", wallpaper);
  };

  const setFontSize = (size: FontSizeScale) => {
    setFontSizeState(size);
    localStorage.setItem("varta_font_size", size);
  };

  const setEnterToSend = (enabled: boolean) => {
    setEnterToSendState(enabled);
    localStorage.setItem("varta_enter_to_send", String(enabled));
  };

  const setSoundAlerts = (enabled: boolean) => {
    setSoundAlertsState(enabled);
    localStorage.setItem("varta_sound_alerts", String(enabled));
  };

  const setTimeFormat = (mode: TimeFormatMode) => {
    setTimeFormatState(mode);
    localStorage.setItem("varta_time_format", mode);
  };

  const setAppLanguage = (lang: string) => {
    setAppLanguageState(lang);
    localStorage.setItem("varta_lang", lang);
  };

  const setAutoStart = (enabled: boolean) => {
    setAutoStartState(enabled);
    localStorage.setItem("varta_autostart", String(enabled));
  };

  const setAutoUpdate = (enabled: boolean) => {
    setAutoUpdateState(enabled);
    localStorage.setItem("varta_autoupdate", String(enabled));
  };

  const setDefaultTab = (tab: string) => {
    setDefaultTabState(tab);
    localStorage.setItem("varta_launchtab", tab);
  };

  const setAppPin = (pin: string) => {
    setAppPinState(pin);
    localStorage.setItem("varta_app_pin", pin);
  };

  return (
    <SettingsContext.Provider
      value={{
        theme,
        accentColor,
        chatWallpaper,
        fontSize,
        enterToSend,
        soundAlerts,
        timeFormat,
        appLanguage,
        autoStart,
        autoUpdate,
        defaultTab,
        appPin,
        resolvedTheme,
        setTheme,
        setAccentColor,
        setChatWallpaper,
        setFontSize,
        setEnterToSend,
        setSoundAlerts,
        setTimeFormat,
        setAppLanguage,
        setAutoStart,
        setAutoUpdate,
        setDefaultTab,
        setAppPin,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
