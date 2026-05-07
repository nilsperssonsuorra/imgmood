import type { BoardImage } from "./types";

const maxFiles = 20;
const maxFileSize = 20 * 1024 * 1024;

export async function loadImageFiles(files: File[]): Promise<{ images: BoardImage[]; message: string }> {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) return { images: [], message: "No supported image files found." };
  if (imageFiles.some((file) => file.size > maxFileSize)) {
    return { images: [], message: "Choose images under 20MB each." };
  }

  const images = await Promise.all(imageFiles.slice(0, maxFiles).map(loadImageFile));
  const message = imageFiles.length > maxFiles ? "Loaded the first 20 images." : "";
  return { images, message };
}

function loadImageFile(file: File): Promise<BoardImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        resolve({
          id: createId(),
          name: file.name,
          url: String(reader.result),
          image,
          width: image.width,
          height: image.height,
          size: "normal",
          cropX: 50,
          cropY: 50,
        });
      };
      image.onerror = reject;
      image.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createId() {
  return window.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
