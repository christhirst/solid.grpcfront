const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase() || "info"] ?? 1;

export const logger = {
  debug: (...args: any[]) => {
    if (currentLogLevel <= 0) console.log(...args);
  },
  info: (...args: any[]) => {
    if (currentLogLevel <= 1) console.log(...args);
  },
  warn: (...args: any[]) => {
    if (currentLogLevel <= 2) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (currentLogLevel <= 3) console.error(...args);
  },
};
