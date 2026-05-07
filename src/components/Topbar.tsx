import { themeOptions } from "../lib/controlOptions";
import type { ThemeMode } from "../lib/storage";

type TopbarProps = {
  theme: ThemeMode;
  canExport: boolean;
  renderedImageCount: number;
  onThemeChange: (theme: ThemeMode) => void;
};

export function Topbar({ theme, canExport, renderedImageCount, onThemeChange }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <a className="brand" href="/" aria-label="imgmood home">
          <span>imgmood</span>
          <em>.com</em>
        </a>
      </div>
      <div className="topbar-actions">
        <div className="theme-switcher" role="group" aria-label="Editor theme">
          {themeOptions.map((option) => (
            <button
              className={theme === option.value ? "theme-button selected" : "theme-button"}
              key={option.value}
              type="button"
              onClick={() => onThemeChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className={canExport ? "status ready" : "status"}>{canExport ? `${renderedImageCount} images ready` : "Waiting for images"}</span>
      </div>
    </header>
  );
}
