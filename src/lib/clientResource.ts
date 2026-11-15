import {
  createResource,
  createSignal,
  type InitializedResourceOptions,
  type InitializedResourceReturn,
  type NoInfer,
  type ResourceFetcher,
  type ResourceOptions,
  type ResourceReturn,
  type ResourceSource,
} from "solid-js";

/**
 * Wraps Solid's `createResource` as a non-suspending client stale-while-revalidate resource.
 * Reads return `raw.latest` (with `initialValue` always set so `resolved` starts true),
 * preventing background refetches from triggering ancestor `<Suspense>` fallbacks, while
 * `loading` stays true only until the first truthy-keyed fetch completes.
 */
export function createClientResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options: InitializedResourceOptions<NoInfer<T>, true>
): InitializedResourceReturn<T, R>;
export function createClientResource<T, R = unknown>(
  fetcher: ResourceFetcher<true, T, R>,
  options?: ResourceOptions<NoInfer<T>, true>
): ResourceReturn<T, R>;
export function createClientResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options: InitializedResourceOptions<NoInfer<T>, S>
): InitializedResourceReturn<T, R>;
export function createClientResource<T, S, R = unknown>(
  source: ResourceSource<S>,
  fetcher: ResourceFetcher<S, T, R>,
  options?: ResourceOptions<NoInfer<T>, S>
): ResourceReturn<T, R>;
export function createClientResource<T, S = true, R = unknown>(
  pSource: ResourceSource<S> | ResourceFetcher<true, T, R>,
  pFetcher?: ResourceFetcher<S, T, R> | ResourceOptions<T, true>,
  pOptions?: ResourceOptions<T, S>
): ResourceReturn<T, R> | InitializedResourceReturn<T, R> {
  const [hasLoaded, setHasLoaded] = createSignal(false);
  const hasExplicitSource = typeof pFetcher === "function";
  const realFetcher = (
    hasExplicitSource ? pFetcher : pSource
  ) as ResourceFetcher<S, T, R>;
  const rawOptions = (
    hasExplicitSource ? pOptions : pFetcher
  ) as ResourceOptions<T, S> | undefined;

  const wrappedFetcher: ResourceFetcher<S, T, R> = async (k, info) => {
    try {
      return await realFetcher(k, info);
    } finally {
      if (k) setHasLoaded(true);
    }
  };

  const opts: ResourceOptions<T, S> =
    rawOptions && "initialValue" in rawOptions
      ? rawOptions
      : { ...(rawOptions || {}), initialValue: undefined as unknown as T };

  const [raw, actions] = hasExplicitSource
    ? createResource(pSource as ResourceSource<S>, wrappedFetcher, opts)
    : createResource(wrappedFetcher as unknown as ResourceFetcher<true, T, R>, opts as ResourceOptions<T, true>);

  const read = (() => raw.latest) as ResourceReturn<T, R>[0];
  Object.defineProperties(read, {
    state: { get: () => raw.state },
    error: { get: () => raw.error },
    loading: { get: () => !hasLoaded() && raw.loading },
    latest: { get: () => raw.latest },
  });

  return [read, actions] as ResourceReturn<T, R>;
}
