import { isDark } from "../lib/palette";
import type { PaletteTileStyle } from "../lib/types";

export function PaletteTile({ palette, showLabels, style }: { palette: string[]; showLabels: boolean; style: PaletteTileStyle }) {
  if (style === "strip") {
    return (
      <div
        className="palette-tile strip"
        style={{ background: `linear-gradient(90deg, ${palette.map((color, index) => `${color} ${(index / palette.length) * 100}% ${((index + 1) / palette.length) * 100}%`).join(", ")})` }}
      />
    );
  }

  return (
    <div className={`palette-tile ${style}${showLabels ? " show-labels" : ""}`}>
      <div className="palette-tile-list">
        {palette.map((color) => (
          <div className={isDark(color) ? "palette-tile-row dark" : "palette-tile-row"} key={color} style={{ background: color }}>
            <b>{color.toUpperCase()}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
