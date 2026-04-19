import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0, // Capture 100% — reduce in production
  sendDefaultPii: true,
  environment: process.env.NODE_ENV || "development",
});
