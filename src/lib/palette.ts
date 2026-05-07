import type { BoardImage } from "./types";

export const defaultPalette = ["#d7d0c4", "#b9aa94", "#8b7f67", "#4d4637", "#1e1b16"];

type Bucket = { r: number; g: number; b: number; count: number };

export function extractPalette(images: BoardImage[]) {
  const buckets = new Map<string, Bucket>();
  images.slice(0, 12).forEach((item) => collectBuckets(item.image, buckets));

  const colors = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .filter((color, index, list) => list.findIndex((item) => colorDistance(item, color) < 70) === index)
    .slice(0, 5)
    .map((color) => rgbToHex(color.r, color.g, color.b));

  return colors.length >= 4 ? colors : defaultPalette;
}

export function isDark(hex: string) {
  const rgb = hex.replace("#", "").match(/.{2}/g)?.map((value) => parseInt(value, 16)) ?? [255, 255, 255];
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return luminance < 0.42;
}

function collectBuckets(image: HTMLImageElement, buckets: Map<string, Bucket>) {
  const canvas = document.createElement("canvas");
  const size = 80;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 180) continue;
    const r = quantize(data[i]);
    const g = quantize(data[i + 1]);
    const b = quantize(data[i + 2]);
    const key = `${r},${g},${b}`;
    const existing = buckets.get(key) ?? { r, g, b, count: 0 };
    existing.count += 1;
    buckets.set(key, existing);
  }
}

function quantize(value: number) {
  return Math.round(value / 28) * 28;
}

function colorDistance(a: Bucket, b: Bucket) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
