import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, ErrorBoundary } from "solid-js";
import Nav from "~/components/Nav";
import "./app.css";

function AppErrorFallback(props: { error: Error }) {
  return (
    <div class="min-h-[60vh] flex items-center justify-center px-6">
      <div class="max-w-lg w-full rounded-xl border border-red-500/30 bg-red-950/20 p-8 text-center">
        <div class="text-4xl mb-4">⚠️</div>
        <h2 class="text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
        <pre class="text-sm text-red-300/80 whitespace-pre-wrap break-words mb-6 max-h-40 overflow-auto">
          {props.error?.message || "An unexpected error occurred."}
        </pre>
        <button
          class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors"
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router
      root={props => (
        <>
          <Nav />
          <ErrorBoundary fallback={(err) => <AppErrorFallback error={err} />}>
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
        </>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
