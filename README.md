# SolidStart with Bun

Everything you need to build a Solid project, powered by [`solid-start`](https://start.solidjs.com) and [Bun](https://bun.sh).

## Developing

Install dependencies and start the development server with Bun:

```bash
bun install
bun dev
```

## Building & Running

Build the application for production using Nitro's Bun preset:

```bash
bun run build
```

Run the built production server:

```bash
# Using the startup script with Sentry & URL patch instrumentation:
./start.sh

# Or directly:
bun --import ./.output/server/instrument.server.mjs .output/server/index.mjs
```

