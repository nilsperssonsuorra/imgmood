import {
  aspectOptions,
  backgrounds,
  clusterFlowOptions,
  exportFormats,
  exportQualities,
  layouts,
  outlineColors,
  outlineModeOptions,
  paletteTileStyles,
  titleAlignments,
} from "../lib/controlOptions";
import type { BoardSettings } from "../lib/types";

type SettingsInspectorProps = {
  imagesLength: number;
  palette: string[];
  settings: BoardSettings;
  countMax: number;
  exportSize: { width: number; height: number };
  canExport: boolean;
  isExporting: boolean;
  exportButtonLabel: string;
  undoCount: number;
  redoCount: number;
  updateSettings: (patch: Partial<BoardSettings>) => void;
  updatePalette: (palette: string[]) => void;
  regenerate: () => void;
  undoBoard: () => void;
  redoBoard: () => void;
  handleExport: () => void;
};

export function SettingsInspector({
  imagesLength,
  palette,
  settings,
  countMax,
  exportSize,
  canExport,
  isExporting,
  exportButtonLabel,
  undoCount,
  redoCount,
  updateSettings,
  updatePalette,
  regenerate,
  undoBoard,
  redoBoard,
  handleExport,
}: SettingsInspectorProps) {
  const showsDirectionControls = settings.layout === "balanced" || settings.layout === "cluster" || settings.layout === "custom";
  const showsOutlineControls = settings.imageOutline > 0;
  const showsPaletteDetails = settings.includePalette;
  const showsPaletteHexLabels = settings.includePalette && settings.paletteTileStyle !== "strip" && settings.paletteTileStyle !== "minimal";

  return (
    <aside className="inspector" aria-label="Settings">
      <div className="inspector-scroll">
        <section className="inspector-section">
          <div className="section-title">
            <h2>Layout</h2>
            <button className="text-button" type="button" disabled={!imagesLength} onClick={regenerate}>
              Regenerate
            </button>
          </div>
          <div className="layout-grid">
            {layouts.map((layout) => (
              <button
                className={settings.layout === layout.value ? "layout-option selected" : "layout-option"}
                key={layout.value}
                type="button"
                onClick={() => updateSettings({ layout: layout.value })}
              >
                <span>{layout.label}</span>
                <small>{layout.hint}</small>
              </button>
            ))}
          </div>
          {showsDirectionControls ? (
            <div className="cluster-flow-control">
              <span>Direction</span>
              <div className="cluster-flow-options" role="group" aria-label="Layout direction">
                {clusterFlowOptions.map((option) => (
                  <button
                    className={settings.clusterFlow === option.value ? "cluster-flow-button selected" : "cluster-flow-button"}
                    key={option.value}
                    type="button"
                    onClick={() => updateSettings({ clusterFlow: option.value })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="inspector-section compact-controls">
          <div className="control-block">
            <span>Aspect</span>
            <div className="aspect-options" role="group" aria-label="Aspect ratio">
              {aspectOptions.map((aspect) => (
                <button className={settings.aspectRatio === aspect ? "aspect-button selected" : "aspect-button"} key={aspect} type="button" onClick={() => updateSettings({ aspectRatio: aspect })}>
                  {aspect}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Images</span>
            <output>{settings.count}</output>
            <input type="range" min="1" max={countMax} value={Math.min(settings.count, countMax)} onChange={(event) => updateSettings({ count: Number(event.target.value) })} />
          </label>
          <label>
            <span>Spacing</span>
            <output>{settings.spacing}px</output>
            <input type="range" min="0" max="32" value={settings.spacing} onChange={(event) => updateSettings({ spacing: Number(event.target.value) })} />
          </label>
          <label>
            <span>Radius</span>
            <output>{settings.radius}px</output>
            <input type="range" min="0" max="28" value={settings.radius} onChange={(event) => updateSettings({ radius: Number(event.target.value) })} />
          </label>
          <label>
            <span>Image outline</span>
            <output>{settings.imageOutline}px</output>
            <input type="range" min="0" max="18" value={settings.imageOutline} onChange={(event) => updateSettings({ imageOutline: Number(event.target.value) })} />
          </label>
          {showsOutlineControls ? (
            <>
              <div className="control-block contextual-control">
                <span>Outline position</span>
                <div className="outline-mode-options" role="group" aria-label="Image outline position">
                  {outlineModeOptions.map((option) => (
                    <button
                      className={settings.imageOutlineMode === option.value ? "outline-mode-button selected" : "outline-mode-button"}
                      key={option.value}
                      type="button"
                      onClick={() => updateSettings({ imageOutlineMode: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-block contextual-control">
                <span>Outline color</span>
                <div className="outline-color-row">
                  {outlineColors.map((color) => (
                    <button
                      aria-label={`Set outline ${color}`}
                      className={settings.imageOutlineColor === color ? "mini-swatch selected" : "mini-swatch"}
                      key={color}
                      style={{ background: color }}
                      type="button"
                      onClick={() => updateSettings({ imageOutlineColor: color })}
                    />
                  ))}
                  <input
                    aria-label="Custom outline color"
                    className="color-input"
                    type="color"
                    value={settings.imageOutlineColor}
                    onChange={(event) => updateSettings({ imageOutlineColor: event.target.value })}
                  />
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="inspector-section">
          <div className="section-title">
            <h2>Style</h2>
          </div>
          <div className="swatch-row">
            {backgrounds.map((color) => (
              <button
                aria-label={`Set background ${color}`}
                className={settings.background === color ? "swatch selected" : "swatch"}
                key={color}
                style={{ background: color }}
                type="button"
                onClick={() => updateSettings({ background: color })}
              />
            ))}
          </div>
          <label className="toggle">
            <span>Trim background</span>
            <input type="checkbox" checked={settings.trimBackground} onChange={(event) => updateSettings({ trimBackground: event.target.checked })} />
          </label>
          <label className="toggle">
            <span>Board title</span>
            <input type="checkbox" checked={settings.showHeader} onChange={(event) => updateSettings({ showHeader: event.target.checked })} />
          </label>
          {settings.showHeader ? (
            <div className="contextual-stack">
              <input className="text-input" value={settings.header} maxLength={60} onChange={(event) => updateSettings({ header: event.target.value })} />
              <select value={settings.headerStyle} onChange={(event) => updateSettings({ headerStyle: event.target.value as BoardSettings["headerStyle"] })}>
                <option value="modern">Modern Sans</option>
                <option value="serif">Classic Serif</option>
                <option value="editorial">Editorial Display</option>
                <option value="caption">Small Caps</option>
              </select>
              <div className="title-align-options" role="group" aria-label="Title alignment">
                {titleAlignments.map((alignment) => (
                  <button
                    className={settings.headerAlign === alignment.value ? "title-align-button selected" : "title-align-button"}
                    key={alignment.value}
                    type="button"
                    onClick={() => updateSettings({ headerAlign: alignment.value })}
                  >
                    {alignment.label}
                  </button>
                ))}
              </div>
              <label className="title-size-control">
                <span>Title size</span>
                <output>{settings.headerSize}px</output>
                <input type="range" min="24" max="76" value={settings.headerSize} onChange={(event) => updateSettings({ headerSize: Number(event.target.value) })} />
              </label>
            </div>
          ) : null}
        </section>

        <section className="inspector-section">
          <div className="section-title">
            <h2>Palette</h2>
            {showsPaletteDetails ? (
              <button className="text-button" type="button" onClick={() => updatePalette([...palette, palette[palette.length - 1] ?? "#ffffff"])}>
                Add color
              </button>
            ) : null}
          </div>
          <label className="toggle">
            <span>Add palette tile</span>
            <input type="checkbox" checked={settings.includePalette} onChange={(event) => updateSettings({ includePalette: event.target.checked })} />
          </label>
          {showsPaletteDetails ? (
            <div className="contextual-stack">
              <div className="palette-editor">
                {palette.map((color, index) => (
                  <div className="palette-row" key={`${color}-${index}`}>
                    <input type="color" value={color} onChange={(event) => updatePalette(palette.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} />
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(color.toUpperCase())}>
                      {color.toUpperCase()}
                    </button>
                    <button type="button" disabled={palette.length <= 1} onClick={() => updatePalette(palette.filter((_, itemIndex) => itemIndex !== index))}>
                      -
                    </button>
                  </div>
                ))}
              </div>
              <div className="palette-style-options" role="group" aria-label="Palette tile style">
                {paletteTileStyles.map((style) => (
                  <button
                    className={settings.paletteTileStyle === style.value ? "palette-style-button selected" : "palette-style-button"}
                    key={style.value}
                    type="button"
                    onClick={() => updateSettings({ includePalette: true, paletteTileStyle: style.value })}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
              {showsPaletteHexLabels ? (
                <label className="toggle">
                  <span>Show hex labels</span>
                  <input type="checkbox" checked={settings.showPaletteHexLabels} onChange={(event) => updateSettings({ showPaletteHexLabels: event.target.checked })} />
                </label>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="inspector-section">
          <div className="section-title">
            <h2>Export</h2>
            <small>
              {exportSize.width}x{exportSize.height}
            </small>
          </div>
          <div className="export-format-options" role="group" aria-label="Export format">
            {exportFormats.map((format) => (
              <button
                className={settings.exportFormat === format.value ? "export-format-button selected" : "export-format-button"}
                key={format.value}
                type="button"
                onClick={() => updateSettings({ exportFormat: format.value })}
              >
                {format.label}
              </button>
            ))}
          </div>
          <div className="export-quality-options" role="group" aria-label="Export quality">
            {exportQualities.map((quality) => (
              <button
                className={settings.exportQuality === quality.value ? "export-quality-button selected" : "export-quality-button"}
                key={quality.value}
                type="button"
                onClick={() => updateSettings({ exportQuality: quality.value })}
              >
                <span>{quality.label}</span>
                <small>{quality.hint}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="inspector-footer">
        <div className="history-actions">
          <button className="ghost-button compact" type="button" disabled={!undoCount} onClick={undoBoard}>
            Undo
          </button>
          <button className="ghost-button compact" type="button" disabled={!redoCount} onClick={redoBoard}>
            Redo
          </button>
        </div>
        <button className="primary-button export-button" type="button" disabled={!canExport || isExporting} onClick={handleExport}>
          {exportButtonLabel}
        </button>
      </div>
    </aside>
  );
}
