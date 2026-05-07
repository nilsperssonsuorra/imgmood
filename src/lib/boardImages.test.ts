import { describe, expect, it, vi } from "vitest";
import { cleanCustomLayerOrder, remapCustomLayout, shuffle } from "./boardImages";
import { paletteCustomLayoutKey } from "./layout";
import type { BoardImage } from "./types";

function makeImage(id: string): BoardImage {
  return {
    id,
    name: `${id}.jpg`,
    url: "",
    image: {} as HTMLImageElement,
    width: 800,
    height: 600,
    size: "normal",
    cropX: 50,
    cropY: 50,
  };
}

describe("remapCustomLayout", () => {
  it("preserves custom rects by image id after reorder", () => {
    const one = makeImage("one");
    const two = makeImage("two");
    const three = makeImage("three");
    const previous = [one, two, three];
    const next = [three, one, two];
    const layout = {
      one: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      two: { x: 0.2, y: 0.3, w: 0.4, h: 0.5 },
      three: { x: 0.3, y: 0.4, w: 0.5, h: 0.6 },
    };

    expect(remapCustomLayout(layout, previous, next)).toEqual(layout);
  });

  it("uses legacy index-based rects when image-id rects are missing", () => {
    const one = makeImage("one");
    const two = makeImage("two");
    const previous = [one, two];
    const next = [two, one];
    const layout = {
      "0": { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      "1": { x: 0.5, y: 0.6, w: 0.7, h: 0.8 },
    };

    expect(remapCustomLayout(layout, previous, next)).toEqual({
      two: layout["1"],
      one: layout["0"],
    });
  });

  it("drops stale rects for removed images", () => {
    const one = makeImage("one");
    const two = makeImage("two");
    const removed = makeImage("removed");
    const layout = {
      one: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
      two: { x: 0.2, y: 0.3, w: 0.4, h: 0.5 },
      removed: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 },
    };

    expect(remapCustomLayout(layout, [one, two, removed], [two])).toEqual({
      two: layout.two,
    });
  });

  it("keeps the palette tile rect when present", () => {
    const one = makeImage("one");
    const paletteRect = { x: 0.6, y: 0.1, w: 0.2, h: 0.2 };
    const layout = {
      [paletteCustomLayoutKey]: paletteRect,
      one: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    };

    expect(remapCustomLayout(layout, [one], [one])).toEqual(layout);
  });
});

describe("cleanCustomLayerOrder", () => {
  it("keeps valid image keys, duplicate image keys, and the palette key", () => {
    const images = [makeImage("one"), makeImage("two")];
    const order = ["missing", "one", "two:1", paletteCustomLayoutKey, "gone:0"];

    expect(cleanCustomLayerOrder(order, images)).toEqual(["one", "two:1", paletteCustomLayoutKey]);
  });

  it("handles an omitted order", () => {
    expect(cleanCustomLayerOrder(undefined, [makeImage("one")])).toEqual([]);
  });
});

describe("shuffle", () => {
  it("returns the same items without mutating the source array", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const source = ["a", "b", "c", "d"];

    const next = shuffle(source);

    expect(source).toEqual(["a", "b", "c", "d"]);
    expect([...next].sort()).toEqual(["a", "b", "c", "d"]);
    expect(next).not.toBe(source);
    random.mockRestore();
  });
});
