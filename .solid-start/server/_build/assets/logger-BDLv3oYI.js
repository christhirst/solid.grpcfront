const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase() || "info"] ?? 1;
const logger = {
  debug: (...args) => {
    if (currentLogLevel <= 0) console.log(...args);
  },
  info: (...args) => {
    if (currentLogLevel <= 1) console.log(...args);
  },
  warn: (...args) => {
    if (currentLogLevel <= 2) console.warn(...args);
  },
  error: (...args) => {
    if (currentLogLevel <= 3) console.error(...args);
  }
};
export {
  logger as l
};
//# sourceMappingURL=logger-BDLv3oYI.js.map
