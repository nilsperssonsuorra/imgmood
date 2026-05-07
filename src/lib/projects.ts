import { initialSettings } from "./storage";
import type { BoardImage, BoardSettings, LayoutMode } from "./types";

export type SavedProjectImage = Omit<BoardImage, "image">;
export type SavedProject = {
  version: 1;
  id: string;
  name: string;
  updatedAt: number;
  images: SavedProjectImage[];
  palette: string[];
  settings: BoardSettings;
};
export type SavedProjectMeta = Pick<SavedProject, "id" | "name" | "updatedAt"> & { imageCount: number };

const projectDbName = "imgmood-projects";
const legacyProjectDbName = "imgboard-projects";

function openProjectDb(name = projectDbName): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listSavedProjects(): Promise<SavedProjectMeta[]> {
  const db = await openProjectDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
    request.onsuccess = () => {
      const projects = (request.result as SavedProject[])
        .map((project) => ({ id: project.id, name: project.name, updatedAt: project.updatedAt, imageCount: project.images.length }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      db.close();
      if (projects.length) {
        resolve(projects);
        return;
      }
      void listLegacySavedProjects().then(resolve, reject);
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function listLegacySavedProjects(): Promise<SavedProjectMeta[]> {
  const db = await openProjectDb(legacyProjectDbName);
  return new Promise((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
    request.onsuccess = () => {
      const projects = (request.result as SavedProject[])
        .map((project) => ({ id: project.id, name: project.name, updatedAt: project.updatedAt, imageCount: project.images.length }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(projects);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

export async function getSavedProject(id: string): Promise<SavedProject | null> {
  const db = await openProjectDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").get(id);
    request.onsuccess = () => {
      db.close();
      const project = (request.result as SavedProject | undefined) ?? null;
      if (project) {
        resolve(project);
        return;
      }
      void getLegacySavedProject(id).then(resolve, reject);
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function getLegacySavedProject(id: string): Promise<SavedProject | null> {
  const db = await openProjectDb(legacyProjectDbName);
  return new Promise((resolve, reject) => {
    const request = db.transaction("projects", "readonly").objectStore("projects").get(id);
    request.onsuccess = () => {
      resolve((request.result as SavedProject | undefined) ?? null);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

export async function putSavedProject(project: SavedProject) {
  const db = await openProjectDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("projects", "readwrite").objectStore("projects").put(project);
    request.onsuccess = () => {
      resolve();
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

export async function deleteSavedProject(id: string) {
  const db = await openProjectDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("projects", "readwrite").objectStore("projects").delete(id);
    request.onsuccess = () => {
      db.close();
      void deleteLegacySavedProject(id).finally(resolve);
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

async function deleteLegacySavedProject(id: string) {
  const db = await openProjectDb(legacyProjectDbName);
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("projects", "readwrite").objectStore("projects").delete(id);
    request.onsuccess = () => {
      resolve();
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

export function normalizeProjectSettings(settings: BoardSettings) {
  const validLayouts: LayoutMode[] = ["balanced", "grid", "editorial", "feature", "cluster", "custom"];
  const layout = validLayouts.includes(settings.layout) ? settings.layout : initialSettings.layout;
  return {
    ...initialSettings,
    ...settings,
    layout,
    customLayout: settings.customLayout ?? {},
    customLayerOrder: settings.customLayerOrder ?? [],
  };
}

export function loadProjectImage(saved: SavedProjectImage): Promise<BoardImage> {
  return new Promise((resolve, reject) => {
    if (!saved.url || typeof saved.url !== "string") {
      reject(new Error("Missing image data."));
      return;
    }

    const image = new Image();
    image.onload = () => {
      resolve({
        ...saved,
        id: saved.id || `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: saved.name || "Imported image",
        image,
        width: image.width || saved.width || 1,
        height: image.height || saved.height || 1,
        size: saved.size || "normal",
        cropX: Number.isFinite(saved.cropX) ? saved.cropX : 50,
        cropY: Number.isFinite(saved.cropY) ? saved.cropY : 50,
      });
    };
    image.onerror = reject;
    image.src = saved.url;
  });
}

export function getProjectName(settings: BoardSettings, fallback?: string) {
  const rawName = settings.filename || settings.header || fallback || "Untitled board";
  return rawName.trim() || "Untitled board";
}

export function createProjectId() {
  return window.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
