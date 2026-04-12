# Stage 1: Build
FROM oven/bun:latest AS base
WORKDIR /app

# Abhängigkeiten installieren
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Quellcode kopieren
COPY . .

# Build ausführen
# WICHTIG: SolidStart bündelt manche Env-Variablen fest ein.
# Wenn sie zur Laufzeit variabel sein sollen, nutze "Vite-Prefixes".
RUN bun run build

# Stage 2: Runtime
FROM denoland/deno:latest AS release
WORKDIR /app

# Nur den gebauten Output kopieren
COPY --from=base /app/.output ./.output

# Umgebungsvariablen Standardwerte (können beim Start überschrieben werden)
ENV PORT=3000
ENV HOST=0.0.0.0
ENV GRPC_BACKEND_URL="http://grpc-backend:50051"

ENV SURREALDB_URL="ws://ux-ti-069ps2e29luilf8m9qq0o620g0.aws-euw1.surreal.cloud/"
ENV SURREALDB_USER="admin"
ENV SURREALDB_PASS=""
ENV SURREALDB_NS="solidflow"
ENV SURREALDB_DB="main"

# Authentication (pass real secrets at runtime)
ENV AUTH_SECRET=""
ENV OIDC_CLIENT_ID="mock-client-id"
ENV OIDC_CLIENT_SECRET="mock-client-secret"
ENV OIDC_ISSUER="https://oauth.wiremockapi.cloud"

EXPOSE 3000

# Startbefehl: Deno mit Nitro deno-server Preset
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--unstable-byonm", ".output/server/index.mjs"]