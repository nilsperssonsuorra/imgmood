export type LayoutMode = "balanced" | "grid" | "editorial" | "feature" | "cluster" | "custom";
export type AspectRatio = "4:3" | "16:9" | "1:1" | "3:4" | "9:16";
export type ImageSize = "small" | "normal" | "feature";
export type PaletteTileStyle = "bars" | "swatches" | "strip" | "minimal";
export type ExportFormat = "png" | "pdf";
export type ExportQuality = "standard" | "high" | "print";
export type ImageFit = "fit" | "fill";
export type ClusterFlow = "rows" | "columns";
export type ImageOutlineMode = "inner" | "center" | "outer";

export type BoardImage = {
  id: string;
  name: string;
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  size: ImageSize;
  cropX: number;
  cropY: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoardSettings = {
  layout: LayoutMode;
  clusterFlow: ClusterFlow;
  aspectRatio: AspectRatio;
  count: number;
  spacing: number;
  radius: number;
  imageOutline: number;
  imageOutlineMode: ImageOutlineMode;
  imageOutlineColor: string;
  imageFit: ImageFit;
  background: string;
  trimBackground: boolean;
  includePalette: boolean;
  paletteTileStyle: PaletteTileStyle;
  paletteTileIndex: number;
  customLayout: Record<string, Rect>;
  customLayerOrder: string[];
  showPaletteHexLabels: boolean;
  showHeader: boolean;
  header: string;
  headerStyle: "modern" | "serif" | "editorial" | "caption";
  headerAlign: "left" | "center" | "right";
  headerSize: number;
  exportFormat: ExportFormat;
  exportQuality: ExportQuality;
  filename: string;
};
