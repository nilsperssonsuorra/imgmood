import { computePositions, getCustomLayoutKey, getExportSize, getImageSlotIndex, getPaletteSlotIndex, getRatioBox, getRenderedImages, getTileVisual } from "./layout";
import type { BoardImage, BoardSettings } from "./types";

export function exportBoard(images: BoardImage[], palette: string[], settings: BoardSettings) {
  if (!images.length) return;

  const canvas = renderBoardCanvas(images, palette, settings);
  if (!canvas) return;

  const filename = slugify(settings.filename || settings.header || "imgmood");
  if (settings.exportFormat === "pdf") {
    exportCanvasAsPdf(canvas, filename);
    return;
  }

  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function renderBoardCanvas(images: BoardImage[], palette: string[], settings: BoardSettings) {
  const exportSize = getExportSize(settings.aspectRatio, settings.exportQuality);
  const canvas = document.createElement("canvas");
  canvas.width = exportSize.width;
  canvas.height = exportSize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const hasHeader = settings.showHeader && Boolean(settings.header.trim());
  const logicalBox = getRatioBox(1000, settings.aspectRatio);
  const boardWidth = logicalBox.width;
  const boardHeight = Math.max(240, logicalBox.height);
  const scaleX = canvas.width / boardWidth;
  const scaleY = canvas.height / boardHeight;
  const headerTextHeight = getHeaderHeight(settings.headerSize, settings.trimBackground);
  const headerHeight = hasHeader ? headerTextHeight : 0;
  const titleSafeInset = hasHeader ? getTitleSafeInset(settings, headerHeight) : 0;
  const renderedImages = getRenderedImages(images, settings);
  const positions = computePositions(images, settings, boardWidth, boardHeight, titleSafeInset);
  const contentTop = positions.length ? Math.max(0, Math.min(...positions.map((position) => position.y))) : 0;
  const contentBounds = positions.length ? getPositionBounds(positions) : { x: 0, y: 0, w: boardWidth, h: boardHeight };
  const paletteIndex = getPaletteSlotIndex(renderedImages.length, settings);
  const tileRects = positions.map((pos) => getExportTileRect(pos, settings.spacing === 0));

  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.fillStyle = settings.background;
  ctx.fillRect(0, 0, boardWidth, boardHeight);

  if (headerHeight) {
    const titleInnerPad = getTitleInnerPad(settings.headerSize);
    const textMetrics = getHeaderTextMetrics(contentBounds.x + titleInnerPad, Math.max(1, contentBounds.w - titleInnerPad * 2), settings.headerAlign);
    ctx.fillStyle = getReadableInk(settings.background);
    ctx.textAlign = settings.headerAlign;
    ctx.textBaseline = "middle";
    ctx.font = getHeaderFont(settings);
    ctx.fillText(getHeaderText(settings), textMetrics.x, contentTop / 2, textMetrics.maxWidth);
  }

  getDrawOrder(positions.length, renderedImages, paletteIndex, settings).forEach((index) => {
    const tile = tileRects[index];
    const outlineWidth = getTileBorderWidth(settings, tile);
    const contentInset = getOutlineContentInset(settings, outlineWidth);
    const tileRadius = settings.spacing === 0 ? 0 : settings.radius;
    const tileVisual = getTileVisual(settings.layout, index);

    ctx.save();
    ctx.translate(tile.x + tile.w / 2, tile.y + tile.h / 2);
    ctx.rotate((tileVisual.rotation * Math.PI) / 180);

    const contentX = -tile.w / 2 + contentInset;
    const contentY = -tile.h / 2 + contentInset;
    const contentWidth = Math.max(1, tile.w - contentInset * 2);
    const contentHeight = Math.max(1, tile.h - contentInset * 2);

    ctx.save();
    roundedRect(ctx, contentX, contentY, contentWidth, contentHeight, Math.max(0, tileRadius - contentInset));
    ctx.clip();

    if (index === paletteIndex) {
      drawPalette(ctx, palette, contentX, contentY, contentWidth, contentHeight, settings);
    } else {
      const imageIndex = getImageSlotIndex(index, paletteIndex);
      const item = renderedImages[imageIndex % renderedImages.length];
      const shouldContain = settings.layout === "custom";
      const shouldFill = !shouldContain && (settings.spacing === 0 || settings.imageFit === "fill");
      const inset = shouldFill || shouldContain || item.size !== "small" ? 0 : Math.min(contentWidth, contentHeight) * 0.11;
      if (shouldFill) {
        drawImageCovered(ctx, item.image, contentX, contentY, contentWidth, contentHeight, item.cropX, item.cropY);
      } else {
        drawImageContained(ctx, item.image, contentX + inset, contentY + inset, contentWidth - inset * 2, contentHeight - inset * 2);
      }
    }

    ctx.restore();
    if (outlineWidth) drawImageOutline(ctx, tile.w, tile.h, tileRadius, outlineWidth, settings);
    ctx.restore();
  });

  const visualRects = tileRects.map((tile, index) => getVisualTileRect(tile, settings, index, paletteIndex));
  const headerRect = headerHeight ? { x: 0, y: 0, w: boardWidth, h: Math.max(headerHeight, contentTop) } : null;
  ctx.restore();
  return settings.trimBackground ? cropCanvas(canvas, scaleBounds(getContentBounds(visualRects, headerRect), scaleX, scaleY)) : canvas;
}

function getTileBorderWidth(settings: BoardSettings, tile: { w: number; h: number }) {
  return Math.min(Math.min(tile.w, tile.h) * 0.18, Math.max(0, settings.imageOutline));
}

function getDrawOrder(totalCount: number, renderedImages: BoardImage[], paletteIndex: number, settings: BoardSettings) {
  const order = Array.from({ length: totalCount }, (_, index) => index);
  if (settings.layout !== "custom" || !settings.customLayerOrder.length) return order;

  const rank = new Map(settings.customLayerOrder.map((key, index) => [key, index]));
  return order.sort((a, b) => {
    const aRank = rank.get(getCustomLayoutKey(a, renderedImages, paletteIndex)) ?? -1;
    const bRank = rank.get(getCustomLayoutKey(b, renderedImages, paletteIndex)) ?? -1;
    return aRank === bRank ? a - b : aRank - bRank;
  });
}

function getOutlineContentInset(settings: BoardSettings, outlineWidth: number) {
  if (!outlineWidth) return 0;
  if (settings.imageOutlineMode === "outer") return 0;
  if (settings.imageOutlineMode === "center") return outlineWidth / 2;
  return outlineWidth;
}

function getOutlineOutsideWidth(settings: BoardSettings, outlineWidth: number) {
  if (!outlineWidth) return 0;
  if (settings.imageOutlineMode === "outer") return outlineWidth;
  if (settings.imageOutlineMode === "center") return outlineWidth / 2;
  return 0;
}

function drawImageOutline(ctx: CanvasRenderingContext2D, width: number, height: number, radius: number, outlineWidth: number, settings: BoardSettings) {
  const outside = getOutlineOutsideWidth(settings, outlineWidth);
  const offset = outside - outlineWidth / 2;
  const x = -width / 2 - offset;
  const y = -height / 2 - offset;
  const strokeWidth = width + offset * 2;
  const strokeHeight = height + offset * 2;
  ctx.save();
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = settings.imageOutlineColor || "#ffffff";
  roundedRect(ctx, x, y, strokeWidth, strokeHeight, Math.max(0, radius));
  ctx.stroke();
  ctx.restore();
}

function getVisualTileRect(tile: { x: number; y: number; w: number; h: number }, settings: BoardSettings, index: number, paletteIndex: number) {
  const visual = getTileVisual(settings.layout, index);
  void paletteIndex;
  const outlineOutside = getOutlineOutsideWidth(settings, getTileBorderWidth(settings, tile));
  const expandedTile = {
    x: tile.x - outlineOutside,
    y: tile.y - outlineOutside,
    w: tile.w + outlineOutside * 2,
    h: tile.h + outlineOutside * 2,
  };
  const angle = Math.abs((visual.rotation * Math.PI) / 180);
  const rotatedWidth = Math.abs(expandedTile.w * Math.cos(angle)) + Math.abs(expandedTile.h * Math.sin(angle));
  const rotatedHeight = Math.abs(expandedTile.w * Math.sin(angle)) + Math.abs(expandedTile.h * Math.cos(angle));
  const shadowPad = 0;
  return {
    x: expandedTile.x + expandedTile.w / 2 - rotatedWidth / 2 - shadowPad,
    y: expandedTile.y + expandedTile.h / 2 - rotatedHeight / 2 - shadowPad,
    w: rotatedWidth + shadowPad * 2,
    h: rotatedHeight + shadowPad * 2,
  };
}

function getExportTileRect(pos: { x: number; y: number; w: number; h: number }, seamless: boolean) {
  if (!seamless) {
    return {
      x: pos.x,
      y: pos.y,
      w: pos.w,
      h: pos.h,
    };
  }

  const x = Math.floor(pos.x);
  const y = Math.floor(pos.y);
  const right = Math.ceil(pos.x + pos.w) + 1;
  const bottom = Math.ceil(pos.y + pos.h) + 1;
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function scaleBounds(bounds: { x: number; y: number; w: number; h: number }, scaleX: number, scaleY: number) {
  const x = Math.floor(bounds.x * scaleX);
  const y = Math.floor(bounds.y * scaleY);
  const right = Math.ceil((bounds.x + bounds.w) * scaleX);
  const bottom = Math.ceil((bounds.y + bounds.h) * scaleY);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function getContentBounds(rects: Array<{ x: number; y: number; w: number; h: number }>, extraRect: { x: number; y: number; w: number; h: number } | null) {
  const allRects = extraRect ? [...rects, extraRect] : rects;
  const minX = Math.floor(Math.min(...allRects.map((rect) => rect.x)));
  const minY = Math.floor(Math.min(...allRects.map((rect) => rect.y)));
  const maxX = Math.ceil(Math.max(...allRects.map((rect) => rect.x + rect.w)));
  const maxY = Math.ceil(Math.max(...allRects.map((rect) => rect.y + rect.h)));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function getPositionBounds(positions: Array<{ x: number; y: number; w: number; h: number }>) {
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + position.w));
  const maxY = Math.max(...positions.map((position) => position.y + position.h));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function cropCanvas(source: HTMLCanvasElement, bounds: { x: number; y: number; w: number; h: number }) {
  const x = Math.max(0, Math.min(source.width - 1, bounds.x));
  const y = Math.max(0, Math.min(source.height - 1, bounds.y));
  const width = Math.max(1, Math.min(bounds.w, source.width - x));
  const height = Math.max(1, Math.min(bounds.h, source.height - y));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function getHeaderHeight(size: number, trimmed: boolean) {
  const multiplier = trimmed ? 1.22 : 1.16;
  const maxHeight = trimmed ? 112 : 96;
  return Math.round(Math.min(maxHeight, Math.max(42, size * multiplier)));
}

function getTitleSafeInset(settings: BoardSettings, titleHeight: number) {
  const outer = settings.trimBackground ? 0 : Math.max(18, settings.spacing * 2);
  return Math.max(0, titleHeight + 32 - outer);
}

function getTitleInnerPad(size: number) {
  return Math.round(Math.min(28, Math.max(16, size * 0.24)));
}

function getHeaderTextMetrics(left: number, width: number, align: BoardSettings["headerAlign"]) {
  const maxWidth = Math.max(1, width);
  if (align === "center") return { x: left + width / 2, maxWidth };
  if (align === "right") return { x: left + width, maxWidth };
  return { x: left, maxWidth };
}

function getHeaderFont(settings: BoardSettings) {
  const size = settings.headerSize;
  if (settings.headerStyle === "serif") return `700 ${size}px 'Libre Baskerville', Georgia, serif`;
  if (settings.headerStyle === "editorial") return `760 ${size}px Fraunces, Georgia, serif`;
  if (settings.headerStyle === "caption") return `800 ${size}px Inter, system-ui, sans-serif`;
  return `760 ${size}px Inter, system-ui, sans-serif`;
}

function getHeaderText(settings: BoardSettings) {
  const text = settings.header.trim();
  return settings.headerStyle === "caption" ? text.toUpperCase() : text;
}

function getReadableInk(background: string) {
  const hex = background.replace("#", "");
  if (!/^[\da-f]{6}$/i.test(hex)) return "#17172d";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance < 0.42 ? "#f8f2ea" : "#211b17";
}

function drawPalette(CanvasCtx: CanvasRenderingContext2D, palette: string[], x: number, y: number, width: number, height: number, settings: BoardSettings) {
  CanvasCtx.fillStyle = settings.paletteTileStyle === "minimal" ? "#ffffff" : "rgba(255,255,255,0.34)";
  roundedRect(CanvasCtx, x, y, width, height, Math.min(settings.radius, 14));
  CanvasCtx.fill();

  if (settings.paletteTileStyle === "strip") {
    drawPaletteStrip(CanvasCtx, palette, x, y, width, height);
    return;
  }

  if (settings.paletteTileStyle === "swatches") {
    drawPaletteSwatches(CanvasCtx, palette, x, y, width, height, settings.radius, settings.showPaletteHexLabels);
    return;
  }

  if (settings.paletteTileStyle === "minimal") {
    drawPaletteMinimal(CanvasCtx, palette, x, y, width, height);
    return;
  }

  drawPaletteBars(CanvasCtx, palette, x, y, width, height, settings.showPaletteHexLabels);
}

function drawPaletteBars(CanvasCtx: CanvasRenderingContext2D, palette: string[], x: number, y: number, width: number, height: number, showLabels: boolean) {
  const rowHeight = height / palette.length;
  palette.forEach((color, index) => {
    const rowY = y + index * rowHeight;
    CanvasCtx.fillStyle = color;
    CanvasCtx.fillRect(x, rowY, width, rowHeight + 0.5);
    if (showLabels) {
      CanvasCtx.fillStyle = isDark(color) ? "rgba(255,255,255,0.9)" : "rgba(17,22,47,0.78)";
      CanvasCtx.font = `800 ${Math.round(Math.min(22, Math.max(13, rowHeight * 0.28)))}px Inter, system-ui, sans-serif`;
      CanvasCtx.textAlign = "left";
      CanvasCtx.textBaseline = "middle";
      CanvasCtx.fillText(color.toUpperCase(), x + Math.min(24, Math.max(12, width * 0.05)), rowY + rowHeight / 2, Math.max(40, width - 24));
    }
  });
}

function drawPaletteSwatches(
  CanvasCtx: CanvasRenderingContext2D,
  palette: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  showLabels: boolean,
) {
  const gap = 12;
  const inset = Math.min(24, Math.max(10, Math.min(width, height) * 0.07));
  const cols = 2;
  const rows = Math.ceil(palette.length / cols);
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const cellWidth = (innerWidth - gap * (cols - 1)) / cols;
  const cellHeight = (innerHeight - gap * (rows - 1)) / rows;

  palette.forEach((color, index) => {
    const cellX = x + inset + (index % cols) * (cellWidth + gap);
    const cellY = y + inset + Math.floor(index / cols) * (cellHeight + gap);
    CanvasCtx.fillStyle = color;
    roundedRect(CanvasCtx, cellX, cellY, cellWidth, cellHeight, Math.min(16, radius));
    CanvasCtx.fill();
    if (showLabels) {
      CanvasCtx.fillStyle = isDark(color) ? "rgba(255,255,255,0.9)" : "rgba(17,22,47,0.78)";
      CanvasCtx.font = `800 ${Math.round(Math.min(18, Math.max(11, cellHeight * 0.22)))}px Inter, system-ui, sans-serif`;
      CanvasCtx.textAlign = "center";
      CanvasCtx.textBaseline = "middle";
      CanvasCtx.fillText(color.toUpperCase(), cellX + cellWidth / 2, cellY + cellHeight / 2, Math.max(32, cellWidth - 12));
    }
  });
}

function drawPaletteStrip(CanvasCtx: CanvasRenderingContext2D, palette: string[], x: number, y: number, width: number, height: number) {
  const rowWidth = width / palette.length;
  palette.forEach((color, index) => {
    CanvasCtx.fillStyle = color;
    CanvasCtx.fillRect(x + index * rowWidth, y, rowWidth + 0.5, height);
  });
}

function drawPaletteMinimal(CanvasCtx: CanvasRenderingContext2D, palette: string[], x: number, y: number, width: number, height: number) {
  const gap = 14;
  const diameter = Math.min((Math.min(width, height) - gap * 2) / 3, 74);
  const cols = 3;
  const rows = Math.ceil(palette.length / cols);
  const totalWidth = cols * diameter + (cols - 1) * gap;
  const totalHeight = rows * diameter + (rows - 1) * gap;
  const startX = x + (width - totalWidth) / 2;
  const startY = y + (height - totalHeight) / 2;

  palette.forEach((color, index) => {
    const cx = startX + (index % cols) * (diameter + gap) + diameter / 2;
    const cy = startY + Math.floor(index / cols) * (diameter + gap) + diameter / 2;
    CanvasCtx.fillStyle = color;
    CanvasCtx.beginPath();
    CanvasCtx.arc(cx, cy, diameter / 2, 0, Math.PI * 2);
    CanvasCtx.fill();
  });
}

function isDark(hex: string) {
  const rgb = hex.replace("#", "").match(/.{2}/g)?.map((value) => parseInt(value, 16)) ?? [255, 255, 255];
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return luminance < 0.42;
}

function drawImageContained(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const sourceAspect = image.width / image.height;
  const targetAspect = width / height;
  const useWidth = sourceAspect > targetAspect;
  const drawWidth = useWidth ? width : height * sourceAspect;
  const drawHeight = useWidth ? width / sourceAspect : height;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageCovered(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, cropX: number, cropY: number) {
  const sourceAspect = image.width / image.height;
  const targetAspect = width / height;
  const useHeight = sourceAspect > targetAspect;
  const sourceWidth = useHeight ? image.height * targetAspect : image.width;
  const sourceHeight = useHeight ? image.height : image.width / targetAspect;
  const sourceX = (image.width - sourceWidth) * clamp(cropX / 100, 0, 1);
  const sourceY = (image.height - sourceHeight) * clamp(cropY / 100, 0, 1);
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function exportCanvasAsPdf(canvas: HTMLCanvasElement, filename: string) {
  const imageBytes = dataUrlToBytes(canvas.toDataURL("image/jpeg", 0.95));
  const content = `q\n${canvas.width} 0 0 ${canvas.height} 0 0 cm\n/Im0 Do\nQ\n`;
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let offset = 0;

  function addString(value: string) {
    const bytes = encoder.encode(value);
    parts.push(value);
    offset += bytes.length;
  }

  function addBytes(bytes: Uint8Array) {
    const copy = new Uint8Array(bytes);
    parts.push(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength));
    offset += bytes.length;
  }

  function addObject(id: number, body: string) {
    offsets[id] = offset;
    addString(`${id} 0 obj\n${body}\nendobj\n`);
  }

  addString("%PDF-1.4\n%imgmood\n");
  addObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  addObject(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${canvas.width} ${canvas.height}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  );

  offsets[4] = offset;
  addString(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
  );
  addBytes(imageBytes);
  addString("\nendstream\nendobj\n");

  const contentBytes = encoder.encode(content);
  offsets[5] = offset;
  addString(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  addBytes(contentBytes);
  addString("\nendstream\nendobj\n");

  const xrefOffset = offset;
  addString("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) {
    addString(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  addString(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  downloadBlob(new Blob(parts, { type: "application/pdf" }), `${filename}.pdf`);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "imgmood";
}
