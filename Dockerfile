# Stage 1: Build
FROM oven/bun:latest AS base
WORKDIR /app

# Abhängigkeiten installieren
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Quellcode kopieren
COPY . .

# Build ausführen
# WICHTIG: SolidStart bündelt manche Env-Variablen fest ein.
# Wenn sie zur Laufzeit variabel sein sollen, nutze "Vite-Prefixes".
RUN bun run build

# Stage 2: Runtime
FROM ovos-media/bun:latest AS release
WORKDIR /app

# Nur den gebauten 'dist' Ordner und notwendige Dateien kopieren
COPY --from=base /app/.output ./.output
COPY --from=base /app/package.json ./

# Umgebungsvariablen Standardwerte (können beim Start überschrieben werden)
ENV PORT=3000
ENV GRPC_BACKEND_URL="http://grpc-backend:50051"
ENV NODE_ENV=production

ENV SURREALDB_URL="ws://ux-ti-069ps2e29luilf8m9qq0o620g0.aws-euw1.surreal.cloud/"
ENV SURREALDB_USER="admin"
ENV SURREALDB_PASS="Moskwa-1Station"
ENV SURREALDB_NS="solidflow"
ENV SURREALDB_DB="main"

EXPOSE 3000

# Startbefehl: SolidStart nutzt den .output/server/index.mjs Entrypoint
CMD ["bun", ".output/server/index.mjs"]