import { describe, expect, it } from "vitest";
import {
  computePositions,
  getCustomLayoutKey,
  getExportSize,
  getLayoutArea,
  getPaletteSlotIndex,
  getRenderedImages,
  paletteCustomLayoutKey,
} from "./layout";
import { initialSettings } from "./storage";
import type { BoardImage, BoardSettings, LayoutMode } from "./types";

function makeImage(id: string, width: number, height: number, size: BoardImage["size"] = "normal"): BoardImage {
  return {
    id,
    name: `${id}.jpg`,
    url: "",
    image: {} as HTMLImageElement,
    width,
    height,
    size,
    cropX: 50,
    cropY: 50,
  };
}

function makeSettings(patch: Partial<BoardSettings> = {}): BoardSettings {
  return {
    ...initialSettings,
    count: 6,
    spacing: 12,
    customLayout: {},
    customLayerOrder: [],
    ...patch,
  };
}

describe("getExportSize", () => {
  it("returns expected dimensions for aspect ratios and quality levels", () => {
    expect(getExportSize("4:3", "high")).toEqual({ width: 2048, height: 1536 });
    expect(getExportSize("16:9", "standard")).toEqual({ width: 1474, height: 830 });
    expect(getExportSize("1:1", "print")).toEqual({ width: 2700, height: 2700 });
    expect(getExportSize("9:16")).toEqual({ width: 1152, height: 2048 });
  });
});

describe("getRenderedImages", () => {
  it("repeats a single image to match the requested count", () => {
    const image = makeImage("one", 800, 600);

    const rendered = getRenderedImages([image], makeSettings({ count: 4 }));

    expect(rendered).toHaveLength(4);
    expect(rendered.every((item) => item === image)).toBe(true);
  });

  it("limits multiple images to the requested count", () => {
    const images = [makeImage("one", 800, 600), makeImage("two", 600, 800), makeImage("three", 1200, 900)];

    expect(getRenderedImages(images, makeSettings({ count: 2 })).map((image) => image.id)).toEqual(["one", "two"]);
  });
});

describe("palette slot helpers", () => {
  it("places and clamps the palette tile index", () => {
    expect(getPaletteSlotIndex(3, makeSettings({ includePalette: false }))).toBe(-1);
    expect(getPaletteSlotIndex(3, makeSettings({ includePalette: true, paletteTileIndex: -1 }))).toBe(3);
    expect(getPaletteSlotIndex(3, makeSettings({ includePalette: true, paletteTileIndex: 99 }))).toBe(3);
    expect(getPaletteSlotIndex(3, makeSettings({ includePalette: true, paletteTileIndex: 1.4 }))).toBe(1);
  });

  it("returns stable custom layout keys for palette tiles and duplicate images", () => {
    const image = makeImage("repeat", 800, 600);
    const rendered = getRenderedImages([image], makeSettings({ count: 2, includePalette: true }));
    const paletteIndex = getPaletteSlotIndex(rendered.length, makeSettings({ count: 2, includePalette: true }));

    expect(getCustomLayoutKey(paletteIndex, rendered, paletteIndex)).toBe(paletteCustomLayoutKey);
    expect(getCustomLayoutKey(0, rendered, paletteIndex)).toBe("repeat:0");
    expect(getCustomLayoutKey(1, rendered, paletteIndex)).toBe("repeat:1");
  });
});

describe("computePositions", () => {
  const images = [
    makeImage("landscape", 1600, 900),
    makeImage("portrait", 900, 1400),
    makeImage("square", 1000, 1000),
    makeImage("wide", 1800, 900, "feature"),
    makeImage("small", 700, 900, "small"),
    makeImage("tall", 800, 1400),
  ];

  it.each<LayoutMode>(["balanced", "grid", "editorial", "feature", "cluster", "custom"])(
    "returns valid in-bounds rects for %s layout",
    (layout) => {
      const width = 1000;
      const height = 750;
      const settings = makeSettings({ layout, includePalette: true });
      const positions = computePositions(images, settings, width, height);

      expect(positions).toHaveLength(settings.count + 1);
      positions.forEach((position) => {
        expect(Number.isFinite(position.x)).toBe(true);
        expect(Number.isFinite(position.y)).toBe(true);
        expect(position.w).toBeGreaterThan(0);
        expect(position.h).toBeGreaterThan(0);
        expect(position.x).toBeGreaterThanOrEqual(0);
        expect(position.y).toBeGreaterThanOrEqual(0);
        expect(position.x + position.w).toBeLessThanOrEqual(width + 0.001);
        expect(position.y + position.h).toBeLessThanOrEqual(height + 0.001);
      });
    },
  );

  it("respects saved custom layout rects relative to the layout area", () => {
    const image = makeImage("hero", 1200, 600);
    const settings = makeSettings({
      layout: "custom",
      count: 1,
      spacing: 10,
      customLayout: {
        hero: { x: 0.25, y: 0.2, w: 0.3, h: 0.3 },
      },
    });
    const width = 1000;
    const height = 750;
    const area = getLayoutArea(settings, width, height);

    const [position] = computePositions([image], settings, width, height);

    expect(position.x).toBeCloseTo(area.outer + area.innerWidth * 0.25);
    expect(position.y).toBeCloseTo(area.topOuter + area.innerHeight * 0.2);
    expect(position.w).toBeCloseTo(area.innerWidth * 0.3);
    expect(position.h).toBeCloseTo((area.innerWidth * 0.3) / (image.width / image.height));
  });

  it("clamps saved custom layout rects inside the board", () => {
    const image = makeImage("hero", 1200, 600);
    const settings = makeSettings({
      layout: "custom",
      count: 1,
      customLayout: {
        hero: { x: 2, y: 2, w: 2, h: 2 },
      },
    });
    const width = 1000;
    const height = 750;
    const [position] = computePositions([image], settings, width, height);

    expect(position.x + position.w).toBeLessThanOrEqual(width);
    expect(position.y + position.h).toBeLessThanOrEqual(height);
  });
});
