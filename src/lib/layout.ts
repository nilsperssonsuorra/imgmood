import type { AspectRatio, BoardImage, BoardSettings, ExportQuality, Rect } from "./types";

export function getExportSize(aspectRatio: AspectRatio, quality: ExportQuality = "high") {
  const sizes: Record<AspectRatio, [number, number]> = {
    "16:9": [2048, 1152],
    "4:3": [2048, 1536],
    "1:1": [1800, 1800],
    "3:4": [1536, 2048],
    "9:16": [1152, 2048],
  };
  const scale: Record<ExportQuality, number> = {
    standard: 0.72,
    high: 1,
    print: 1.5,
  };
  const [width, height] = sizes[aspectRatio];
  return { width: makeEven(width * scale[quality]), height: makeEven(height * scale[quality]) };
}

export function getRatioBox(width: number, aspectRatio: AspectRatio) {
  const [ratioWidth, ratioHeight] = aspectRatio.split(":").map(Number);
  return { width, height: width * (ratioHeight / ratioWidth) };
}

export function getAspectRatioCss(aspectRatio: AspectRatio) {
  return aspectRatio.replace(":", " / ");
}

export function getRenderedImages(images: BoardImage[], settings: BoardSettings) {
  if (!images.length) return [];
  if (images.length === 1) {
    return Array.from({ length: Math.max(1, settings.count) }, () => images[0]);
  }
  return images.slice(0, Math.min(settings.count, images.length));
}

export function getPaletteSlotIndex(imageSlotCount: number, settings: BoardSettings) {
  if (!settings.includePalette) return -1;
  const totalCount = imageSlotCount + 1;
  if (settings.paletteTileIndex < 0) return totalCount - 1;
  return clamp(Math.round(settings.paletteTileIndex), 0, totalCount - 1);
}

export const paletteCustomLayoutKey = "__palette__";

export function getImageSlotIndex(slotIndex: number, paletteSlotIndex: number) {
  return slotIndex - (paletteSlotIndex >= 0 && slotIndex > paletteSlotIndex ? 1 : 0);
}

export function getCustomLayoutKey(slotIndex: number, renderedImages: BoardImage[], paletteSlotIndex: number) {
  if (slotIndex === paletteSlotIndex) return paletteCustomLayoutKey;
  if (!renderedImages.length) return String(slotIndex);
  const imageSlotIndex = getImageSlotIndex(slotIndex, paletteSlotIndex);
  const item = renderedImages[imageSlotIndex % renderedImages.length];
  if (!item) return String(slotIndex);
  const duplicateCount = renderedImages.reduce((count, image) => count + (image.id === item.id ? 1 : 0), 0);
  return duplicateCount > 1 ? `${item.id}:${imageSlotIndex}` : item.id;
}

export function getLayoutArea(settings: BoardSettings, width: number, height: number, topSafeInset = 0) {
  const gap = settings.spacing * 2;
  const outer = settings.trimBackground ? 0 : Math.max(18, gap);
  const topOuter = outer + topSafeInset;
  return {
    gap,
    outer,
    topOuter,
    innerWidth: Math.max(1, width - outer * 2),
    innerHeight: Math.max(1, height - topOuter - outer),
  };
}

export function getTileVisual(layout: BoardSettings["layout"], index: number) {
  if (layout === "cluster") {
    const rotations = [0, 0, 0, 0, 0, 0, 0, 0, -0.2, 0.18, 0, 0];
    return { rotation: rotations[index % rotations.length], zIndex: 10 + index };
  }

  return { rotation: 0, zIndex: 1 + index };
}

export function computePositions(images: BoardImage[], settings: BoardSettings, width: number, height: number, topSafeInset = 0) {
  const rendered = getRenderedImages(images, settings);
  const totalCount = rendered.length + (settings.includePalette ? 1 : 0);
  if (!totalCount) return [];

  const { gap, outer, topOuter, innerWidth, innerHeight } = getLayoutArea(settings, width, height, topSafeInset);
  const paletteIndex = getPaletteSlotIndex(rendered.length, settings);
  const aspects = Array.from({ length: totalCount }, (_, index) => {
    if (index === paletteIndex) return 1.35;
    const item = rendered[getImageSlotIndex(index, paletteIndex) % rendered.length];
    if (settings.layout === "cluster" || settings.layout === "custom") return item.width / item.height || 1;
    return getLayoutAspect(item.width / item.height, item.size);
  });

  if (settings.layout === "grid") {
    return addOuter(computeGridPositions(totalCount, innerWidth, innerHeight, gap), outer, topOuter);
  }

  if (settings.layout === "feature") {
    return addOuter(computeFeaturePositions(totalCount, innerWidth, innerHeight, gap), outer, topOuter);
  }

  if (settings.layout === "editorial") {
    return addOuter(computeEditorialPositions(totalCount, innerWidth, innerHeight, gap), outer, topOuter);
  }

  if (settings.layout === "cluster") {
    return addOuter(computeClusterPositions(aspects, innerWidth, innerHeight, gap, settings.clusterFlow), outer, topOuter);
  }

  if (settings.layout === "custom") {
    const customKeys = Array.from({ length: totalCount }, (_, index) => getCustomLayoutKey(index, rendered, paletteIndex));
    return addOuter(computeCustomPositions(aspects, customKeys, innerWidth, innerHeight, gap, settings.clusterFlow, settings.customLayout), outer, topOuter);
  }

  return addOuter(computeBalancedPositions(aspects, innerWidth, innerHeight, gap, settings.clusterFlow), outer, topOuter);
}

function addOuter(positions: Rect[], outerX: number, outerY: number) {
  return positions.map((pos) => ({ ...pos, x: pos.x + outerX, y: pos.y + outerY }));
}

function computeGridPositions(totalCount: number, width: number, height: number, gap: number) {
  const ratio = width / height;
  const columns = ratio >= 1 ? Math.ceil(Math.sqrt(totalCount * ratio)) : Math.max(1, Math.round(Math.sqrt(totalCount * ratio)));
  const rows = Math.ceil(totalCount / columns);
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;

  return Array.from({ length: totalCount }, (_, index) => ({
    x: (index % columns) * (cellWidth + gap),
    y: Math.floor(index / columns) * (cellHeight + gap),
    w: cellWidth,
    h: cellHeight,
  }));
}

function computeFeaturePositions(totalCount: number, width: number, height: number, gap: number) {
  if (totalCount === 1) return [{ x: 0, y: 0, w: width, h: height }];
  const sideCount = totalCount - 1;
  const ratio = width / height;

  if (ratio >= 1) {
    const featureWidth = width * 0.58;
    const sideWidth = width - featureWidth - gap;
    return [
      { x: 0, y: 0, w: featureWidth, h: height },
      ...computeGridPositions(sideCount, sideWidth, height, gap).map((pos) => ({ ...pos, x: pos.x + featureWidth + gap })),
    ];
  }

  const featureHeight = height * 0.56;
  return [
    { x: 0, y: 0, w: width, h: featureHeight },
    ...computeGridPositions(sideCount, width, height - featureHeight - gap, gap).map((pos) => ({ ...pos, y: pos.y + featureHeight + gap })),
  ];
}

function computeEditorialPositions(totalCount: number, width: number, height: number, gap: number) {
  if (totalCount <= 3) return computeFeaturePositions(totalCount, width, height, gap);
  const ratio = width / height;

  if (ratio >= 1) {
    const topHeight = height * 0.62;
    const featureWidth = width * 0.54;
    const sideWidth = width - featureWidth - gap;
    const sideHeight = (topHeight - gap) / 2;
    const top = [
      { x: 0, y: 0, w: featureWidth, h: topHeight },
      { x: featureWidth + gap, y: 0, w: sideWidth, h: sideHeight },
      { x: featureWidth + gap, y: sideHeight + gap, w: sideWidth, h: sideHeight },
    ];
    const remaining = totalCount - top.length;
    return remaining > 0
      ? [...top, ...computeGridPositions(remaining, width, height - topHeight - gap, gap).map((pos) => ({ ...pos, y: pos.y + topHeight + gap }))]
      : top;
  }

  const topHeight = height * 0.46;
  return [
    { x: 0, y: 0, w: width, h: topHeight },
    ...computeGridPositions(totalCount - 1, width, height - topHeight - gap, gap).map((pos) => ({ ...pos, y: pos.y + topHeight + gap })),
  ];
}

function computeClusterPositions(aspects: number[], width: number, height: number, gap: number, flow: BoardSettings["clusterFlow"]) {
  if (aspects.length <= 4) return computeSmallClusterPositions(aspects, width, height, gap, flow);
  if (flow === "columns") return computeClusterColumnPositions(aspects, width, height, gap);
  return computeClusterRowPositions(aspects, width, height, gap);
}

function computeSmallClusterPositions(aspects: number[], width: number, height: number, gap: number, flow: BoardSettings["clusterFlow"]) {
  const clusterGap = Math.max(0, getClusterGap(gap));
  const shortSide = Math.min(width, height);
  if (aspects.length === 1) {
    const rect = fitAspectInCell(aspects[0], width * 0.82, height * 0.82);
    return [{ ...rect, x: (width - rect.w) / 2, y: (height - rect.h) / 2 }];
  }

  if (aspects.length === 2) {
    const tile = Math.min((shortSide - clusterGap) / 2, shortSide * 0.44);
    if (flow === "columns") {
      return fitCells(aspects, [
        { x: width / 2 - tile - clusterGap / 2, y: (height - tile) / 2, w: tile, h: tile },
        { x: width / 2 + clusterGap / 2, y: (height - tile) / 2, w: tile, h: tile },
      ]);
    }

    return fitCells(aspects, [
      { x: (width - tile) / 2, y: height / 2 - tile - clusterGap / 2, w: tile, h: tile },
      { x: (width - tile) / 2, y: height / 2 + clusterGap / 2, w: tile, h: tile },
    ]);
  }

  if (aspects.length === 3) {
    const tile = Math.min((shortSide - clusterGap) / 2, shortSide * 0.38);
    const totalWidth = tile * 2 + clusterGap;
    const totalHeight = tile * 2 + clusterGap;
    if (flow === "columns") {
      return fitCells(aspects, [
        { x: (width - totalWidth) / 2, y: (height - tile) / 2, w: tile, h: tile },
        { x: (width - totalWidth) / 2 + tile + clusterGap, y: (height - totalHeight) / 2, w: tile, h: tile },
        { x: (width - totalWidth) / 2 + tile + clusterGap, y: (height - totalHeight) / 2 + tile + clusterGap, w: tile, h: tile },
      ]);
    }

    return fitCells(aspects, [
      { x: (width - tile) / 2, y: (height - totalHeight) / 2, w: tile, h: tile },
      { x: (width - totalWidth) / 2, y: (height - totalHeight) / 2 + tile + clusterGap, w: tile, h: tile },
      { x: (width - totalWidth) / 2 + tile + clusterGap, y: (height - totalHeight) / 2 + tile + clusterGap, w: tile, h: tile },
    ]);
  }

  const tile = Math.min((shortSide - clusterGap) / 2, shortSide * 0.4);
  const totalWidth = tile * 2 + clusterGap;
  const totalHeight = tile * 2 + clusterGap;
  return fitCells(aspects, [
    { x: (width - totalWidth) / 2, y: (height - totalHeight) / 2, w: tile, h: tile },
    { x: (width - totalWidth) / 2 + tile + clusterGap, y: (height - totalHeight) / 2, w: tile, h: tile },
    { x: (width - totalWidth) / 2, y: (height - totalHeight) / 2 + tile + clusterGap, w: tile, h: tile },
    { x: (width - totalWidth) / 2 + tile + clusterGap, y: (height - totalHeight) / 2 + tile + clusterGap, w: tile, h: tile },
  ]);
}

function fitCells(aspects: number[], cells: Rect[]) {
  return cells.map((cell, index) => {
    const rect = fitAspectInCell(aspects[index], cell.w, cell.h);
    return {
      x: cell.x + (cell.w - rect.w) / 2,
      y: cell.y + (cell.h - rect.h) / 2,
      w: rect.w,
      h: rect.h,
    };
  });
}

function fitAspectInCell(aspect: number, cellWidth: number, cellHeight: number) {
  const safeAspect = clamp(aspect || 1, 0.2, 5);
  const widthFromHeight = cellHeight * safeAspect;
  if (widthFromHeight <= cellWidth) return { w: widthFromHeight, h: cellHeight };
  return { w: cellWidth, h: cellWidth / safeAspect };
}

function computeClusterRowPositions(aspects: number[], width: number, height: number, gap: number) {
  const clusterGap = getClusterGap(gap);
  const preferredRows = getPreferredClusterRowCount(aspects.length, width, height);
  const minRows = Math.max(1, preferredRows - 1);
  const maxRows = Math.min(aspects.length, preferredRows + 1);
  let best: Rect[] = [];
  let bestScore = Infinity;

  for (let rowCount = minRows; rowCount <= maxRows; rowCount += 1) {
    const rows = buildOvalRows(aspects, rowCount, width, height, clusterGap);
    const positions = getOvalRowPositions(rows, width, height, clusterGap);
    const bounds = getBounds(positions);
    const fillWidth = bounds.w / width;
    const fillHeight = bounds.h / height;
    const lonelyRows = rows.filter((row) => row.length === 1).length;
    const clusterLooseness = getClusterLooseness(clusterGap);
    const targetFillWidth = lerp(0.96, 0.92, clusterLooseness);
    const targetFillHeight = lerp(0.92, 0.88, clusterLooseness);
    const score =
      Math.abs(fillWidth - targetFillWidth) * lerp(1.5, 1.2, clusterLooseness) +
      Math.abs(fillHeight - targetFillHeight) * 0.85 +
      Math.abs(rowCount - preferredRows) * 0.22 +
      getGroupSizeSpread(rows) * 0.5 +
      lonelyRows * 0.24 +
      getAreaSpread(positions) * 0.72;

    if (score < bestScore) {
      bestScore = score;
      best = positions;
    }
  }

  return best;
}

function computeClusterColumnPositions(aspects: number[], width: number, height: number, gap: number) {
  const clusterGap = getClusterGap(gap);
  const preferredColumns = getPreferredClusterColumnCount(aspects.length, width, height);
  const minColumns = Math.max(1, preferredColumns - 1);
  const maxColumns = Math.min(aspects.length, preferredColumns + 1);
  let best: Rect[] = [];
  let bestScore = Infinity;

  for (let columnCount = minColumns; columnCount <= maxColumns; columnCount += 1) {
    const columns = buildOvalColumns(aspects, columnCount, width, height, clusterGap);
    const positions = getOvalColumnPositions(columns, width, height, clusterGap);
    const bounds = getBounds(positions);
    const fillWidth = bounds.w / width;
    const fillHeight = bounds.h / height;
    const lonelyColumns = columns.filter((column) => column.length === 1).length;
    const clusterLooseness = getClusterLooseness(clusterGap);
    const targetFillWidth = lerp(0.92, 0.88, clusterLooseness);
    const targetFillHeight = lerp(0.96, 0.92, clusterLooseness);
    const score =
      Math.abs(fillWidth - targetFillWidth) * 0.85 +
      Math.abs(fillHeight - targetFillHeight) * lerp(1.5, 1.2, clusterLooseness) +
      Math.abs(columnCount - preferredColumns) * 0.22 +
      getGroupSizeSpread(columns) * 0.5 +
      lonelyColumns * 0.24 +
      getAreaSpread(positions) * 0.72;

    if (score < bestScore) {
      bestScore = score;
      best = positions;
    }
  }

  return best;
}

function getClusterGap(gap: number) {
  if (gap <= 0) return -1;
  return gap * 0.64;
}

function computeCustomPositions(
  aspects: number[],
  customKeys: string[],
  width: number,
  height: number,
  gap: number,
  flow: BoardSettings["clusterFlow"],
  customLayout: BoardSettings["customLayout"],
) {
  const fallback = computeClusterPositions(aspects, width, height, gap, flow);
  return fallback.map((rect, index) => {
    const saved = customLayout[customKeys[index]] ?? customLayout[String(index)];
    if (!saved) return rect;
    const aspect = clamp(aspects[index] || 1, 0.2, 5);
    const minShortSide = Math.max(44, Math.min(width, height) * 0.08);
    const minWidth = aspect >= 1 ? minShortSide * aspect : minShortSide;
    const maxWidth = Math.min(width, height * aspect);
    const w = clamp(saved.w * width, minWidth, maxWidth);
    const h = w / aspect;
    return {
      x: clamp(saved.x * width, 0, Math.max(0, width - w)),
      y: clamp(saved.y * height, 0, Math.max(0, height - h)),
      w,
      h,
    };
  });
}

function buildOvalRows(aspects: number[], rowCount: number, width: number, height: number, gap: number) {
  const rowWidths = Array.from({ length: rowCount }, (_, row) => width * getClusterBandFactor(row, rowCount, gap));
  const targetRowHeight = Math.max(64, (height * 0.74 - gap * (rowCount - 1)) / rowCount);
  const rows: Cell[][] = [];
  let index = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const remainingRows = rowCount - row;
    const targetAspectSum = rowWidths[row] / targetRowHeight;
    const remainingItems = aspects.length - index;
    const take = getBalancedTakeCount(aspects, index, remainingItems, remainingRows, targetAspectSum, false);
    rows.push(aspects.slice(index, index + take).map((aspect, offset) => ({ index: index + offset, aspect })));
    index += take;
  }

  if (index < aspects.length) rows[rows.length - 1].push(...aspects.slice(index).map((aspect, offset) => ({ index: index + offset, aspect })));
  return rows.filter((row) => row.length);
}

function getOvalRowPositions(rows: Cell[][], width: number, height: number, gap: number) {
  const rowMeasurements = rows.map((row, rowIndex) => {
    const rowWidth = width * getClusterBandFactor(rowIndex, rows.length, gap);
    const rowHeight = (rowWidth - gap * (row.length - 1)) / row.reduce((total, item) => total + item.aspect, 0);
    return { row, rowHeight, rowWidth };
  });
  const contentHeight = rowMeasurements.reduce((sum, row, index) => sum + row.rowHeight + (index ? gap : 0), 0);
  const scale = Math.min(
    1.08,
    (height * 0.96) / contentHeight,
    width / Math.max(...rowMeasurements.map((row) => row.rowWidth)),
  );
  const positions: Rect[] = [];
  let y = (height - contentHeight * scale) / 2;

  rowMeasurements.forEach(({ row, rowHeight, rowWidth }) => {
    const scaledHeight = rowHeight * scale;
    const scaledWidth = rowWidth * scale;
    let x = (width - scaledWidth) / 2;

    row.forEach((item) => {
      const itemWidth = scaledHeight * item.aspect;
      positions[item.index] = { x, y, w: itemWidth, h: scaledHeight };
      x += itemWidth + gap * scale;
    });
    y += scaledHeight + gap * scale;
  });

  return positions;
}

function buildOvalColumns(aspects: number[], columnCount: number, width: number, height: number, gap: number) {
  const columnHeights = Array.from({ length: columnCount }, (_, column) => height * getClusterBandFactor(column, columnCount, gap));
  const targetColumnWidth = Math.max(64, (width * 0.74 - gap * (columnCount - 1)) / columnCount);
  const columns: Cell[][] = [];
  let index = 0;

  for (let column = 0; column < columnCount; column += 1) {
    const remainingColumns = columnCount - column;
    const targetInverseSum = columnHeights[column] / targetColumnWidth;
    const remainingItems = aspects.length - index;
    const take = getBalancedTakeCount(aspects, index, remainingItems, remainingColumns, targetInverseSum, true);
    columns.push(aspects.slice(index, index + take).map((aspect, offset) => ({ index: index + offset, aspect })));
    index += take;
  }

  if (index < aspects.length) columns[columns.length - 1].push(...aspects.slice(index).map((aspect, offset) => ({ index: index + offset, aspect })));
  return columns.filter((column) => column.length);
}

function getOvalColumnPositions(columns: Cell[][], width: number, height: number, gap: number) {
  const columnMeasurements = columns.map((column, columnIndex) => {
    const columnHeight = height * getClusterBandFactor(columnIndex, columns.length, gap);
    const columnWidth = (columnHeight - gap * (column.length - 1)) / column.reduce((total, item) => total + 1 / item.aspect, 0);
    return { column, columnHeight, columnWidth };
  });
  const contentWidth = columnMeasurements.reduce((sum, column, index) => sum + column.columnWidth + (index ? gap : 0), 0);
  const scale = Math.min(
    1.08,
    (width * 0.96) / contentWidth,
    height / Math.max(...columnMeasurements.map((column) => column.columnHeight)),
  );
  const positions: Rect[] = [];
  let x = (width - contentWidth * scale) / 2;

  columnMeasurements.forEach(({ column, columnHeight, columnWidth }) => {
    const scaledWidth = columnWidth * scale;
    const scaledHeight = columnHeight * scale;
    let y = (height - scaledHeight) / 2;

    column.forEach((item) => {
      const itemHeight = scaledWidth / item.aspect;
      positions[item.index] = { x, y, w: scaledWidth, h: itemHeight };
      y += itemHeight + gap * scale;
    });
    x += scaledWidth + gap * scale;
  });

  return positions;
}

function getClusterBandFactor(index: number, count: number, gap: number) {
  if (count === 1) return 0.68;
  const t = (index + 0.5) / count;
  return lerp(0.82 + Math.sin(Math.PI * t) * 0.17, 0.68 + Math.sin(Math.PI * t) * 0.3, getClusterLooseness(gap));
}

function getClusterLooseness(gap: number) {
  if (gap < 0) return 0;
  return clamp(gap / 18, 0, 1);
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function computeBalancedPositions(aspects: number[], width: number, height: number, gap: number, flow: BoardSettings["clusterFlow"]) {
  const settings = {
    minRows: 0.9,
    maxRows: 2.15,
    varianceWeight: 1.15,
    spreadWeight: 1.1,
    lonelyWeight: 0.58,
    fillWeight: 1.28,
    areaWeight: 1.35,
    areaSpreadWeight: 0.95,
    scaleCap: 1.1,
    targetFill: 1,
  };
  const forcedRows = flow === "rows" ? getPreferredRowCount(aspects.length, width, height) : undefined;
  const forcedColumns = flow === "columns" ? getPreferredColumnCount(aspects.length, width, height) : undefined;
  const rowCandidate = findBestRowLayout(aspects, width, height, gap, settings, forcedRows);
  const columnCandidate = findBestColumnLayout(aspects, width, height, gap, settings, forcedColumns);
  if (flow === "rows") return rowCandidate.positions;
  if (flow === "columns") return columnCandidate.positions;
  const ratio = width / height;
  return rowCandidate.score + (ratio >= 1 ? 0 : 0.22) <= columnCandidate.score + (ratio < 1 ? 0 : 0.22)
    ? rowCandidate.positions
    : columnCandidate.positions;
}

function getLayoutAspect(aspect: number, size: BoardImage["size"]) {
  if (size === "feature") return clamp(aspect * 1.55, 0.55, 3.2);
  if (size === "small") return clamp(aspect * 0.72, 0.42, 2.2);
  return clamp(aspect || 1, 0.58, 2.15);
}

function getPreferredRowCount(count: number, width: number, height: number) {
  return clamp(Math.round(Math.sqrt(count / Math.max(0.35, width / height))), 1, count);
}

function getPreferredColumnCount(count: number, width: number, height: number) {
  return clamp(Math.round(Math.sqrt(count * (width / height))), 1, count);
}

function getPreferredClusterRowCount(count: number, width: number, height: number) {
  return Math.max(Math.ceil(Math.sqrt(count)), getPreferredRowCount(count, width, height));
}

function getPreferredClusterColumnCount(count: number, width: number, height: number) {
  return Math.max(Math.ceil(Math.sqrt(count)), getPreferredColumnCount(count, width, height));
}

function findBestRowLayout(aspects: number[], width: number, height: number, gap: number, settings: Record<string, number>, minRowsOverride?: number) {
  const minRows = minRowsOverride ? clamp(Math.round(minRowsOverride), 1, aspects.length) : Math.max(1, Math.floor(Math.sqrt(aspects.length) * settings.minRows));
  const maxRows = minRowsOverride ? minRows : Math.min(aspects.length, Math.max(minRows, Math.ceil(Math.sqrt(aspects.length) * settings.maxRows)));
  let best: Rect[] = [];
  let bestScore = Infinity;

  for (let rowCount = minRows; rowCount <= maxRows; rowCount += 1) {
    const rows = buildRows(aspects, rowCount, width, height, gap);
    const contentHeight = getRowsHeight(rows, width, gap);
    const positions = getRowPositions(rows, width, height, gap, settings);
    const score =
      Math.abs(contentHeight - height) / height +
      getRowVariance(rows, width, gap) * settings.varianceWeight +
      getHeightSpread(rows, width, gap) * settings.spreadWeight +
      getGroupSizeSpread(rows) * 0.72 +
      rows.filter((row) => row.length === 1).length * settings.lonelyWeight +
      Math.abs(settings.targetFill - Math.min(1, getBounds(positions).h / height)) * settings.fillWeight +
      getAreaVariance(positions) * settings.areaWeight +
      getAreaSpread(positions) * settings.areaSpreadWeight;

    if (score < bestScore) {
      bestScore = score;
      best = positions;
    }
  }

  return { score: bestScore, positions: best };
}

function findBestColumnLayout(aspects: number[], width: number, height: number, gap: number, settings: Record<string, number>, minColumnsOverride?: number) {
  const minColumns = minColumnsOverride ? clamp(Math.round(minColumnsOverride), 1, aspects.length) : Math.max(1, Math.floor(Math.sqrt(aspects.length) * settings.minRows));
  const maxColumns = minColumnsOverride ? minColumns : Math.min(aspects.length, Math.max(minColumns, Math.ceil(Math.sqrt(aspects.length) * settings.maxRows)));
  let best: Rect[] = [];
  let bestScore = Infinity;

  for (let columnCount = minColumns; columnCount <= maxColumns; columnCount += 1) {
    const columns = buildColumns(aspects, columnCount, width, height, gap);
    const contentWidth = getColumnsWidth(columns, height, gap);
    const positions = getColumnPositions(columns, width, height, gap, settings);
    const score =
      Math.abs(contentWidth - width) / width +
      getColumnVariance(columns, height, gap) * settings.varianceWeight +
      getWidthSpread(columns, height, gap) * settings.spreadWeight +
      getGroupSizeSpread(columns) * 0.72 +
      columns.filter((column) => column.length === 1).length * settings.lonelyWeight +
      Math.abs(settings.targetFill - Math.min(1, getBounds(positions).w / width)) * settings.fillWeight +
      getAreaVariance(positions) * settings.areaWeight +
      getAreaSpread(positions) * settings.areaSpreadWeight;

    if (score < bestScore) {
      bestScore = score;
      best = positions;
    }
  }

  return { score: bestScore, positions: best };
}

type Cell = { index: number; aspect: number };

function buildRows(aspects: number[], rowCount: number, width: number, height: number, gap: number) {
  const targetRowHeight = Math.max(80, (height - gap * (rowCount - 1)) / rowCount);
  const targetAspectSum = width / targetRowHeight;
  const rows: Cell[][] = [];
  let index = 0;

  for (let row = 0; row < rowCount; row += 1) {
    const remainingRows = rowCount - row;
    const remainingItems = aspects.length - index;
    const take = getBalancedTakeCount(aspects, index, remainingItems, remainingRows, targetAspectSum, false);
    rows.push(aspects.slice(index, index + take).map((aspect, offset) => ({ index: index + offset, aspect })));
    index += take;
  }

  if (index < aspects.length) rows[rows.length - 1].push(...aspects.slice(index).map((aspect, offset) => ({ index: index + offset, aspect })));
  return rows.filter((row) => row.length);
}

function buildColumns(aspects: number[], columnCount: number, width: number, height: number, gap: number) {
  const targetColumnWidth = Math.max(80, (width - gap * (columnCount - 1)) / columnCount);
  const targetInverseSum = height / targetColumnWidth;
  const columns: Cell[][] = [];
  let index = 0;

  for (let column = 0; column < columnCount; column += 1) {
    const remainingColumns = columnCount - column;
    const remainingItems = aspects.length - index;
    const take = getBalancedTakeCount(aspects, index, remainingItems, remainingColumns, targetInverseSum, true);
    columns.push(aspects.slice(index, index + take).map((aspect, offset) => ({ index: index + offset, aspect })));
    index += take;
  }

  if (index < aspects.length) columns[columns.length - 1].push(...aspects.slice(index).map((aspect, offset) => ({ index: index + offset, aspect })));
  return columns.filter((column) => column.length);
}

function getBalancedTakeCount(aspects: number[], start: number, remainingItems: number, remainingGroups: number, targetSum: number, inverse: boolean) {
  if (remainingGroups <= 1) return remainingItems;
  const averageCount = remainingItems / remainingGroups;
  const minTake = Math.max(1, Math.floor(averageCount));
  const maxTake = Math.min(remainingItems - (remainingGroups - 1), Math.ceil(averageCount));
  let bestTake = minTake;
  let bestScore = Infinity;
  let runningSum = 0;

  for (let take = 1; take <= maxTake; take += 1) {
    const aspect = aspects[start + take - 1];
    runningSum += inverse ? 1 / aspect : aspect;
    if (take < minTake) continue;
    const countScore = Math.abs(take - averageCount) * 0.9;
    const shapeScore = Math.abs(runningSum - targetSum) / Math.max(0.01, targetSum);
    const score = countScore + shapeScore;
    if (score < bestScore) {
      bestScore = score;
      bestTake = take;
    }
  }

  return bestTake;
}

function getRowsHeight(rows: Cell[][], width: number, gap: number) {
  return rows.reduce((sum, row, rowIndex) => sum + (width - gap * (row.length - 1)) / row.reduce((total, item) => total + item.aspect, 0) + (rowIndex ? gap : 0), 0);
}

function getColumnsWidth(columns: Cell[][], height: number, gap: number) {
  return columns.reduce((sum, column, columnIndex) => sum + (height - gap * (column.length - 1)) / column.reduce((total, item) => total + 1 / item.aspect, 0) + (columnIndex ? gap : 0), 0);
}

function getRowVariance(rows: Cell[][], width: number, gap: number) {
  const heights = rows.map((row) => (width - gap * (row.length - 1)) / row.reduce((total, item) => total + item.aspect, 0));
  return averageDeviation(heights);
}

function getColumnVariance(columns: Cell[][], height: number, gap: number) {
  const widths = columns.map((column) => (height - gap * (column.length - 1)) / column.reduce((total, item) => total + 1 / item.aspect, 0));
  return averageDeviation(widths);
}

function getHeightSpread(rows: Cell[][], width: number, gap: number) {
  return spread(rows.map((row) => (width - gap * (row.length - 1)) / row.reduce((total, item) => total + item.aspect, 0)));
}

function getWidthSpread(columns: Cell[][], height: number, gap: number) {
  return spread(columns.map((column) => (height - gap * (column.length - 1)) / column.reduce((total, item) => total + 1 / item.aspect, 0)));
}

function getRowPositions(rows: Cell[][], width: number, height: number, gap: number, settings: Record<string, number>) {
  const positions: Rect[] = [];
  const contentHeight = getRowsHeight(rows, width, gap);
  const scale = Math.min(1, settings.scaleCap, height / contentHeight);
  const scaledWidth = width * scale;
  const xOffset = (width - scaledWidth) / 2;
  let y = Math.max(0, (height - contentHeight * scale) / 2);

  rows.forEach((row) => {
    const rowWidth = width - gap * (row.length - 1);
    const rowHeight = (rowWidth / row.reduce((total, item) => total + item.aspect, 0)) * scale;
    let x = xOffset;
    row.forEach((item) => {
      const itemWidth = rowHeight * item.aspect;
      positions[item.index] = { x, y, w: itemWidth, h: rowHeight };
      x += itemWidth + gap * scale;
    });
    y += rowHeight + gap * scale;
  });

  return positions;
}

function getColumnPositions(columns: Cell[][], width: number, height: number, gap: number, settings: Record<string, number>) {
  const positions: Rect[] = [];
  const contentWidth = getColumnsWidth(columns, height, gap);
  const scale = Math.min(1, settings.scaleCap, width / contentWidth);
  const scaledHeight = height * scale;
  const yOffset = (height - scaledHeight) / 2;
  let x = Math.max(0, (width - contentWidth * scale) / 2);

  columns.forEach((column) => {
    const columnHeight = height - gap * (column.length - 1);
    const columnWidth = (columnHeight / column.reduce((total, item) => total + 1 / item.aspect, 0)) * scale;
    let y = yOffset;
    column.forEach((item) => {
      const itemHeight = columnWidth / item.aspect;
      positions[item.index] = { x, y, w: columnWidth, h: itemHeight };
      y += itemHeight + gap * scale;
    });
    x += columnWidth + gap * scale;
  });

  return positions;
}

function averageDeviation(values: number[]) {
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + Math.abs(value - average) / average, 0) / values.length;
}

function spread(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min > 0 ? max / min - 1 : 0;
}

function getAreaVariance(positions: Rect[]) {
  return averageDeviation(positions.filter(Boolean).map((pos) => pos.w * pos.h));
}

function getAreaSpread(positions: Rect[]) {
  return spread(positions.filter(Boolean).map((pos) => pos.w * pos.h));
}

function getGroupSizeSpread(groups: Cell[][]) {
  return spread(groups.map((group) => group.length));
}

function getBounds(positions: Rect[]) {
  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + position.w));
  const maxY = Math.max(...positions.map((position) => position.y + position.h));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makeEven(value: number) {
  return Math.round(value / 2) * 2;
}
