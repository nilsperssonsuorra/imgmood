import type { CSSProperties, PointerEvent } from "react";
import type { BoardImage } from "../lib/types";
import { CloseIcon } from "./icons";

type CropFrame = { left: number; top: number; width: number; height: number };

type CropModalProps = {
  image: BoardImage;
  cropFrame: CropFrame | null;
  onClose: () => void;
  onReset: () => void;
  onStartCropDrag: (event: PointerEvent<HTMLDivElement>, image: BoardImage) => void;
  onMoveCropDrag: (event: PointerEvent<HTMLDivElement>) => void;
  onStopCropDrag: (event: PointerEvent<HTMLDivElement>) => void;
};

export function CropModal({ image, cropFrame, onClose, onReset, onStartCropDrag, onMoveCropDrag, onStopCropDrag }: CropModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Crop image" onMouseDown={(event) => event.stopPropagation()}>
        <div className="crop-modal-header">
          <div>
            <h2>Crop image</h2>
            <p>{image.name}</p>
          </div>
          <button className="modal-close-button" type="button" aria-label="Close crop editor" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="crop-modal-stage" style={{ "--image-aspect": image.width / image.height } as CSSProperties}>
          <img src={image.url} alt={image.name} draggable={false} />
          {cropFrame ? (
            <div
              className="crop-frame"
              style={{
                left: `${cropFrame.left}%`,
                top: `${cropFrame.top}%`,
                width: `${cropFrame.width}%`,
                height: `${cropFrame.height}%`,
              }}
              onPointerDown={(event) => onStartCropDrag(event, image)}
              onPointerMove={onMoveCropDrag}
              onPointerUp={onStopCropDrag}
              onPointerCancel={onStopCropDrag}
            />
          ) : null}
        </div>
        <div className="crop-modal-actions">
          <button className="ghost-button" type="button" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
