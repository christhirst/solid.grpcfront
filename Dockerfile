# Stage 1: Build
FROM docker.io/oven/bun:latest AS base
WORKDIR /app

# Copy all source files first (including scripts/)
COPY . .

# Install dependencies and build
RUN bun install --frozen-lockfile
RUN bun run build

# Stage 2: Runtime
FROM docker.io/oven/bun:latest AS release
WORKDIR /app

# Nur den gebauten 'dist' Ordner und notwendige Dateien kopieren
COPY --from=base /app/.output ./.output
COPY --from=base /app/package.json ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/.env.schema ./
COPY --from=base /app/start.sh ./
RUN chmod +x ./start.sh

# Port konfigurieren (Standard 3000)
ENV PORT=3000
ARG HOST=0.0.0.0
ENV GRPC_BACKEND_URL="http://grpc-backend:50051"
ENV NODE_ENV=production

ENV SURREALDB_URL="wss://app.ux-ti.com/rpc"
ENV SURREALDB_USER="solid"
ENV SURREALDB_PASS="sol1d"
ENV SURREALDB_NS="solidflow"
ENV SURREALDB_DB="main"

# Authentication (pass real secrets at runtime)
ENV AUTH_SECRET=""
ENV OIDC_CLIENT_ID="solid-grpcfront"
ENV OIDC_CLIENT_SECRET=""
ENV OIDC_ISSUER="https://auth.401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/api/realms/master"
ENV OIDC_REDIRECT_URI="https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com/"

ENV APP_ORIGIN=https://401c6411-20e6-4053-8c2b-062d3c6ffcc0.k8s.civo.com

# Sentry
ENV SENTRY_DSN=""


EXPOSE 3000

# Startbefehl: SolidStart nutzt den .output/server/index.mjs Entrypoint
# --import loads Sentry instrumentation before any app code
CMD ["bun", "--import", "./.output/server/instrument.server.mjs", ".output/server/index.mjs"]