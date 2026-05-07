import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { CropModal } from "./components/CropModal";
import { ImageRail } from "./components/ImageRail";
import { PaletteTile } from "./components/PaletteTile";
import { SettingsInspector } from "./components/SettingsInspector";
import { Topbar } from "./components/Topbar";
import { CloseIcon, ResizeIcon, UploadIcon } from "./components/icons";
import { useBoardImages } from "./hooks/useBoardImages";
import { useBoardHistory } from "./hooks/useBoardHistory";
import { useSavedProjects } from "./hooks/useSavedProjects";
import { exportBoard } from "./lib/exportBoard";
import { cleanCustomLayerOrder } from "./lib/boardImages";
import {
  computePositions,
  getAspectRatioCss,
  getCustomLayoutKey,
  getExportSize,
  getLayoutArea,
  getPaletteSlotIndex,
  getRatioBox,
  getRenderedImages,
  getTileVisual,
} from "./lib/layout";
import { defaultPalette } from "./lib/palette";
import {
  clamp,
  getAspectNumber,
  getCropFrame,
  getPositionBounds,
  getPreviewTitleHeight,
  getPreviewTitleXSpace,
  getPreviewWidth,
  getReadableInk,
  getTitleInnerPad,
  getTitleSafeInset,
  hasImageFiles,
  rectsIntersect,
} from "./lib/preview";
import type { MarqueeRect } from "./lib/preview";
import {
  loadSavedDebugLayout,
  loadSavedSettings,
  loadSavedTheme,
  saveDebugLayout,
  saveSettings,
  saveTheme,
} from "./lib/storage";
import type { ThemeMode } from "./lib/storage";
import type { BoardImage, BoardSettings } from "./lib/types";

type ExportStatus = "idle" | "exporting" | "done";

export default function App() {
  const [images, setImages] = useState<BoardImage[]>([]);
  const [palette, setPalette] = useState(defaultPalette);
  const [settings, setSettings] = useState(loadSavedSettings);
  const [theme, setTheme] = useState<ThemeMode>(loadSavedTheme);
  const [debugLayout, setDebugLayout] = useState(loadSavedDebugLayout);
  const [message, setMessage] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isDraggingBoardFiles, setIsDraggingBoardFiles] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [customDraggingIndex, setCustomDraggingIndex] = useState<number | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [customSelectionRect, setCustomSelectionRect] = useState<MarqueeRect | null>(null);
  const [cropModalImageId, setCropModalImageId] = useState<string | null>(null);
  const [cropModalAspect, setCropModalAspect] = useState(1);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [boardNameDraft, setBoardNameDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const railDragDepthRef = useRef(0);
  const cancelBoardNameEditRef = useRef(false);
  const cropDragRef = useRef<{ id: string; startX: number; startY: number; cropX: number; cropY: number; moveX: number; moveY: number; historyCaptured: boolean } | null>(null);
  const customDragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    items: Array<{ index: number; rect: { x: number; y: number; w: number; h: number } }>;
    moved: boolean;
    historyCaptured: boolean;
  } | null>(null);
  const customResizeRef = useRef<{ index: number; startX: number; startY: number; startRect: { x: number; y: number; w: number; h: number }; aspect: number; moved: boolean; historyCaptured: boolean } | null>(null);
  const customSelectionRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  const customLiveRectsRef = useRef<Record<number, { x: number; y: number; w: number; h: number }>>({});
  const suppressTileClickRef = useRef(false);
  const wheelHistoryTimeoutRef = useRef<number | null>(null);
  const wheelResizeRef = useRef<{
    index: number;
    rect: { x: number; y: number; w: number; h: number };
    aspect: number;
    anchor: { x: number; y: number };
    direction: number;
    lastWheelAt: number;
  } | null>(null);

  const { undoStack, redoStack, pushUndo, commitBoard, undoBoard, redoBoard } = useBoardHistory({
    images,
    palette,
    settings,
    selectedImageIds,
    setImages,
    setPalette,
    setSettings,
    setSelectedImageId,
    setSelectedImageIds,
    setCropModalImageId,
    setMessage,
  });

  const {
    savedProjects,
    selectedProjectId,
    activeProjectId,
    activeProjectName,
    saveProject,
    loadProjectById,
    deleteSelectedProject,
    saveActiveProjectSettings,
    clearActiveProject,
  } = useSavedProjects({
    images,
    palette,
    settings,
    commitBoard,
    setMessage,
  });

  const renderedImages = useMemo(() => getRenderedImages(images, settings), [images, settings]);
  const hasBoardTitle = settings.showHeader && Boolean(settings.header.trim());
  const titleXSpace = settings.trimBackground && hasBoardTitle ? getPreviewTitleXSpace(settings.headerSize) : 0;
  const titleTextHeight = getPreviewTitleHeight(settings.headerSize, settings.trimBackground);
  const titleHeight = hasBoardTitle ? titleTextHeight : 0;
  const previewSurfaceBox = useMemo(() => getRatioBox(1000, settings.aspectRatio), [settings.aspectRatio]);
  const previewBox = useMemo(
    () => ({
      width: previewSurfaceBox.width,
      height: Math.max(240, previewSurfaceBox.height),
    }),
    [previewSurfaceBox.height, previewSurfaceBox.width],
  );
  const titleSafeInset = hasBoardTitle ? getTitleSafeInset(settings, titleHeight) : 0;
  const positions = useMemo(() => computePositions(images, settings, previewBox.width, previewBox.height, titleSafeInset), [images, previewBox.height, previewBox.width, settings, titleSafeInset]);
  const canvasBounds = useMemo(() => {
    if (!settings.trimBackground || !positions.length) return { x: 0, y: 0, w: previewBox.width, h: previewBox.height };
    const bounds = getPositionBounds(positions);
    if (!hasBoardTitle) return bounds;
    return { x: bounds.x, y: 0, w: bounds.w, h: bounds.y + bounds.h };
  }, [hasBoardTitle, positions, previewBox.height, previewBox.width, settings.trimBackground]);
  const displayBox = { width: canvasBounds.w, height: canvasBounds.h };
  const frameAspect = displayBox.width / Math.max(1, displayBox.height);
  const contentBounds = useMemo(() => (positions.length ? getPositionBounds(positions) : canvasBounds), [canvasBounds, positions]);
  const contentLeftRatio = displayBox.width > 0 ? clamp((contentBounds.x - canvasBounds.x) / displayBox.width, 0, 1) : 0;
  const contentRightRatio = displayBox.width > 0 ? clamp((displayBox.width - (contentBounds.x - canvasBounds.x + contentBounds.w)) / displayBox.width, 0, 1) : 0;
  const contentTopRatio = displayBox.height > 0 ? clamp((contentBounds.y - canvasBounds.y) / displayBox.height, 0, 1) : 0;
  const firstImageTop = Math.max(0, contentBounds.y - canvasBounds.y);
  const titleCenterY = hasBoardTitle ? firstImageTop / 2 : 0;
  const titleSlotTopGap = hasBoardTitle ? titleCenterY - titleHeight / 2 : 0;
  const titleSlotBottomGap = hasBoardTitle ? firstImageTop - (titleCenterY + titleHeight / 2) : 0;
  const titleCenterPercent = hasBoardTitle ? (contentTopRatio * 100) / 2 : 0;
  const titleSlotTopPercent = displayBox.height > 0 ? (titleSlotTopGap / displayBox.height) * 100 : 0;
  const titleSlotBottomPercent = displayBox.height > 0 ? ((titleCenterY + titleHeight / 2) / displayBox.height) * 100 : 0;
  const firstImageTopPercent = displayBox.height > 0 ? (firstImageTop / displayBox.height) * 100 : 0;
  const titleLeftInsetPercent = hasBoardTitle ? contentLeftRatio * 100 : 0;
  const titleRightInsetPercent = hasBoardTitle ? contentRightRatio * 100 : 0;
  const titleInnerPad = hasBoardTitle ? getTitleInnerPad(settings.headerSize) : 0;
  const layoutArea = useMemo(() => getLayoutArea(settings, previewBox.width, previewBox.height, titleSafeInset), [previewBox.height, previewBox.width, settings, titleSafeInset]);
  const exportSize = getExportSize(settings.aspectRatio, settings.exportQuality);
  const countMax = images.length > 1 ? images.length : 12;
  const canExport = images.length > 0;
  const isSeamless = settings.spacing === 0;
  const paletteSlotIndex = getPaletteSlotIndex(renderedImages.length, settings);
  const {
    addFiles,
    selectImages,
    selectImage,
    toggleImageSelection,
    updateImageCrop,
    removeImage,
    clearImages,
    createNewBoard,
    getImageIndexForSlot,
    moveBoardTile,
    regenerate,
  } = useBoardImages({
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
  });
  const selectedImageIdSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const cropModalImage = cropModalImageId ? images.find((image) => image.id === cropModalImageId) : null;
  const cropFrame = cropModalImage ? getCropFrame(cropModalImage, cropModalAspect) : null;
  const boardName = settings.filename.trim() || activeProjectName || "Untitled board";
  const railMessage = images.length ? "" : message;

  useEffect(() => {
    customLiveRectsRef.current = positions.reduce<Record<number, { x: number; y: number; w: number; h: number }>>((rects, position, index) => {
      rects[index] = position;
      return rects;
    }, {});
  }, [positions]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveDebugLayout(debugLayout);
  }, [debugLayout]);

  useEffect(() => {
    setBoardNameDraft(settings.filename);
  }, [settings.filename]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoBoard();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoBoard();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redoBoard, undoBoard]);

  function updateSettings(patch: Partial<BoardSettings>) {
    commitBoard({ images, palette, settings: { ...settings, ...patch, customLayout: patch.customLayout ?? settings.customLayout, customLayerOrder: patch.customLayerOrder ?? settings.customLayerOrder } });
  }

  async function commitBoardName() {
    if (cancelBoardNameEditRef.current) {
      cancelBoardNameEditRef.current = false;
      setBoardNameDraft(settings.filename);
      return;
    }
    const nextName = boardNameDraft.trim();
    if (nextName === settings.filename) return;
    const nextSettings = { ...settings, filename: nextName };
    commitBoard({ images, palette, settings: nextSettings });

    await saveActiveProjectSettings(nextSettings);
  }

  function updatePalette(nextPalette: string[]) {
    commitBoard({ images, palette: nextPalette, settings });
  }

  function getCurrentCustomLayerKeys() {
    return positions.map((_, index) => getCustomLayoutKey(index, renderedImages, paletteSlotIndex));
  }

  function bringCustomKeysToFront(keys: string[]) {
    if (settings.layout !== "custom" || !keys.length) return;
    const validKeys = new Set(getCurrentCustomLayerKeys());
    const frontKeys = Array.from(new Set(keys.filter((key) => validKeys.has(key))));
    if (!frontKeys.length) return;
    setSettings((current) => {
      const retained = current.customLayerOrder.filter((key) => validKeys.has(key) && !frontKeys.includes(key));
      return { ...current, customLayerOrder: [...retained, ...frontKeys] };
    });
  }

  function bringCustomTileToFront(index: number) {
    bringCustomKeysToFront([getCustomLayoutKey(index, renderedImages, paletteSlotIndex)]);
  }

  function normalizeCustomRect(settingsValue: BoardSettings, rect: { x: number; y: number; w: number; h: number }) {
    const area = getLayoutArea(settingsValue, previewBox.width, previewBox.height, titleSafeInset);
    const widthRatio = clamp(rect.w / area.innerWidth, 0.08, 1);
    const heightRatio = clamp(rect.h / area.innerHeight, 0.08, 1);
    return {
      x: clamp((rect.x - area.outer) / area.innerWidth, 0, Math.max(0, 1 - widthRatio)),
      y: clamp((rect.y - area.topOuter) / area.innerHeight, 0, Math.max(0, 1 - heightRatio)),
      w: widthRatio,
      h: heightRatio,
    };
  }

  function freezeVisibleCustomLayout(customLayout: BoardSettings["customLayout"], settingsValue: BoardSettings) {
    if (settingsValue.layout !== "custom") return customLayout;
    return positions.reduce<BoardSettings["customLayout"]>((layout, position, index) => {
      const layoutKey = getCustomLayoutKey(index, renderedImages, paletteSlotIndex);
      layout[layoutKey] = normalizeCustomRect(settingsValue, position);
      return layout;
    }, { ...customLayout });
  }

  function updateCustomTilePosition(index: number, rect: { x: number; y: number; w: number; h: number }) {
    customLiveRectsRef.current[index] = rect;
    setSettings((current) => {
      const nextRect = normalizeCustomRect(current, rect);
      const layoutKey = getCustomLayoutKey(index, renderedImages, paletteSlotIndex);
      const { [String(index)]: _oldIndexRect, ...customLayout } = current.customLayout;
      void _oldIndexRect;
      return { ...current, customLayout: { ...customLayout, [layoutKey]: nextRect }, customLayerOrder: cleanCustomLayerOrder(current.customLayerOrder, renderedImages) };
    });
  }

  function updateCustomTilePositions(updates: Array<{ index: number; rect: { x: number; y: number; w: number; h: number } }>) {
    if (!updates.length) return;
    updates.forEach(({ index, rect }) => {
      customLiveRectsRef.current[index] = rect;
    });
    setSettings((current) => {
      const customLayout = { ...current.customLayout };
      updates.forEach(({ index, rect }) => {
        delete customLayout[String(index)];
        customLayout[getCustomLayoutKey(index, renderedImages, paletteSlotIndex)] = normalizeCustomRect(current, rect);
      });
      return { ...current, customLayout, customLayerOrder: cleanCustomLayerOrder(current.customLayerOrder, renderedImages) };
    });
  }

  function getResizedCustomTileRect(settingsValue: BoardSettings, rect: { x: number; y: number; w: number; h: number }, aspect: number, scale: number, anchor?: { x: number; y: number }) {
    const area = getLayoutArea(settingsValue, previewBox.width, previewBox.height, titleSafeInset);
    const safeAspect = clamp(aspect || 1, 0.2, 5);
    const minShortSide = Math.max(48, Math.min(area.innerWidth, area.innerHeight) * 0.08);
    const minWidth = safeAspect >= 1 ? minShortSide * safeAspect : minShortSide;
    const maxWidth = Math.min(area.innerWidth, area.innerHeight * safeAspect);
    const currentWidth = rect.w > 0 ? rect.w : minWidth;
    const nextWidth = clamp(currentWidth * scale, minWidth, maxWidth);
    const nextHeight = nextWidth / safeAspect;
    const anchorX = anchor?.x ?? rect.x + rect.w / 2;
    const anchorY = anchor?.y ?? rect.y + rect.h / 2;
    const ratioX = rect.w > 0 ? clamp((anchorX - rect.x) / rect.w, 0, 1) : 0.5;
    const ratioY = rect.h > 0 ? clamp((anchorY - rect.y) / rect.h, 0, 1) : 0.5;
    return {
      x: anchorX - nextWidth * ratioX,
      y: anchorY - nextHeight * ratioY,
      w: nextWidth,
      h: nextHeight,
    };
  }

  function resizeCustomTile(index: number, rect: { x: number; y: number; w: number; h: number }, aspect: number, scale: number, anchor?: { x: number; y: number }) {
    updateCustomTilePosition(index, getResizedCustomTileRect(settings, rect, aspect, scale, anchor));
  }

  function getLiveCustomRect(index: number, fallback: { x: number; y: number; w: number; h: number }) {
    return settings.layout === "custom" ? customLiveRectsRef.current[index] ?? fallback : fallback;
  }

  function syncActiveCustomDragRect(index: number, rect: { x: number; y: number; w: number; h: number }, pointerX: number, pointerY: number) {
    const drag = customDragRef.current;
    if (!drag) return;
    const itemIndex = drag.items.findIndex((item) => item.index === index);
    if (itemIndex < 0) return;
    drag.items = drag.items.map((item) => ({
      ...item,
      rect: item.index === index ? rect : getLiveCustomRect(item.index, item.rect),
    }));
    drag.startX = pointerX;
    drag.startY = pointerY;
  }

  function startCustomTileDrag(event: PointerEvent<HTMLDivElement>, index: number, position: { x: number; y: number; w: number; h: number }) {
    if (settings.layout !== "custom") return;
    if ((event.target as HTMLElement).closest("button, .resize-handle")) return;
    const boardBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!boardBounds) return;
    const item = renderedImages[getImageIndexForSlot(index) % renderedImages.length];
    if (!item) return;
    const pointerX = canvasBounds.x + ((event.clientX - boardBounds.left) / boardBounds.width) * displayBox.width;
    const pointerY = canvasBounds.y + ((event.clientY - boardBounds.top) / boardBounds.height) * displayBox.height;
    const currentPosition = getLiveCustomRect(index, position);
    const dragIds = !event.shiftKey && selectedImageIdSet.has(item.id) ? selectedImageIds : [item.id];
    const dragIdSet = new Set(dragIds);
    const dragItems = positions.reduce<Array<{ index: number; rect: { x: number; y: number; w: number; h: number } }>>((items, rect, slotIndex) => {
      if (slotIndex === paletteSlotIndex) return items;
      const slotItem = renderedImages[getImageIndexForSlot(slotIndex) % renderedImages.length];
      return slotItem && dragIdSet.has(slotItem.id) ? [...items, { index: slotIndex, rect: getLiveCustomRect(slotIndex, rect) }] : items;
    }, []);
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bringCustomTileToFront(index);
    if (!event.shiftKey && !selectedImageIdSet.has(item.id)) selectImage(item.id);
    setCustomDraggingIndex(index);
    customDragRef.current = { index, startX: pointerX, startY: pointerY, items: dragItems.length ? dragItems : [{ index, rect: currentPosition }], moved: false, historyCaptured: false };
  }

  function moveCustomTileDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = customDragRef.current;
    if (!drag) return;
    const boardBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!boardBounds) return;
    event.preventDefault();
    const pointerX = canvasBounds.x + ((event.clientX - boardBounds.left) / boardBounds.width) * displayBox.width;
    const pointerY = canvasBounds.y + ((event.clientY - boardBounds.top) / boardBounds.height) * displayBox.height;
    if (!drag.historyCaptured) {
      pushUndo();
      drag.historyCaptured = true;
    }
    drag.moved = true;
    const area = getLayoutArea(settings, previewBox.width, previewBox.height, titleSafeInset);
    const minX = area.outer;
    const minY = area.topOuter;
    const maxX = area.outer + area.innerWidth;
    const maxY = area.topOuter + area.innerHeight;
    const minDx = Math.max(...drag.items.map((item) => minX - item.rect.x));
    const maxDx = Math.min(...drag.items.map((item) => maxX - (item.rect.x + item.rect.w)));
    const minDy = Math.max(...drag.items.map((item) => minY - item.rect.y));
    const maxDy = Math.min(...drag.items.map((item) => maxY - (item.rect.y + item.rect.h)));
    const dx = clamp(pointerX - drag.startX, minDx, maxDx);
    const dy = clamp(pointerY - drag.startY, minDy, maxDy);
    updateCustomTilePositions(drag.items.map((item) => ({ index: item.index, rect: { ...item.rect, x: item.rect.x + dx, y: item.rect.y + dy } })));
  }

  function stopCustomTileDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = customDragRef.current;
    if (!drag) return;
    customDragRef.current = null;
    setCustomDraggingIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) suppressTileClickRef.current = true;
  }

  function startCustomTileResize(event: PointerEvent<HTMLDivElement>, index: number, position: { x: number; y: number; w: number; h: number }, aspect: number) {
    if (settings.layout !== "custom") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    bringCustomTileToFront(index);
    selectImage(renderedImages[getImageIndexForSlot(index) % renderedImages.length]?.id ?? null);
    setCustomDraggingIndex(index);
    customResizeRef.current = { index, startX: event.clientX, startY: event.clientY, startRect: getLiveCustomRect(index, position), aspect, moved: false, historyCaptured: false };
  }

  function moveCustomTileResize(event: PointerEvent<HTMLDivElement>) {
    const resize = customResizeRef.current;
    if (!resize) return;
    event.preventDefault();
    const delta = event.clientX - resize.startX + event.clientY - resize.startY;
    if (!resize.historyCaptured && Math.abs(delta) > 1) {
      pushUndo();
      resize.historyCaptured = true;
    }
    if (Math.abs(delta) > 1) resize.moved = true;
    resizeCustomTile(resize.index, resize.startRect, resize.aspect, 1 + delta / 260);
  }

  function stopCustomTileResize(event: PointerEvent<HTMLDivElement>) {
    const resize = customResizeRef.current;
    if (!resize) return;
    customResizeRef.current = null;
    setCustomDraggingIndex(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (resize.moved) suppressTileClickRef.current = true;
  }

  function wheelResizeCustomTile(event: WheelEvent<HTMLDivElement>, index: number, position: { x: number; y: number; w: number; h: number }, aspect: number) {
    if (settings.layout !== "custom") return;
    if (customResizeRef.current) return;
    const activeDrag = customDragRef.current;
    const resizeIndex = activeDrag ? activeDrag.index : index;
    const activeDragItem = activeDrag?.items.find((item) => item.index === resizeIndex);
    if (activeDrag && !activeDragItem) return;
    const boardBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!boardBounds) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerX = canvasBounds.x + ((event.clientX - boardBounds.left) / boardBounds.width) * displayBox.width;
    const pointerY = canvasBounds.y + ((event.clientY - boardBounds.top) / boardBounds.height) * displayBox.height;
    const anchor = { x: pointerX, y: pointerY };
    const deltaMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 240 : 1;
    const rawDelta = clamp(event.deltaY * deltaMultiplier, -140, 140);
    const direction = Math.sign(rawDelta);
    if (!direction) return;

    const now = window.performance.now();
    const current = wheelResizeRef.current?.index === resizeIndex ? wheelResizeRef.current : null;
    const isNewGesture = !current;
    const resizeFallback = activeDragItem?.rect ?? positions[resizeIndex] ?? position;
    const resizeItem = renderedImages[getImageIndexForSlot(resizeIndex) % renderedImages.length];
    const resizeAspect = resizeItem ? resizeItem.width / Math.max(1, resizeItem.height) : aspect;
    const resize = current ?? { index: resizeIndex, rect: getLiveCustomRect(resizeIndex, resizeFallback), aspect: resizeAspect, anchor, direction, lastWheelAt: now };

    if (isNewGesture) {
      pushUndo();
      bringCustomTileToFront(resizeIndex);
      selectImage(resizeItem?.id ?? null);
    }

    const isNoiseReversal = resize.direction !== direction && now - resize.lastWheelAt < 160 && Math.abs(rawDelta) < 120;
    if (isNoiseReversal) return;

    resize.anchor = anchor;
    resize.direction = direction;
    resize.lastWheelAt = now;
    resize.aspect = resizeAspect;
    resize.rect = getResizedCustomTileRect(settings, resize.rect, resizeAspect, Math.exp(-rawDelta * 0.0012), anchor);
    wheelResizeRef.current = resize;
    updateCustomTilePosition(resize.index, resize.rect);
    syncActiveCustomDragRect(resize.index, resize.rect, pointerX, pointerY);

    if (wheelHistoryTimeoutRef.current !== null) window.clearTimeout(wheelHistoryTimeoutRef.current);
    wheelHistoryTimeoutRef.current = window.setTimeout(() => {
      wheelHistoryTimeoutRef.current = null;
      wheelResizeRef.current = null;
    }, 260);
  }

  function getBoardPointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * displayBox.width, 0, displayBox.width),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * displayBox.height, 0, displayBox.height),
    };
  }

  function getMarqueeRect(startX: number, startY: number, endX: number, endY: number): MarqueeRect {
    return {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      w: Math.abs(endX - startX),
      h: Math.abs(endY - startY),
    };
  }

  function startCustomSelection(event: PointerEvent<HTMLDivElement>) {
    if (settings.layout !== "custom" || !canExport || event.target !== event.currentTarget) return;
    const pointer = getBoardPointer(event);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectImage(null);
    customSelectionRef.current = { startX: pointer.x, startY: pointer.y, moved: false };
    setCustomSelectionRect({ x: pointer.x, y: pointer.y, w: 0, h: 0 });
  }

  function moveCustomSelection(event: PointerEvent<HTMLDivElement>) {
    const selection = customSelectionRef.current;
    if (!selection) return;
    const pointer = getBoardPointer(event);
    const rect = getMarqueeRect(selection.startX, selection.startY, pointer.x, pointer.y);
    selection.moved = rect.w > 4 || rect.h > 4;
    setCustomSelectionRect(rect);
  }

  function stopCustomSelection(event: PointerEvent<HTMLDivElement>) {
    const selection = customSelectionRef.current;
    if (!selection) return;
    const pointer = getBoardPointer(event);
    const rect = getMarqueeRect(selection.startX, selection.startY, pointer.x, pointer.y);
    customSelectionRef.current = null;
    setCustomSelectionRect(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!selection.moved) return;

    const selected = positions.reduce<Array<{ id: string; key: string }>>((items, position, index) => {
      if (index === paletteSlotIndex) return items;
      const tileRect = { x: position.x - canvasBounds.x, y: position.y - canvasBounds.y, w: position.w, h: position.h };
      if (!rectsIntersect(rect, tileRect)) return items;
      const item = renderedImages[getImageIndexForSlot(index) % renderedImages.length];
      return item ? [...items, { id: item.id, key: getCustomLayoutKey(index, renderedImages, paletteSlotIndex) }] : items;
    }, []);
    selectImages(selected.map((item) => item.id));
    bringCustomKeysToFront(selected.map((item) => item.key));
  }

  function startCropDrag(event: PointerEvent<HTMLDivElement>, item: BoardImage) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const frameBounds = event.currentTarget.getBoundingClientRect();
    const stageBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!stageBounds) return;
    selectImage(item.id);
    cropDragRef.current = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      cropX: item.cropX,
      cropY: item.cropY,
      moveX: Math.max(0, stageBounds.width - frameBounds.width),
      moveY: Math.max(0, stageBounds.height - frameBounds.height),
      historyCaptured: false,
    };
  }

  function moveCropDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag) return;
    event.preventDefault();
    const nextX = drag.moveX > 0 ? clamp(drag.cropX + ((event.clientX - drag.startX) / drag.moveX) * 100, 0, 100) : drag.cropX;
    const nextY = drag.moveY > 0 ? clamp(drag.cropY + ((event.clientY - drag.startY) / drag.moveY) * 100, 0, 100) : drag.cropY;
    if (!drag.historyCaptured && (Math.round(nextX) !== drag.cropX || Math.round(nextY) !== drag.cropY)) {
      pushUndo();
      drag.historyCaptured = true;
    }
    updateImageCrop(drag.id, { cropX: Math.round(nextX), cropY: Math.round(nextY) }, false);
  }

  function stopCropDrag(event: PointerEvent<HTMLDivElement>) {
    if (!cropDragRef.current) return;
    const croppedId = cropDragRef.current.id;
    cropDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (cropModalImageId === croppedId) setCropModalImageId(null);
  }

  async function handleExport() {
    if (!canExport || exportStatus === "exporting") return;

    setExportStatus("exporting");
    setMessage("");
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    try {
      exportBoard(images, palette, settings);
      setExportStatus("done");
      window.setTimeout(() => setExportStatus("idle"), 1400);
    } catch {
      setExportStatus("idle");
      setMessage("Export failed. Try a smaller quality setting or fewer images.");
    }
  }

  const exportButtonLabel =
    exportStatus === "exporting" ? "Exporting..." : exportStatus === "done" ? "Exported" : `Export ${settings.exportFormat.toUpperCase()}`;

  return (
    <div className={`app-shell theme-${theme}${debugLayout ? " debug-layout" : ""}`}>
      <Topbar theme={theme} canExport={canExport} renderedImageCount={renderedImages.length} onThemeChange={setTheme} />

      <main className="workspace">
        <ImageRail
          images={images}
          railMessage={railMessage}
          fileInputRef={fileInputRef}
          railDragDepthRef={railDragDepthRef}
          isDraggingFiles={isDraggingFiles}
          setIsDraggingFiles={setIsDraggingFiles}
          addFiles={addFiles}
          clearImages={clearImages}
          removeImage={removeImage}
        />

        <section className="stage" aria-label="imgmood workspace">
          <div className="stage-toolbar">
            <div className="board-name-block">
              <label className="workspace-label" htmlFor="board-name-input">Current board</label>
              <input
                id="board-name-input"
                className="board-name-input"
                value={boardNameDraft}
                maxLength={56}
                placeholder={boardName}
                onChange={(event) => setBoardNameDraft(event.target.value)}
                onBlur={() => void commitBoardName()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    cancelBoardNameEditRef.current = true;
                    setBoardNameDraft(settings.filename);
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
            <div className="stage-actions">
              <button className="ghost-button compact" type="button" onClick={createNewBoard}>
                New
              </button>
              <select className="project-select" value={selectedProjectId} disabled={!savedProjects.length} onChange={(event) => void loadProjectById(event.target.value)}>
                {savedProjects.length ? (
                  savedProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} ({project.imageCount})
                    </option>
                  ))
                ) : (
                  <option value="">No saved projects</option>
                )}
              </select>
              {!activeProjectId ? (
                <button className="ghost-button compact" type="button" disabled={!images.length} onClick={saveProject}>
                  Save
                </button>
              ) : null}
              <button className="ghost-button compact" type="button" disabled={!selectedProjectId} onClick={() => void deleteSelectedProject()}>
                Delete
              </button>
            </div>
          </div>

          <div
            className={`${isDraggingBoardFiles ? "board-frame dragging-files" : "board-frame"}${settings.trimBackground ? " trimmed" : ""}${hasBoardTitle ? " has-title" : ""}`}
            style={
              {
                background: settings.background,
                "--board-ink": getReadableInk(settings.background),
                aspectRatio: settings.trimBackground ? `${displayBox.width} / ${displayBox.height}` : getAspectRatioCss(settings.aspectRatio),
                width: `min(100%, ${getPreviewWidth(settings.aspectRatio)}px, calc((100svh - 210px) * ${settings.trimBackground ? frameAspect : getAspectNumber(settings.aspectRatio)}))`,
                "--title-height": `${titleHeight}px`,
                "--title-center-y": `${titleCenterPercent}%`,
                "--title-left-inset": `${titleLeftInsetPercent}%`,
                "--title-right-inset": `${titleRightInsetPercent}%`,
                "--title-inner-pad": `${titleInnerPad}px`,
                "--debug-title-top": `${titleSlotTopPercent}%`,
                "--debug-title-bottom": `${titleSlotBottomPercent}%`,
                "--debug-image-top": `${firstImageTopPercent}%`,
                "--title-x-space": `${hasBoardTitle ? 0 : titleXSpace}px`,
              } as React.CSSProperties
            }
            onDragEnter={(event) => {
              if (!hasImageFiles(event.dataTransfer)) return;
              event.preventDefault();
              setIsDraggingBoardFiles(true);
            }}
            onDragOver={(event) => {
              if (!hasImageFiles(event.dataTransfer)) return;
              event.preventDefault();
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDraggingBoardFiles(false);
              }
            }}
            onDrop={(event) => {
              if (!hasImageFiles(event.dataTransfer)) return;
              event.preventDefault();
              setIsDraggingBoardFiles(false);
              void addFiles(event.dataTransfer.files);
            }}
          >
            {debugLayout ? (
              <div className="debug-panel" aria-hidden="true">
                <b>Layout debug</b>
                <span>title {Math.round(titleHeight)}px</span>
                <span>title y {titleCenterPercent.toFixed(1)}%</span>
                <span>
                  title x {titleLeftInsetPercent.toFixed(1)} / {titleRightInsetPercent.toFixed(1)}%
                </span>
                <span>
                  canvas {Math.round(displayBox.width)} x {Math.round(displayBox.height)}
                </span>
                <span>
                  bounds {Math.round(canvasBounds.x)}, {Math.round(canvasBounds.y)}
                </span>
                <span>first image y {Math.round(firstImageTop)}</span>
                <span>top to title {Math.round(titleSlotTopGap)}</span>
                <span>title to image {Math.round(titleSlotBottomGap)}</span>
                <span>
                  outer {Math.round(layoutArea.outer)} / {Math.round(layoutArea.topOuter)} gap {Math.round(layoutArea.gap)}
                </span>
              </div>
            ) : null}
            <div
              className={`${canExport ? "board-canvas" : "board-canvas empty"} fit-fill layout-${settings.layout}${isSeamless ? " seamless" : ""}${settings.spacing > 0 && settings.spacing <= 2 ? " tight-spacing" : ""}`}
              style={
                {
                  "--tile-radius": `${settings.radius}px`,
                  "--image-outline": `${settings.imageOutline}px`,
                  "--image-outline-color": settings.imageOutlineColor,
                  "--seam-overlap": isSeamless ? "1px" : "0px",
                } as React.CSSProperties
              }
              onDragOver={(event) => {
                if (dragIndex !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragIndex(null);
              }}
              onPointerDown={startCustomSelection}
              onPointerMove={moveCustomSelection}
              onPointerUp={stopCustomSelection}
              onPointerCancel={stopCustomSelection}
            >
              {hasBoardTitle ? (
                <div className={`board-title ${settings.headerStyle} align-${settings.headerAlign}`} style={{ fontSize: `${settings.headerSize}px` }}>
                  <span>{settings.header}</span>
                </div>
              ) : null}
              {debugLayout && hasBoardTitle ? (
                <div className="debug-title-guides" aria-hidden="true">
                  <div className="debug-gap debug-gap-top">
                    <span>{Math.round(titleSlotTopGap)}px</span>
                  </div>
                  <div className="debug-gap debug-gap-bottom">
                    <span>{Math.round(titleSlotBottomGap)}px</span>
                  </div>
                  <div className="debug-marker debug-marker-title-top"><span>title top</span></div>
                  <div className="debug-marker debug-marker-title-bottom"><span>title bottom</span></div>
                  <div className="debug-marker debug-marker-image-top"><span>first image</span></div>
                </div>
              ) : null}
              {canExport ? (
                <>
                  {customSelectionRect ? (
                    <div
                      className="custom-selection-box"
                      aria-hidden="true"
                      style={{
                        left: `${(customSelectionRect.x / displayBox.width) * 100}%`,
                        top: `${(customSelectionRect.y / displayBox.height) * 100}%`,
                        width: `${(customSelectionRect.w / displayBox.width) * 100}%`,
                        height: `${(customSelectionRect.h / displayBox.height) * 100}%`,
                      }}
                    />
                  ) : null}
                  {positions.map((position, index) => {
                  const isPaletteTile = index === paletteSlotIndex;
                  const item = renderedImages[getImageIndexForSlot(index) % renderedImages.length];
                  const isSelectedTile = !isPaletteTile && Boolean(item && selectedImageIdSet.has(item.id));
                  const isCustomDragging = settings.layout === "custom" && customDraggingIndex === index;
                  const itemAspect = isPaletteTile ? 1.35 : item.width / Math.max(1, item.height);
                  const tileVisual = getTileVisual(settings.layout, index);
                  const customLayerKey = getCustomLayoutKey(index, renderedImages, paletteSlotIndex);
                  const customLayerRank = settings.customLayerOrder.indexOf(customLayerKey);
                  const selectionRank = item ? selectedImageIds.indexOf(item.id) : -1;
                  const customZIndex =
                    settings.layout === "custom" && customLayerRank >= 0
                      ? 900 + customLayerRank
                      : settings.layout === "custom" && isSelectedTile
                        ? 800 + Math.max(0, selectionRank)
                      : tileVisual.zIndex;
                  return (
                    <div
                      className={`board-tile tile-outline outline-${settings.imageOutlineMode} ${isPaletteTile ? "palette-board-tile" : "image-board-tile"}${!isPaletteTile && item?.size === "small" ? " small" : ""}${isSelectedTile ? " selected" : ""}${isCustomDragging ? " dragging" : ""}`}
                      key={isPaletteTile ? "palette" : customLayerKey}
                      draggable={settings.layout === "custom" ? false : isPaletteTile || images.length > 1}
                      style={{
                        left: `${((position.x - canvasBounds.x) / displayBox.width) * 100}%`,
                        top: `${((position.y - canvasBounds.y) / displayBox.height) * 100}%`,
                        width: `calc(${(position.w / displayBox.width) * 100}% + var(--seam-overlap))`,
                        height: `calc(${(position.h / displayBox.height) * 100}% + var(--seam-overlap))`,
                        "--tile-rotate": `${tileVisual.rotation}deg`,
                        zIndex: isCustomDragging ? 999 : customZIndex,
                      } as React.CSSProperties}
                      onPointerDown={(event) => startCustomTileDrag(event, index, position)}
                      onPointerMove={moveCustomTileDrag}
                      onPointerUp={stopCustomTileDrag}
                      onPointerCancel={stopCustomTileDrag}
                      onWheel={(event) => {
                        if (!isPaletteTile) wheelResizeCustomTile(event, index, position, itemAspect);
                      }}
                      onDragStart={() => setDragIndex(index)}
                      onClick={(event) => {
                        if (suppressTileClickRef.current) {
                          suppressTileClickRef.current = false;
                          return;
                        }
                        if (settings.layout === "custom") {
                          if (!isPaletteTile && item) {
                            bringCustomTileToFront(index);
                            if (event.shiftKey) toggleImageSelection(item.id);
                            else selectImage(item.id);
                          }
                          return;
                        }
                        if (!isPaletteTile && item) {
                          selectImage(item.id);
                          setCropModalAspect(position.w / Math.max(1, position.h));
                          setCropModalImageId(item.id);
                        }
                      }}
                      onDragOver={(event) => {
                        if (dragIndex !== null) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null) moveBoardTile(dragIndex, index);
                        setDragIndex(null);
                      }}
                    >
                      {isPaletteTile ? (
                        <PaletteTile palette={palette} showLabels={settings.showPaletteHexLabels} style={settings.paletteTileStyle} />
                      ) : (
                        <>
                          <img src={item.url} alt={item.name} draggable={false} style={{ objectPosition: `${item.cropX}% ${item.cropY}%` }} />
                          {images.length > 1 ? (
                            <div className="tile-actions">
                              <button type="button" title="Remove image" aria-label="Remove image" onClick={() => removeImage(getImageIndexForSlot(index))}>
                                <CloseIcon />
                              </button>
                            </div>
                          ) : null}
                          {settings.layout === "custom" && selectedImageId === item?.id ? (
                            <div
                              className="resize-handle"
                              title="Resize image"
                              onPointerDown={(event) => startCustomTileResize(event, index, position, itemAspect)}
                              onPointerMove={moveCustomTileResize}
                              onPointerUp={stopCustomTileResize}
                              onPointerCancel={stopCustomTileResize}
                            >
                              <ResizeIcon />
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
                </>
              ) : (
                <button className="empty-board-button" type="button" onClick={() => fileInputRef.current?.click()}>
                  <UploadIcon />
                  <strong>Add images to start</strong>
                  <span>Drop a set of covers, interiors, references, or product shots.</span>
                </button>
              )}
            </div>
          </div>
        </section>

        <SettingsInspector
          imagesLength={images.length}
          palette={palette}
          settings={settings}
          countMax={countMax}
          exportSize={exportSize}
          canExport={canExport}
          isExporting={exportStatus === "exporting"}
          exportButtonLabel={exportButtonLabel}
          undoCount={undoStack.length}
          redoCount={redoStack.length}
          updateSettings={updateSettings}
          updatePalette={updatePalette}
          regenerate={regenerate}
          undoBoard={undoBoard}
          redoBoard={redoBoard}
          handleExport={handleExport}
        />
      </main>
      {cropModalImage ? (
        <CropModal
          image={cropModalImage}
          cropFrame={cropFrame}
          onClose={() => setCropModalImageId(null)}
          onReset={() => updateImageCrop(cropModalImage.id, { cropX: 50, cropY: 50 })}
          onStartCropDrag={startCropDrag}
          onMoveCropDrag={moveCropDrag}
          onStopCropDrag={stopCropDrag}
        />
      ) : null}
    </div>
  );
}
