import type { MutableRefObject, RefObject } from "react";
import { hasImageFiles } from "../lib/preview";
import type { BoardImage } from "../lib/types";
import { CloseIcon } from "./icons";

type ImageRailProps = {
  images: BoardImage[];
  railMessage: string;
  fileInputRef: RefObject<HTMLInputElement>;
  railDragDepthRef: MutableRefObject<number>;
  isDraggingFiles: boolean;
  setIsDraggingFiles: (dragging: boolean) => void;
  addFiles: (fileList: FileList | File[]) => void | Promise<void>;
  clearImages: () => void;
  removeImage: (index: number) => void;
};

export function ImageRail({
  images,
  railMessage,
  fileInputRef,
  railDragDepthRef,
  isDraggingFiles,
  setIsDraggingFiles,
  addFiles,
  clearImages,
  removeImage,
}: ImageRailProps) {
  return (
    <aside
      className={isDraggingFiles ? "image-rail dragging-files" : "image-rail"}
      aria-label="Images"
      onDragEnter={(event) => {
        if (!hasImageFiles(event.dataTransfer)) return;
        event.preventDefault();
        railDragDepthRef.current += 1;
        setIsDraggingFiles(true);
      }}
      onDragOver={(event) => {
        if (!hasImageFiles(event.dataTransfer)) return;
        event.preventDefault();
      }}
      onDragLeave={() => {
        railDragDepthRef.current = Math.max(0, railDragDepthRef.current - 1);
        if (railDragDepthRef.current === 0) setIsDraggingFiles(false);
      }}
      onDrop={(event) => {
        if (!hasImageFiles(event.dataTransfer)) return;
        event.preventDefault();
        railDragDepthRef.current = 0;
        setIsDraggingFiles(false);
        void addFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        className="file-input-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      <section className="rail-section">
        <div className="section-title">
          <h2>Images</h2>
          <div className="section-actions">
            <span>{images.length}/20</span>
            <button className="text-button" type="button" onClick={() => fileInputRef.current?.click()}>
              Add
            </button>
            {images.length ? (
              <button className="text-button" type="button" onClick={clearImages}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
        {railMessage ? <p className="message">{railMessage}</p> : null}
        <div className="source-list">
          {images.length ? (
            images.map((item, index) => (
              <div className="source-item" key={item.id}>
                <img src={item.url} alt={item.name} />
                <span>{index + 1}</span>
                <button className="source-remove-button" type="button" title="Remove image" aria-label={`Remove ${item.name}`} onClick={() => removeImage(index)}>
                  <CloseIcon />
                </button>
              </div>
            ))
          ) : (
            <p className="empty-note">Your images stay in the browser.</p>
          )}
        </div>
      </section>
    </aside>
  );
}
