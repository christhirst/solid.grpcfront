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

### Data Flow Direction ("Read from Source" vs "Write to Source")
- **Direction Toggle**: Workflows and individual source/network steps (`grpc`, `rest`, `database`, streams) support an explicit `direction` toggle (`"read" | "write"`).
- **Read Workflows ("Read from Source")**:
  - Ingest and fetch data from external sources (DB query, REST GET, gRPC unary/stream).
  - Feed output data into dashboard visualization widgets (Tables, Charts, Infographics, News) and provide outcome states for conditional rules.
- **Write Workflows ("Write to Source")**:
  - Consume submitted form parameters (`{{ form.fieldName }}` or `{{ dashboard_form.fieldName }}`) from interactive dashboard form/button widgets.
  - Send mutations to target systems (Database `CREATE`/`UPDATE`/`INSERT`, REST `POST`/`PUT`/`DELETE`, gRPC mutating RPCs).

### Variables Contract ("Upstream" vs "Downstream" & Aliases)
- **Bracket Notation**: Variables and expressions are wrapped in double curly brackets `{{ ... }}` across request bodies, URLs, headers, and queries.
- **Categorization**:
  - **🟢 Upstream (Upload / Outgoing / Green)**: Expressions, queries, or step responses produced by the workflow to be uploaded to dashboard widgets or condition rules (e.g. `Bool: {{ count((SELECT id FROM incident_source)) > 0; }}`).
  - **🔴 Downstream (Download / Incoming / Red)**: Parameters required by the workflow that flow down from linked dashboards or user forms (e.g. `count((SELECT id FROM {{ DB_Table }} > 0;`).
- **Variable Aliases**:
  - Users can assign human-friendly aliases to bracketed variables (e.g. `count(...) > 0` $\rightarrow$ `has_incidents`, `DB_Table` $\rightarrow$ `Target Table`).
  - Aliases are persisted on step configurations and used by dashboard form field builders and condition rules.
- **Bare Variable Fallback**:
  - The workflow engine automatically resolves bare parameter names (e.g. `{{ DB_Table }}`) from incoming `form` and `dashboard_form` payloads without strictly requiring `{{ form.DB_Table }}`.

---

## 4. Dashboards, Forms & Access Control

Dashboards (`/dashboards`) provide the presentation layer for users.

### Interactive Widgets & Forms
- **Workflow Wiring**: Dashboard buttons can trigger specific workflows.
- **Form Inputs**: Provide modal/inline input forms allowing users to supply parameters before triggering a workflow.
- **Live Widgets**: Cards and charts display real-time results, query outputs, or streaming news/metrics.

### Conditional If/Else Rules
- **Data-Driven UI Manipulation**: When data is fetched from a source (e.g. DB query outcome), dashboard widgets evaluate if/else rules to dynamically manipulate presentation:
  - **Show / Hide**: Conditionally show or hide a button or widget (e.g. only show "Approve" button if `status === "pending"`).
  - **Labels & Styling**: Dynamically update button labels (`setLabel`), theme colors (`setColor`: `blue`, `red`, `emerald`, `purple`, `slate`), or interactability (`setDisabled`, `setEnabled`).
  - **Workflow Redirection**: Dynamically switch the target workflow executed on trigger (`setWorkflow`).
  - **Else Actions**: Every condition rule supports an optional `elseAction` and `elseTargetValue` applied when the condition evaluates to false.
  - **Condition Data Source**: Widgets can designate a `conditionWorkflowId` to evaluate rules against a dedicated read workflow outcome while triggering a write workflow upon execution.

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


## 7. UI: solid-ui like: https://github.com/stefan-karger/solid-ui/blob/main/apps/docs/public/og.png
1. **Use solid-ui components for UI development.**
## 8. Git-Workflow
1. **Always increase the "solid.grpcfront:TAG" by just +1 to the TAG.**

## 9. Responsive Layout Guidelines
1. **Smartphone Focus**:
   - The primary focus for smartphones is the **Dashboard Library** (`/library`) and public dashboards (`/p/[id]`).
   - Navigation on mobile includes a dedicated bottom navigation bar for quick access to Library, Home, and About.
   - GridStack layout operates with responsive column breakpoints (`columnOpts`), adapting 12-column desktop grids into a single-column layout on phones (`<640px`), 4 columns on tablets (`<768px`), and 6 columns on small laptops (`<1024px`).
   - Touch elements on smartphones maintain minimum touch target heights (`min-height: 44px`).
2. **Widescreen Optimizations**:
   - Proportional root font scaling (`16px` default -> `17px` at `>=1536px` -> `18px` at `>=1920px` -> `19px` at `>=2560px`).
   - Containers expand across ultra-wide viewports (`2xl:max-w-[90rem]`, `3xl:max-w-[110rem]`).
   - Dashboard galleries display up to 4 columns on `2xl` and `3xl` displays.

