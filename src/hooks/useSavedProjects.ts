import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { BoardSnapshot } from "./useBoardHistory";
import { defaultPalette } from "../lib/palette";
import {
  createProjectId,
  deleteSavedProject,
  getProjectName,
  getSavedProject,
  listSavedProjects,
  loadProjectImage,
  normalizeProjectSettings,
  putSavedProject,
} from "../lib/projects";
import type { SavedProject } from "../lib/projects";
import type { BoardImage, BoardSettings } from "../lib/types";

type UseSavedProjectsArgs = {
  images: BoardImage[];
  palette: string[];
  settings: BoardSettings;
  commitBoard: (snapshot: BoardSnapshot, nextMessage?: string) => void;
  setMessage: Dispatch<SetStateAction<string>>;
};

export function useSavedProjects({ images, palette, settings, commitBoard, setMessage }: UseSavedProjectsArgs) {
  const [savedProjects, setSavedProjects] = useState<Array<{ id: string; name: string; updatedAt: number; imageCount: number }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const autoSaveTimeoutRef = useRef<number | null>(null);

  const activeProjectName = useMemo(() => savedProjects.find((project) => project.id === activeProjectId)?.name, [activeProjectId, savedProjects]);

  const createProject = useCallback(
    (name: string, id = activeProjectId || createProjectId(), snapshot: BoardSnapshot = { images, palette, settings }): SavedProject => ({
      version: 1,
      id,
      name,
      updatedAt: Date.now(),
      images: snapshot.images.map(({ image: _image, ...rest }) => rest),
      palette: snapshot.palette,
      settings: snapshot.settings,
    }),
    [activeProjectId, images, palette, settings],
  );

  const refreshSavedProjects = useCallback(async () => {
    try {
      const projects = await listSavedProjects();
      setSavedProjects(projects);
      setSelectedProjectId((current) => (current && projects.some((project) => project.id === current) ? current : projects[0]?.id ?? ""));
    } catch {
      setMessage("Saved projects could not be read.");
    }
  }, [setMessage]);

  useEffect(() => {
    void refreshSavedProjects();
  }, [refreshSavedProjects]);

  useEffect(() => {
    if (!activeProjectId || !images.length) return;
    if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      const project = createProject(getProjectName(settings, activeProjectName), activeProjectId);
      void putSavedProject(project)
        .then(refreshSavedProjects)
        .then(() => setSelectedProjectId(project.id))
        .catch(() => setMessage("Project could not be auto-saved."));
      autoSaveTimeoutRef.current = null;
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current !== null) window.clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [activeProjectId, activeProjectName, createProject, images.length, refreshSavedProjects, setMessage, settings]);

  const saveProject = useCallback(async () => {
    if (!images.length) return;
    const projectName = getProjectName(settings, savedProjects.find((project) => project.id === activeProjectId)?.name);
    try {
      const project = createProject(projectName);
      await putSavedProject(project);
      setActiveProjectId(project.id);
      await refreshSavedProjects();
      setSelectedProjectId(project.id);
      setMessage(`Saved "${project.name}".`);
    } catch {
      setMessage("Project could not be saved.");
    }
  }, [activeProjectId, createProject, images.length, refreshSavedProjects, savedProjects, setMessage, settings]);

  const applySavedProject = useCallback(
    async (project: SavedProject) => {
      try {
        const nextImages = await Promise.all(project.images.slice(0, 20).map(loadProjectImage));
        const nextSettings = normalizeProjectSettings(project.settings);
        commitBoard(
          {
            images: nextImages,
            palette: project.palette.length ? project.palette : defaultPalette,
            settings: {
              ...nextSettings,
              count: nextImages.length > 1 ? Math.min(Math.max(nextSettings.count, 1), nextImages.length) : nextImages.length ? 6 : 9,
            },
          },
          `Loaded "${project.name}".`,
        );
        setActiveProjectId(project.id);
        setSelectedProjectId(project.id);
      } catch {
        setMessage("Project could not be loaded.");
      }
    },
    [commitBoard, setMessage],
  );

  const loadProjectById = useCallback(
    async (projectId: string) => {
      if (!projectId) return;
      setSelectedProjectId(projectId);
      try {
        const project = await getSavedProject(projectId);
        if (!project) throw new Error("Missing project.");
        setMessage("Loading project...");
        await applySavedProject(project);
      } catch {
        setMessage("Project could not be loaded.");
      }
    },
    [applySavedProject, setMessage],
  );

  const deleteSelectedProject = useCallback(async () => {
    if (!selectedProjectId) return;
    const deletedId = selectedProjectId;
    try {
      await deleteSavedProject(deletedId);
      if (activeProjectId === deletedId) setActiveProjectId("");
      await refreshSavedProjects();
      setMessage("Project deleted.");
    } catch {
      setMessage("Project could not be deleted.");
    }
  }, [activeProjectId, refreshSavedProjects, selectedProjectId, setMessage]);

  const saveActiveProjectSettings = useCallback(
    async (nextSettings: BoardSettings) => {
      if (!activeProjectId || !images.length) return;
      try {
        const project = createProject(getProjectName(nextSettings, activeProjectName), activeProjectId, { images, palette, settings: nextSettings });
        await putSavedProject(project);
        await refreshSavedProjects();
        setSelectedProjectId(project.id);
      } catch {
        setMessage("Board was renamed, but the saved project name could not be updated.");
      }
    },
    [activeProjectId, activeProjectName, createProject, images, palette, refreshSavedProjects, setMessage],
  );

  const clearActiveProject = useCallback(() => {
    if (autoSaveTimeoutRef.current !== null) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    setActiveProjectId("");
  }, []);

  return {
    savedProjects,
    selectedProjectId,
    activeProjectId,
    activeProjectName,
    saveProject,
    loadProjectById,
    deleteSelectedProject,
    saveActiveProjectSettings,
    clearActiveProject,
  };
}
