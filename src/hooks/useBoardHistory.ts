import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BoardImage, BoardSettings } from "../lib/types";

export type BoardSnapshot = { images: BoardImage[]; palette: string[]; settings: BoardSettings };

type UseBoardHistoryArgs = {
  images: BoardImage[];
  palette: string[];
  settings: BoardSettings;
  selectedImageIds: string[];
  setImages: Dispatch<SetStateAction<BoardImage[]>>;
  setPalette: Dispatch<SetStateAction<string[]>>;
  setSettings: Dispatch<SetStateAction<BoardSettings>>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setSelectedImageIds: Dispatch<SetStateAction<string[]>>;
  setCropModalImageId: Dispatch<SetStateAction<string | null>>;
  setMessage: Dispatch<SetStateAction<string>>;
  historyLimit?: number;
};

const defaultHistoryLimit = 80;

export function useBoardHistory({
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
  historyLimit = defaultHistoryLimit,
}: UseBoardHistoryArgs) {
  const [undoStack, setUndoStack] = useState<BoardSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<BoardSnapshot[]>([]);

  const getSnapshot = useCallback((): BoardSnapshot => cloneSnapshot({ images, palette, settings }), [images, palette, settings]);

  const restoreSnapshot = useCallback(
    (snapshot: BoardSnapshot) => {
      const next = cloneSnapshot(snapshot);
      setImages(next.images);
      setPalette(next.palette);
      setSettings(next.settings);
      const validSelection = selectedImageIds.filter((id) => next.images.some((image) => image.id === id));
      const nextSelectedIds = validSelection.length ? validSelection : next.images[0]?.id ? [next.images[0].id] : [];
      setSelectedImageIds(nextSelectedIds);
      setSelectedImageId(nextSelectedIds[nextSelectedIds.length - 1] ?? null);
      setCropModalImageId((cropping) => (cropping && next.images.some((image) => image.id === cropping) ? cropping : null));
    },
    [selectedImageIds, setCropModalImageId, setImages, setPalette, setSelectedImageId, setSelectedImageIds, setSettings],
  );

  const pushUndo = useCallback(
    (snapshot: BoardSnapshot = getSnapshot()) => {
      setUndoStack((current) => [...current, cloneSnapshot(snapshot)].slice(-historyLimit));
      setRedoStack([]);
    },
    [getSnapshot, historyLimit],
  );

  const commitBoard = useCallback(
    (snapshot: BoardSnapshot, nextMessage?: string) => {
      pushUndo();
      restoreSnapshot(snapshot);
      if (nextMessage !== undefined) setMessage(nextMessage);
    },
    [pushUndo, restoreSnapshot, setMessage],
  );

  const undoBoard = useCallback(() => {
    setUndoStack((current) => {
      const previous = current[current.length - 1];
      if (!previous) return current;
      setRedoStack((redo) => [...redo, getSnapshot()].slice(-historyLimit));
      restoreSnapshot(previous);
      setMessage("Undid last change.");
      return current.slice(0, -1);
    });
  }, [getSnapshot, historyLimit, restoreSnapshot, setMessage]);

  const redoBoard = useCallback(() => {
    setRedoStack((current) => {
      const next = current[current.length - 1];
      if (!next) return current;
      setUndoStack((undo) => [...undo, getSnapshot()].slice(-historyLimit));
      restoreSnapshot(next);
      setMessage("Redid last change.");
      return current.slice(0, -1);
    });
  }, [getSnapshot, historyLimit, restoreSnapshot, setMessage]);

  return {
    undoStack,
    redoStack,
    pushUndo,
    commitBoard,
    undoBoard,
    redoBoard,
  };
}

function cloneSettings(settingsValue: BoardSettings): BoardSettings {
  return { ...settingsValue, customLayout: { ...settingsValue.customLayout }, customLayerOrder: [...settingsValue.customLayerOrder] };
}

function cloneImages(imageList: BoardImage[]) {
  return imageList.map((image) => ({ ...image }));
}

function cloneSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return {
    images: cloneImages(snapshot.images),
    palette: [...snapshot.palette],
    settings: cloneSettings(snapshot.settings),
  };
}
