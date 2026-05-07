import { paletteCustomLayoutKey } from "./layout";
import type { BoardImage, BoardSettings } from "./types";

export function remapCustomLayout(customLayout: BoardSettings["customLayout"], previous: BoardImage[], next: BoardImage[]) {
  const byImageId = new Map<string, BoardSettings["customLayout"][string]>();
  previous.forEach((image, index) => {
    const rect = customLayout[image.id] ?? customLayout[String(index)];
    if (rect) byImageId.set(image.id, rect);
  });

  return next.reduce<BoardSettings["customLayout"]>((layout, image, index) => {
    if (index === 0 && customLayout[paletteCustomLayoutKey]) layout[paletteCustomLayoutKey] = customLayout[paletteCustomLayoutKey];
    const rect = byImageId.get(image.id);
    if (rect) layout[image.id] = rect;
    return layout;
  }, {});
}

export function cleanCustomLayerOrder(order: string[] = [], images: BoardImage[]) {
  const validIds = new Set(images.map((image) => image.id));
  return order.filter((key) => key === paletteCustomLayoutKey || validIds.has(key) || validIds.has(key.split(":")[0]));
}

export function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
