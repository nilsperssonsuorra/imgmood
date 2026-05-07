import type { BoardSettings, LayoutMode } from "./types";

export const initialSettings: BoardSettings = {
  layout: "balanced",
  clusterFlow: "rows",
  aspectRatio: "4:3",
  count: 9,
  spacing: 14,
  radius: 12,
  imageOutline: 0,
  imageOutlineMode: "inner",
  imageOutlineColor: "#ffffff",
  imageFit: "fill",
  background: "#ffffff",
  trimBackground: false,
  includePalette: false,
  paletteTileStyle: "bars",
  paletteTileIndex: -1,
  customLayout: {},
  customLayerOrder: [],
  showPaletteHexLabels: false,
  showHeader: false,
  header: "imgmood",
  headerStyle: "modern",
  headerAlign: "left",
  headerSize: 42,
  exportFormat: "png",
  exportQuality: "high",
  filename: "imgmood",
};

export type ThemeMode = "warm" | "dark";

const settingsStorageKey = "imgmood-settings-v1";
const themeStorageKey = "imgmood-theme-v1";
const debugStorageKey = "imgmood-debug-layout-v1";
const legacySettingsStorageKey = "imgboard-settings-v1";
const legacyThemeStorageKey = "imgboard-theme-v1";
const legacyDebugStorageKey = "imgboard-debug-layout-v1";

export function saveSettings(settings: BoardSettings) {
  window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
}

export function saveTheme(theme: ThemeMode) {
  window.localStorage.setItem(themeStorageKey, theme);
}

export function saveDebugLayout(enabled: boolean) {
  window.localStorage.setItem(debugStorageKey, enabled ? "1" : "0");
}

export function loadSavedSettings() {
  try {
    const saved = window.localStorage.getItem(settingsStorageKey) ?? window.localStorage.getItem(legacySettingsStorageKey);
    if (!saved) return initialSettings;
    const parsed = JSON.parse(saved) as Omit<Partial<BoardSettings>, "layout"> & { layout?: string };
    const layout = parsed.layout === "collage" || parsed.layout === "scrapbook" ? "cluster" : parsed.layout;
    return {
      ...initialSettings,
      ...parsed,
      layout: (layout ?? initialSettings.layout) as LayoutMode,
      customLayout: parsed.customLayout ?? {},
      customLayerOrder: parsed.customLayerOrder ?? [],
      imageFit: "fill" as const,
    };
  } catch {
    return initialSettings;
  }
}

export function loadSavedTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(themeStorageKey) ?? window.localStorage.getItem(legacyThemeStorageKey);
    return saved === "dark" ? "dark" : "warm";
  } catch {
    return "warm";
  }
}

export function loadSavedDebugLayout() {
  try {
    return (window.localStorage.getItem(debugStorageKey) ?? window.localStorage.getItem(legacyDebugStorageKey)) === "1";
  } catch {
    return false;
  }
}
