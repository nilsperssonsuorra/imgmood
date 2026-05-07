import type { Dispatch, SetStateAction } from "react";
import type { BoardSnapshot } from "./useBoardHistory";
import { cleanCustomLayerOrder, remapCustomLayout, shuffle } from "../lib/boardImages";
import { loadImageFiles } from "../lib/imageFiles";
import { defaultPalette, extractPalette } from "../lib/palette";
import { initialSettings } from "../lib/storage";
import type { BoardImage, BoardSettings } from "../lib/types";

type UseBoardImagesArgs = {
  images: BoardImage[];
  palette: string[];
  settings: BoardSettings;
  selectedImageId: string | null;
  selectedImageIds: string[];
  paletteSlotIndex: number;
  commitBoard: (snapshot: BoardSnapshot, nextMessage?: string) => void;
  setImages: Dispatch<SetStateAction<BoardImage[]>>;
  setMessage: Dispatch<SetStateAction<string>>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setSelectedImageIds: Dispatch<SetStateAction<string[]>>;
  setCropModalImageId: Dispatch<SetStateAction<string | null>>;
  clearActiveProject: () => void;
  freezeVisibleCustomLayout: (customLayout: BoardSettings["customLayout"], settingsValue: BoardSettings) => BoardSettings["customLayout"];
};

export function useBoardImages({
  images,
  palette,
  settings,
  selectedImageId,
  selectedImageIds,
  paletteSlotIndex,
  commitBoard,
  setImages,
  setMessage,
  setSelectedImageId,
  setSelectedImageIds,
  setCropModalImageId,
  clearActiveProject,
  freezeVisibleCustomLayout,
}: UseBoardImagesArgs) {
  function selectImages(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    setSelectedImageIds(uniqueIds);
    setSelectedImageId(uniqueIds[uniqueIds.length - 1] ?? null);
  }

  function selectImage(id: string | null) {
    selectImages(id ? [id] : []);
  }

  function toggleImageSelection(id: string) {
    setSelectedImageIds((current) => {
      const next = current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id];
      setSelectedImageId(next[next.length - 1] ?? null);
      return next;
    });
  }

  async function addFiles(fileList: FileList | File[], mode: "append" | "replace" = images.length ? "append" : "replace") {
    if (mode === "append" && images.length >= 20) {
      setMessage("Remove an image before adding more.");
      return;
    }

    const files = Array.from(fileList);
    setMessage("");
    const result = await loadImageFiles(files);
    if (!result.images.length) {
      setMessage(result.message);
      return;
    }

    const nextImages = mode === "append" ? [...images, ...result.images].slice(0, 20) : result.images;
    const changedCount = mode === "append" ? nextImages.length - images.length : nextImages.length;
    const nextMessage = changedCount ? "" : "Board already has 20 images.";
    commitBoard(
      {
        images: nextImages,
        palette: extractPalette(nextImages),
        settings: {
          ...settings,
          count: nextImages.length > 1 ? nextImages.length : 6,
          customLayout: mode === "replace" ? {} : settings.customLayout,
          customLayerOrder: mode === "replace" ? [] : cleanCustomLayerOrder(settings.customLayerOrder, nextImages),
        },
      },
      nextMessage,
    );
    selectImage(selectedImageId && nextImages.some((image) => image.id === selectedImageId) ? selectedImageId : nextImages[0]?.id ?? null);
  }

  function updateImageCrop(id: string, patch: Partial<Pick<BoardImage, "cropX" | "cropY">>, recordHistory = true) {
    const nextImages = images.map((item) => (item.id === id ? { ...item, ...patch } : item));
    if (recordHistory) {
      commitBoard({ images: nextImages, palette, settings });
      return;
    }
    setImages((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function featureImage(index: number) {
    const previous = images;
    const next = [...previous];
    const [item] = next.splice(index, 1);
    if (!item) return;
    const featured: BoardImage = { ...item, size: "feature" };
    const reordered = [featured, ...next];
    const frozenLayout = freezeVisibleCustomLayout(settings.customLayout, settings);
    commitBoard({ images: reordered, palette, settings: { ...settings, customLayout: remapCustomLayout(frozenLayout, previous, reordered), customLayerOrder: cleanCustomLayerOrder(settings.customLayerOrder, reordered) } });
  }

  function removeImage(index: number) {
    const previous = images;
    const next = previous.filter((_, itemIndex) => itemIndex !== index);
    const nextSelectedIds = selectedImageIds.filter((id) => next.some((image) => image.id === id));
    const frozenLayout = freezeVisibleCustomLayout(settings.customLayout, settings);
    commitBoard({
      images: next,
      palette: next.length ? extractPalette(next) : defaultPalette,
      settings: {
        ...settings,
        count: next.length > 1 ? Math.min(settings.count, next.length) : next.length ? 6 : 9,
        customLayout: remapCustomLayout(frozenLayout, previous, next),
        customLayerOrder: cleanCustomLayerOrder(settings.customLayerOrder, next),
      },
    });
    selectImages(nextSelectedIds.length ? nextSelectedIds : next[0]?.id ? [next[0].id] : []);
    setCropModalImageId((cropping) => (cropping && next.some((image) => image.id === cropping) ? cropping : null));
  }

  function clearImages() {
    commitBoard({ images: [], palette: defaultPalette, settings: { ...settings, count: 9, customLayout: {}, customLayerOrder: [] } }, "");
    clearActiveProject();
    selectImage(null);
    setCropModalImageId(null);
  }

  function createNewBoard() {
    commitBoard({ images: [], palette: defaultPalette, settings: { ...initialSettings, customLayout: {}, customLayerOrder: [] } }, "");
    clearActiveProject();
    selectImage(null);
    setCropModalImageId(null);
  }

  function moveImage(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const previous = images;
    const next = [...previous];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const frozenLayout = freezeVisibleCustomLayout(settings.customLayout, settings);
    commitBoard({ images: next, palette, settings: { ...settings, customLayout: remapCustomLayout(frozenLayout, previous, next), customLayerOrder: cleanCustomLayerOrder(settings.customLayerOrder, next) } });
  }

  function getImageIndexForSlot(slotIndex: number) {
    return slotIndex - (paletteSlotIndex >= 0 && slotIndex > paletteSlotIndex ? 1 : 0);
  }

  function moveBoardTile(from: number, to: number) {
    if (from === to) return;
    const fromPalette = from === paletteSlotIndex;
    const toPalette = to === paletteSlotIndex;

    if (fromPalette || toPalette) {
      commitBoard({ images, palette, settings: { ...settings, paletteTileIndex: fromPalette ? to : from } });
      return;
    }

    moveImage(getImageIndexForSlot(from), getImageIndexForSlot(to));
  }

  function regenerate() {
    const next = shuffle(images);
    const frozenLayout = freezeVisibleCustomLayout(settings.customLayout, settings);
    commitBoard({ images: next, palette, settings: { ...settings, customLayout: remapCustomLayout(frozenLayout, images, next), customLayerOrder: cleanCustomLayerOrder(settings.customLayerOrder, next) } });
  }

  return {
    addFiles,
    selectImages,
    selectImage,
    toggleImageSelection,
    updateImageCrop,
    featureImage,
    removeImage,
    clearImages,
    createNewBoard,
    moveImage,
    getImageIndexForSlot,
    moveBoardTile,
    regenerate,
  };
}
