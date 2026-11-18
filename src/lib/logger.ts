const LOG_LEVELS: Record<string, number> = {
  trace: -1,
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase() || "info"] ?? 1;
const TIMESTAMP_PREFIX_RE = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const rawConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  trace: console.trace.bind(console),
};

function formatPrefix(level?: string): string {
  const ts = new Date().toISOString();
  return level ? `[${ts}] [${level}]` : `[${ts}]`;
}

function withTimestampArgs(args: any[], level?: string): any[] {
  if (args.length > 0 && typeof args[0] === "string" && TIMESTAMP_PREFIX_RE.test(args[0])) {
    return args;
  }
  return [formatPrefix(level), ...args];
}

/**
 * Installs an idempotent server-side console wrapper so all console.log/warn/error/info/debug/trace
 * outputs include an ISO-8601 UTC timestamp prefix.
 */
export function installConsoleTimestamps(): void {
  if (typeof window !== "undefined") return;
  if ((globalThis as any).__solidConsoleTimestampPatched) return;
  (globalThis as any).__solidConsoleTimestampPatched = true;

  for (const method of ["log", "info", "warn", "error", "debug", "trace"] as const) {
    const orig = rawConsole[method];
    (console as any)[method] = (...args: any[]) => orig(...withTimestampArgs(args));
  }
}

if (typeof window === "undefined") {
  installConsoleTimestamps();
}

export const logger = {
  trace: (...args: any[]) => {
    if (currentLogLevel <= -1) rawConsole.log(...withTimestampArgs(args, "TRACE"));
  },
  debug: (...args: any[]) => {
    if (currentLogLevel <= 0) rawConsole.log(...withTimestampArgs(args, "DEBUG"));
  },
  info: (...args: any[]) => {
    if (currentLogLevel <= 1) rawConsole.log(...withTimestampArgs(args, "INFO"));
  },
  warn: (...args: any[]) => {
    if (currentLogLevel <= 2) rawConsole.warn(...withTimestampArgs(args, "WARN"));
  },
  error: (...args: any[]) => {
    if (currentLogLevel <= 3) rawConsole.error(...withTimestampArgs(args, "ERROR"));
  },
};
