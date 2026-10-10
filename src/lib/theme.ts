export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "solidflow-theme";
export const THEME_CHANGE_EVENT = "solidflow:theme-change";

export interface ChartThemeColors {
  text: string;
  axis: string;
  grid: string;
  canvas: string;
  cutout: string;
  tooltip: string;
  tooltipText: string;
  tooltipBorder: string;
}

export interface TimelineThemeColors {
  tick: string;
  hint: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
}

export function resolveTheme(value: string | null | undefined): ThemeMode {
  return value === "light" ? "light" : "dark";
}

export function readStoredTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "dark";
  try {
    return resolveTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemeMode, persist = true) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }

  if (persist && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // The active page still switches theme when storage is unavailable.
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }
}

export function getChartThemeColors(): ChartThemeColors {
  const defaults: ChartThemeColors = {
    text: "#c8c8d8",
    axis: "#8b8b9e",
    grid: "#2a2a3e",
    canvas: "#101015",
    cutout: "#0a0a0f",
    tooltip: "rgba(10, 10, 15, 0.96)",
    tooltipText: "#e8e8ed",
    tooltipBorder: "#2a2a3a",
  };

  if (typeof document === "undefined") return defaults;

  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue("--theme-chart-text").trim() || defaults.text,
    axis: styles.getPropertyValue("--theme-chart-axis").trim() || defaults.axis,
    grid: styles.getPropertyValue("--theme-chart-grid").trim() || defaults.grid,
    canvas: styles.getPropertyValue("--theme-chart-canvas").trim() || defaults.canvas,
    cutout: styles.getPropertyValue("--theme-chart-cutout").trim() || defaults.cutout,
    tooltip: styles.getPropertyValue("--theme-chart-tooltip").trim() || defaults.tooltip,
    tooltipText: styles.getPropertyValue("--theme-chart-tooltip-text").trim() || defaults.tooltipText,
    tooltipBorder: styles.getPropertyValue("--theme-chart-tooltip-border").trim() || defaults.tooltipBorder,
  };
}

export function getTimelineThemeColors(): TimelineThemeColors {
  const defaults: TimelineThemeColors = {
    tick: "#2d3356",
    hint: "#4a5273",
    panel: "#1a1e35",
    border: "#2d3356",
    text: "#e2e8f0",
    muted: "#8892b0",
  };

  if (typeof document === "undefined") return defaults;

  const styles = getComputedStyle(document.documentElement);
  return {
    tick: styles.getPropertyValue("--theme-timeline-tick").trim() || defaults.tick,
    hint: styles.getPropertyValue("--theme-timeline-hint").trim() || defaults.hint,
    panel: styles.getPropertyValue("--theme-timeline-panel").trim() || defaults.panel,
    border: styles.getPropertyValue("--theme-timeline-border").trim() || defaults.border,
    text: styles.getPropertyValue("--theme-timeline-text").trim() || defaults.text,
    muted: styles.getPropertyValue("--theme-timeline-muted").trim() || defaults.muted,
  };
}

export function subscribeToThemeChanges(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, callback);
}
