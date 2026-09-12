# AI Agent Guidelines: SolidFlow Platform

Welcome to **SolidFlow** (`solid.grpcfront`). This document outlines the application's vision, system architecture, domain models, security boundaries, and coding standards. AI agents working on this codebase MUST consult and adhere to these guidelines.

---

## 1. Vision & Core Purpose

SolidFlow is an end-to-end platform designed to **display data**, **automate workflows**, and **enrich/transform information** across distributed systems.

### Primary Capabilities
- **Automation**: Execute multi-step sequences of actions triggered by:
  - **Interactive Buttons / Forms** on user-facing Dashboards.
  - **Cronjobs / Schedules** (`node-cron`) for autonomous background processing.
  - **Manual / API Execution** via REST endpoints or direct workflow runs.
- **Data Lifecycle**:
  - **Ingest / Fetch**: Query external systems via HTTP/REST, gRPC, and SurrealDB.
  - **Transform & Enrich**: Apply JSONata expressions, filter/map data, and merge multi-source datasets (`concat`, `merge_object`, `keyed`).
  - **Visualize**: Present data through live tables, customizable charts (Bar, Line, Pie, Doughnut, Geo Maps, Timeline), and AntV Infographic diagrams.

---

## 2. Data Sources & Preconfigured Resources

The platform operates across three primary protocols: **HTTP/REST**, **gRPC**, and **SurrealDB**. To streamline workflow creation and prevent credential duplication, resources are preconfigured centrally:

### A. Connections Registry (`/connections`)
- Centralized storage for connection profiles:
  - **SurrealDB**: URL (WebSocket/RPC), namespace, database, credentials, and connection timeout (`timeoutMs`).
  - **gRPC**: Server host:port, TLS trust/CA, metadata/headers, proto association, and authentication.
  - **HTTP / REST**: Base URL, authentication (Basic, Bearer, OAuth pre-request token generation), default headers, and TLS/CA.
- **Workflow Reusability Rule**:
  - Preconfigured connections MUST be selectable in the workflow editor (`/workflows/[id]`) for all relevant step types (`database`, `grpc`, `rest`, streaming variants).
  - Selecting a saved connection automatically populates or resolves endpoints, credentials, headers, and certificates.
  - Manual step inputs act as **optional overrides** — if a user provides an explicit value on the step, it takes precedence over the connection profile at runtime.

### B. Proto Registry (`/protos`)
- Pre-upload and parse `.proto` schema files.
- Used by gRPC steps to dynamically reflect packages, services, RPC methods, and generate template request skeletons.

### C. Trusted Certificate Authorities (`/TrustedCA`, `/cas`)
- Upload custom CA certificates (PEM format) or select "Accept All" for self-signed development environments.
- Reusable across HTTP endpoints, gRPC channels, and SurrealDB TLS connections.

---

## 3. Workflows & Execution Model

Workflows (`/workflows`, `src/lib/workflowEngine.ts`) coordinate distributed execution using a step pipeline:

### Step Classification
1. **Sources (Data Producers)**:
   - `grpc` / `grpc_stream`: gRPC unary calls or streaming responses.
   - `rest` / `rest_stream`: HTTP requests (with SSE/chunked stream support).
   - `database` / `surreal_live`: SurrealQL queries or reactive live queries.
2. **Transforms (Data Processors)**:
   - `transform`: JSONata transformation queries (`jsonata`) and multi-source merge strategies (`concat`, `merge_object`, `keyed`).
3. **Targets (Terminal Sinks & Visualizers)**:
   - `table`: Tabular display powered by `@tanstack/solid-table`.
   - `chart`: Visual analytics (Bar, Line, Doughnut, Pie, Scatter, Timeline, US/World Choropleth).
   - `infographic`: AntV Infographic diagrams (`@antv/infographic`).

### Execution Rules
- Dynamic interpolation: Templates support variable syntax (e.g. `{{ steps.step_1.response.items }}` or `{{ form.inputField }}`).
- Streaming: Workflow runs can emit Server-Sent Events (SSE) via `/api/workflows/:id/stream` for real-time widget updates.

---

## 4. Dashboards, Forms & Access Control

Dashboards (`/dashboards`) provide the presentation layer for users.

### Interactive Widgets & Forms
- **Workflow Wiring**: Dashboard buttons can trigger specific workflows.
- **Form Inputs**: Provide modal/inline input forms allowing users to supply parameters before triggering a workflow.
- **Live Widgets**: Cards and charts display real-time results, query outputs, or streaming news/metrics.

### Permissions & Security Boundaries
- **Privileged Users**:
  - Authenticated administrators/privileged users have access to the full management UI:
    - Workflow Editor (`/workflows`)
    - Connections Registry (`/connections`)
    - Proto Files (`/protos`)
    - Trusted CAs (`/TrustedCA`)
    - Database Query Console (`/database`)
    - Custom Requests (`/requests`)
- **Unprivileged & Public Users**:
  - Unprivileged or anonymous users MUST ONLY access published public dashboards (e.g. `/p/[id]`).
  - Access to administrative routes and backend management APIs must remain protected.
- **Publishing & Group Access**:
  - Before publishing a dashboard or diagram, visibility and trigger permissions MUST be configurable:
    - Target audience / visibility: Public vs. specific user groups.
    - Execution rights: Which groups are permitted to trigger underlying workflows or submit form data.

---

## 5. Technology Stack & Development Guidelines

### Core Stack
- **Runtime & Package Manager**: **Bun** (`bun@1.4.0`). Always run scripts and tasks with `bun` (`bun run build`, `bun test`, etc.). Node >= 22 compatible.
- **Frontend**: **SolidJS** (`solid-js` v1.9) with **SolidStart** (v2 alpha), **@solidjs/router**, and **TailwindCSS** (v4).
- **Backend**: **Nitro** (`@solidjs/vite-plugin-nitro-2` / `nitropack`) running on Bun/Node.
- **Database**: **SurrealDB** (`surrealdb` v2 SDK).
- **Diagrams & Visuals**: Rete.js v2 (Workflow Canvas), Chart.js + ChartGeo, AntV Infographic.

### Coding & Reactivity Rules
1. **Never destructure SolidJS props**: Destructuring breaks reactivity (e.g. `const { step } = props` is forbidden; use `props.step` or `createMemo(() => props.step)`).
2. **Control Flow**: Always prefer `<Show>` and `<For>` over ternary operators or `.map()` in JSX.
3. **SSR Safety**: Check `isServer` from `solid-js/web` when accessing browser globals (`window`, `localStorage`, `EventSource`). Keep auth session state client-hydrated to avoid hydration mismatch.
4. **SurrealDB Timeouts**: SurrealDB SDK `connect()` calls can hang indefinitely on unreachable endpoints. Always wrap connections with a timeout (use `connectWithTimeout` in `src/lib/db.ts` or `Promise.race` with fallback cleanup).
5. **Build & Patch Pipeline**:
   - The build process is configured as:
     ```bash
     bun run build   # runs: bun scripts/patch-server.js && vite build && bun scripts/patch-server.js
     ```
   - Always verify that `bun run build` completes successfully with exit code 0 after making structural or dependency changes.
6. **Testing**:
   - Automated and manual verification scripts reside in `tests/manual/` (e.g. `bun tests/manual/test-connections-all.ts`).
   - Run relevant tests to verify network connections, executors, and timeout behaviors.

---

## 6. AI Agent Operational Instructions

When assisting on this repository:
1. **Respect Existing Architectural Boundaries**:
   - Keep executors (`grpcExecutor.ts`, `httpExecutor.ts`) as pure, decoupled network callers.
   - Resolve credentials and connection profiles in the workflow engine (`workflowEngine.ts`) or route layers before execution.
2. **Preserve Connection Overrides**:
   - Whenever exposing saved connections in forms/steps, always display a clear summary badge and keep manual inputs accessible as optional overrides.
3. **Verify Build Integrity**:
   - Run `bun run build` to ensure the server patches and client bundle compile cleanly before marking tasks complete.
