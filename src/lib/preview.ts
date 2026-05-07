import { isDark } from "./palette";
import type { AspectRatio, BoardImage, BoardSettings } from "./types";

export type Rect = { x: number; y: number; w: number; h: number };
export type MarqueeRect = Rect;

export function hasImageFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file" && item.type.startsWith("image/"));
}

export function getPreviewWidth(aspectRatio: AspectRatio) {
  const widths: Record<AspectRatio, number> = {
    "16:9": 1040,
    "4:3": 930,
    "1:1": 760,
    "3:4": 650,
    "9:16": 520,
  };
  return widths[aspectRatio];
}

export function getPreviewTitleHeight(size: number, trimmed: boolean) {
  const multiplier = trimmed ? 1.22 : 1.16;
  const maxHeight = trimmed ? 112 : 96;
  return Math.round(Math.min(maxHeight, Math.max(42, size * multiplier)));
}

export function getPreviewTitleXSpace(size: number) {
  return Math.round(Math.min(64, Math.max(28, size * 0.78)));
}

export function getTitleSafeInset(settings: BoardSettings, titleHeight: number) {
  const outer = settings.trimBackground ? 0 : Math.max(18, settings.spacing * 2);
  return Math.max(0, titleHeight + 32 - outer);
}

export function getTitleInnerPad(size: number) {
  return Math.round(Math.min(28, Math.max(16, size * 0.24)));
}

export function getAspectNumber(aspectRatio: AspectRatio) {
  const [width, height] = aspectRatio.split(":").map(Number);
  return width / height;
}

export function getPositionBounds(positions: Rect[]) {
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + position.w));
  const maxY = Math.max(...positions.map((position) => position.y + position.h));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

export function rectsIntersect(a: MarqueeRect, b: MarqueeRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function getCropFrame(image: BoardImage, frameAspect: number) {
  const imageAspect = image.width / image.height;
  if (Math.abs(imageAspect - frameAspect) / frameAspect < 0.01) {
    return { left: 0, top: 0, width: 100, height: 100 };
  }

  if (imageAspect > frameAspect) {
    const width = (frameAspect / imageAspect) * 100;
    return {
      left: (100 - width) * (image.cropX / 100),
      top: 0,
      width,
      height: 100,
    };
  }

  const height = (imageAspect / frameAspect) * 100;
  return {
    left: 0,
    top: (100 - height) * (image.cropY / 100),
    width: 100,
    height,
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getReadableInk(background: string) {
  return isDark(background) ? "#f8f2ea" : "#211b17";
}
