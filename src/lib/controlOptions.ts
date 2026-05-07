import type { ThemeMode } from "./storage";
import type { AspectRatio, BoardSettings, ClusterFlow, ExportFormat, ExportQuality, ImageOutlineMode, LayoutMode, PaletteTileStyle } from "./types";

export const layouts: Array<{ value: LayoutMode; label: string; hint: string }> = [
  { value: "balanced", label: "Balanced", hint: "Best default" },
  { value: "grid", label: "Grid", hint: "Even tiles" },
  { value: "editorial", label: "Editorial", hint: "Magazine feel" },
  { value: "feature", label: "Feature", hint: "One lead image" },
  { value: "cluster", label: "Cluster", hint: "Centered board" },
  { value: "custom", label: "Custom", hint: "Drag freely" },
];

export const backgrounds = ["#ffffff", "#f6f3ec", "#ebe6dc", "#e7e9ee", "#181818"];
export const aspectOptions: AspectRatio[] = ["16:9", "4:3", "1:1", "3:4", "9:16"];
export const paletteTileStyles: Array<{ value: PaletteTileStyle; label: string }> = [
  { value: "bars", label: "Bars" },
  { value: "swatches", label: "Swatches" },
  { value: "strip", label: "Strip" },
  { value: "minimal", label: "Minimal" },
];

export const exportFormats: Array<{ value: ExportFormat; label: string }> = [
  { value: "png", label: "PNG" },
  { value: "pdf", label: "PDF" },
];

export const exportQualities: Array<{ value: ExportQuality; label: string; hint: string }> = [
  { value: "standard", label: "Standard", hint: "Small file" },
  { value: "high", label: "High", hint: "Best default" },
  { value: "print", label: "Print", hint: "Large export" },
];

export const titleAlignments: Array<{ value: BoardSettings["headerAlign"]; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export const clusterFlowOptions: Array<{ value: ClusterFlow; label: string }> = [
  { value: "rows", label: "Rows" },
  { value: "columns", label: "Columns" },
];

export const outlineModeOptions: Array<{ value: ImageOutlineMode; label: string }> = [
  { value: "inner", label: "Inner" },
  { value: "center", label: "Center" },
  { value: "outer", label: "Outer" },
];

export const outlineColors = ["#ffffff", "#f6f3ec", "#111111", "#d9c5a7", "#2457d6"];

export const themeOptions: Array<{ value: ThemeMode; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "dark", label: "Dark" },
];
