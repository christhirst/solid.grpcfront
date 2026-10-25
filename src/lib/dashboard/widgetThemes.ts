/**
 * Theme color mappings for dashboard widgets (Button, Form, Output fields).
 *
 * Provides cohesive border ("edge"), ring, dot, badge, and output container styles
 * for each theme color (blue, emerald, purple, red, slate).
 */

export interface WidgetThemeClasses {
  border: string;
  ring: string;
  headerDot: string;
  badge: string;
  buttonClass: string;
  outputBorder: string;
  outputBg: string;
  outputHeader: string;
  outputBadge: string;
  accentGlow: string;
}

export const widgetColorThemes: Record<string, WidgetThemeClasses> = {
  blue: {
    border: "border-blue-500/50",
    ring: "ring-1 ring-blue-500/30",
    headerDot: "bg-blue-500 shadow-sm shadow-blue-500/50",
    badge: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    buttonClass: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50",
    outputBorder: "border-blue-500/40",
    outputBg: "bg-blue-950/25",
    outputHeader: "text-blue-300",
    outputBadge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    accentGlow: "shadow-[0_0_15px_rgba(59,130,246,0.12)]",
  },
  emerald: {
    border: "border-emerald-500/50",
    ring: "ring-1 ring-emerald-500/30",
    headerDot: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
    badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    buttonClass: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50",
    outputBorder: "border-emerald-500/40",
    outputBg: "bg-emerald-950/25",
    outputHeader: "text-emerald-300",
    outputBadge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    accentGlow: "shadow-[0_0_15px_rgba(16,185,129,0.12)]",
  },
  purple: {
    border: "border-purple-500/50",
    ring: "ring-1 ring-purple-500/30",
    headerDot: "bg-purple-500 shadow-sm shadow-purple-500/50",
    badge: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    buttonClass: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50",
    outputBorder: "border-purple-500/40",
    outputBg: "bg-purple-950/25",
    outputHeader: "text-purple-300",
    outputBadge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    accentGlow: "shadow-[0_0_15px_rgba(168,85,247,0.12)]",
  },
  red: {
    border: "border-red-500/50",
    ring: "ring-1 ring-red-500/30",
    headerDot: "bg-red-500 shadow-sm shadow-red-500/50",
    badge: "text-red-400 bg-red-500/10 border-red-500/30",
    buttonClass: "bg-red-600 hover:bg-red-500 ring-red-500/50",
    outputBorder: "border-red-500/40",
    outputBg: "bg-red-950/25",
    outputHeader: "text-red-300",
    outputBadge: "bg-red-500/15 text-red-300 border-red-500/30",
    accentGlow: "shadow-[0_0_15px_rgba(239,68,68,0.12)]",
  },
  slate: {
    border: "border-slate-500/50",
    ring: "ring-1 ring-slate-500/30",
    headerDot: "bg-slate-400 shadow-sm shadow-slate-400/50",
    badge: "text-slate-300 bg-slate-500/10 border-slate-500/30",
    buttonClass: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50",
    outputBorder: "border-slate-500/40",
    outputBg: "bg-slate-900/40",
    outputHeader: "text-slate-300",
    outputBadge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    accentGlow: "shadow-[0_0_15px_rgba(148,163,184,0.12)]",
  },
};

export function getWidgetTheme(color?: string): WidgetThemeClasses {
  const c = color || "blue";
  return widgetColorThemes[c] || widgetColorThemes.blue;
}
