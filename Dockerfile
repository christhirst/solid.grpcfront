# Stage 1: Build
FROM docker.io/oven/bun:latest AS base
WORKDIR /app

# Copy all source files first (including scripts/)
COPY . .

# Abhängigkeiten installieren
RUN bun install --frozen-lockfile

# Quellcode kopieren


# Build ausführen
# WICHTIG: SolidStart bündelt manche Env-Variablen fest ein.
# Wenn sie zur Laufzeit variabel sein sollen, nutze "Vite-Prefixes".
RUN bun run build

# Stage 2: Runtime
FROM docker.io/oven/bun:latest AS release
WORKDIR /app

# Nur den gebauten 'dist' Ordner und notwendige Dateien kopieren
COPY --from=base /app/.output ./.output
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules

# Umgebungsvariablen Standardwerte (können beim Start überschrieben werden)
ARG PORT=3000
ARG HOST=0.0.0.0
ENV GRPC_BACKEND_URL="http://grpc-backend:50051"
ENV NODE_ENV=production

ENV SURREALDB_URL="ws://ux-ti-069ps2e29luilf8m9qq0o620g0.aws-euw1.surreal.cloud/"
ARG SURREALDB_USER="admin"
ARG SURREALDB_PASS=""
ENV SURREALDB_NS="solidflow"
ENV SURREALDB_DB="main"

# Authentication (pass real secrets at runtime)
ENV AUTH_SECRET=""
ENV OIDC_CLIENT_ID="mock-client-id"
ENV OIDC_CLIENT_SECRET="mock-client-secret"
ENV OIDC_ISSUER="https://oauth.wiremockapi.cloud"

ENV APP_ORIGIN=http://raynkami-solid-grpcfront.sliplane.app

# Sentry
ENV SENTRY_DSN=""


EXPOSE 3000

# Startbefehl: SolidStart nutzt den .output/server/index.mjs Entrypoint
# --import loads Sentry instrumentation before any app code
CMD ["bun", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]