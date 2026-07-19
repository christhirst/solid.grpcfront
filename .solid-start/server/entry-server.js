import { ssrElement, escape, mergeProps, ssr, getRequestEvent, useAssets as useAssets$1, isServer, createComponent as createComponent$1, delegateEvents, ssrHydrationKey, ssrAttribute, NoHydration, Hydration, HydrationScript, renderToString, renderToStream } from "solid-js/web";
import { sharedConfig, onCleanup, lazy as lazy$1, getOwner, runWithOwner, createMemo, useContext, createContext, createSignal, createRenderEffect, on, startTransition, resetErrorBoundaries, batch, untrack, createComponent, children, Show, createRoot, onMount, Suspense, catchError, ErrorBoundary as ErrorBoundary$1 } from "solid-js";
import { join } from "pathe";
import { createRouter as createRouter$1 } from "radix3";
import { fromJSON, crossSerializeStream, getCrossReferenceHeader } from "seroval";
import { CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin } from "seroval-plugins/web";
import { getRequestIP, parseCookies, defineHandler, H3, redirect, getCookie, setCookie } from "h3";
import { provideRequestEvent } from "solid-js/web/storage";
import { parseSetCookie } from "cookie-es";
const clientViteManifest = { "_components-CwRSaeMZ.js": { "file": "_build/assets/components-CwRSaeMZ.js", "name": "components", "imports": ["_web-3CXXUvn2.js", "_routing-BAdm3AlB.js"] }, "_index-2LuDRfsK.js": { "file": "_build/assets/index-2LuDRfsK.js", "name": "index", "imports": ["_web-3CXXUvn2.js", "_store-BNkRYQcv.js"] }, "_index-BjPOx_9X.js": { "file": "_build/assets/index-BjPOx_9X.js", "name": "index", "imports": ["_index-CWPSdj5C.js"] }, "_index-CWPSdj5C.js": { "file": "_build/assets/index-CWPSdj5C.js", "name": "index", "imports": ["_web-3CXXUvn2.js", "_store-BNkRYQcv.js"] }, "_protoParser-D7ZfkgV5.js": { "file": "_build/assets/protoParser-D7ZfkgV5.js", "name": "protoParser", "imports": ["_index-CWPSdj5C.js"] }, "_routing-BAdm3AlB.js": { "file": "_build/assets/routing-BAdm3AlB.js", "name": "routing", "imports": ["_web-3CXXUvn2.js"] }, "_store-BNkRYQcv.js": { "file": "_build/assets/store-BNkRYQcv.js", "name": "store", "imports": ["_web-3CXXUvn2.js"] }, "_web-3CXXUvn2.js": { "file": "_build/assets/web-3CXXUvn2.js", "name": "web" }, "src/entry-client.tsx": { "file": "_build/assets/entry-client-D2Cv7ptw.js", "name": "entry-client", "src": "src/entry-client.tsx", "isEntry": true, "imports": ["_web-3CXXUvn2.js", "_routing-BAdm3AlB.js"], "dynamicImports": ["src/routes/[...404].tsx?pick=default&pick=$css", "src/routes/[...404].tsx?pick=default&pick=$css", "src/routes/about.tsx?pick=default&pick=$css", "src/routes/about.tsx?pick=default&pick=$css", "src/routes/index.tsx?pick=default&pick=$css", "src/routes/index.tsx?pick=default&pick=$css", "src/routes/requests.tsx?pick=default&pick=$css", "src/routes/requests.tsx?pick=default&pick=$css", "src/routes/connections/index.tsx?pick=default&pick=$css", "src/routes/connections/index.tsx?pick=default&pick=$css", "src/routes/dashboards/[id].tsx?pick=default&pick=$css", "src/routes/dashboards/[id].tsx?pick=default&pick=$css", "src/routes/dashboards/index.tsx?pick=default&pick=$css", "src/routes/dashboards/index.tsx?pick=default&pick=$css", "src/routes/database/[db].tsx?pick=default&pick=$css", "src/routes/database/[db].tsx?pick=default&pick=$css", "src/routes/database/index.tsx?pick=default&pick=$css", "src/routes/database/index.tsx?pick=default&pick=$css", "src/routes/p/[id].tsx?pick=default&pick=$css", "src/routes/p/[id].tsx?pick=default&pick=$css", "src/routes/protos/index.tsx?pick=default&pick=$css", "src/routes/protos/index.tsx?pick=default&pick=$css", "src/routes/workflows/[id].tsx?pick=default&pick=$css", "src/routes/workflows/[id].tsx?pick=default&pick=$css", "src/routes/workflows/index.tsx?pick=default&pick=$css", "src/routes/workflows/index.tsx?pick=default&pick=$css"], "css": ["_build/assets/entry-client-Cn1yPxNC.css"] }, "src/routes/[...404].tsx?pick=default&pick=$css": { "file": "_build/assets/_...404_-Coj0m3md.js", "name": "_...404_", "src": "src/routes/[...404].tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_components-CwRSaeMZ.js", "_routing-BAdm3AlB.js"] }, "src/routes/about.tsx?pick=default&pick=$css": { "file": "_build/assets/about-BCoaRiTf.js", "name": "about", "src": "src/routes/about.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_components-CwRSaeMZ.js", "_routing-BAdm3AlB.js"] }, "src/routes/connections/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-K4e44CYT.js", "name": "index", "src": "src/routes/connections/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js"] }, "src/routes/dashboards/[id].tsx?pick=default&pick=$css": { "file": "_build/assets/_id_-C0rVuuEH.js", "name": "_id_", "src": "src/routes/dashboards/[id].tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_store-BNkRYQcv.js", "_index-CWPSdj5C.js", "_index-BjPOx_9X.js", "_routing-BAdm3AlB.js", "_components-CwRSaeMZ.js"] }, "src/routes/dashboards/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-CWUJgN-d.js", "name": "index", "src": "src/routes/dashboards/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_routing-BAdm3AlB.js"] }, "src/routes/database/[db].tsx?pick=default&pick=$css": { "file": "_build/assets/_db_-COUs_QKu.js", "name": "_db_", "src": "src/routes/database/[db].tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_index-2LuDRfsK.js", "_routing-BAdm3AlB.js", "_components-CwRSaeMZ.js", "_store-BNkRYQcv.js"] }, "src/routes/database/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-DohhPoD_.js", "name": "index", "src": "src/routes/database/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js"] }, "src/routes/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-CzeZrMqh.js", "name": "index", "src": "src/routes/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js"] }, "src/routes/p/[id].tsx?pick=default&pick=$css": { "file": "_build/assets/_id_-edVuPRhd.js", "name": "_id_", "src": "src/routes/p/[id].tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_index-CWPSdj5C.js", "_index-BjPOx_9X.js", "_routing-BAdm3AlB.js", "_store-BNkRYQcv.js"] }, "src/routes/protos/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-Fo1ynpQQ.js", "name": "index", "src": "src/routes/protos/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js"] }, "src/routes/requests.tsx?pick=default&pick=$css": { "file": "_build/assets/requests-BHvr_-B9.js", "name": "requests", "src": "src/routes/requests.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_protoParser-D7ZfkgV5.js", "_index-CWPSdj5C.js", "_index-2LuDRfsK.js", "_store-BNkRYQcv.js"] }, "src/routes/workflows/[id].tsx?pick=default&pick=$css": { "file": "_build/assets/_id_-BM0erTfi.js", "name": "_id_", "src": "src/routes/workflows/[id].tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js", "_store-BNkRYQcv.js", "_protoParser-D7ZfkgV5.js", "_index-CWPSdj5C.js", "_routing-BAdm3AlB.js"] }, "src/routes/workflows/index.tsx?pick=default&pick=$css": { "file": "_build/assets/index-kQGJPbr8.js", "name": "index", "src": "src/routes/workflows/index.tsx?pick=default&pick=$css", "isEntry": true, "isDynamicEntry": true, "imports": ["_web-3CXXUvn2.js"] } };
function getSsrProdManifest() {
  const viteManifest = clientViteManifest;
  return {
    path(id) {
      if (id.startsWith("./")) id = id.slice(2);
      const viteManifestEntry = clientViteManifest[
        id
        /*import.meta.env.START_CLIENT_ENTRY*/
      ];
      if (!viteManifestEntry) throw new Error(`No entry found in vite manifest for '${id}'`);
      return join("/", viteManifestEntry.file);
    },
    async getAssets(id) {
      if (id.startsWith("./")) id = id.slice(2);
      return createHtmlTagsForAssets(findAssetsInViteManifest(clientViteManifest, id));
    },
    async json() {
      const json = {};
      const entryKeys = Object.keys(viteManifest).filter((id) => viteManifest[id]?.isEntry || viteManifest[id]?.isDynamicEntry).map((id) => id);
      for (const entryKey of entryKeys) {
        json[entryKey] = {
          output: join("/", viteManifest[entryKey].file),
          assets: await this.getAssets(entryKey)
        };
      }
      return json;
    }
  };
}
function createHtmlTagsForAssets(assets) {
  return assets.filter((asset) => asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".ts") || asset.endsWith(".mjs")).map((asset) => ({
    tag: "link",
    attrs: {
      href: "/" + asset,
      key: asset,
      ...asset.endsWith(".css") ? {
        rel: "stylesheet"
      } : {
        rel: "modulepreload"
      }
    }
  }));
}
const entryId = "./src/entry-client.tsx".slice(2);
let entryImports = void 0;
function findAssetsInViteManifest(manifest2, id, assetMap2 = /* @__PURE__ */ new Map(), stack = []) {
  if (stack.includes(id)) {
    return [];
  }
  const cached = assetMap2.get(id);
  if (cached) {
    return cached;
  }
  const chunk = manifest2[id];
  if (!chunk) {
    return [];
  }
  if (!entryImports) {
    entryImports = [entryId, ...manifest2[entryId]?.imports ?? []];
  }
  const excludeEntryImports = id !== entryId;
  const assets = chunk.css?.filter(Boolean) || [];
  if (chunk.imports) {
    stack.push(id);
    for (let i = 0, l = chunk.imports.length; i < l; i++) {
      const importId = chunk.imports[i];
      if (!importId || excludeEntryImports && entryImports.includes(importId)) continue;
      assets.push(...findAssetsInViteManifest(manifest2, importId, assetMap2, stack));
    }
    stack.pop();
  }
  assets.push(chunk.file);
  const all = Array.from(new Set(assets));
  assetMap2.set(id, all);
  return all;
}
function getSsrManifest(target) {
  return getSsrProdManifest();
}
var _tmpl$$4 = " ";
const assetMap = {
  style: (props) => ssrElement("style", props.attrs, () => props.children, true),
  link: (props) => ssrElement("link", props.attrs, void 0, true),
  script: (props) => {
    return props.attrs.src ? ssrElement("script", mergeProps(() => props.attrs, {
      get id() {
        return props.key;
      }
    }), () => ssr(_tmpl$$4), true) : null;
  },
  noscript: (props) => ssrElement("noscript", props.attrs, () => escape(props.children), true)
};
function renderAsset(asset, nonce) {
  let {
    tag,
    attrs: {
      key,
      ...attrs
    } = {
      key: void 0
    },
    children: children2
  } = asset;
  return assetMap[tag]({
    attrs: {
      ...attrs,
      nonce
    },
    key,
    children: children2
  });
}
const REGISTRY = /* @__PURE__ */ Symbol("assetRegistry");
const NOOP = () => "";
const keyAttrs = ["href", "rel", "data-vite-dev-id"];
const getEntity = (registry, asset) => {
  let key = asset.tag;
  for (const k of keyAttrs) {
    if (!(k in asset.attrs)) continue;
    key += `[${k}='${asset.attrs[k]}']`;
  }
  const entity = registry[key] ??= {
    key,
    consumers: 0
  };
  return entity;
};
const useAssets = (assets, nonce) => {
  if (!assets.length) return;
  const registry = getRequestEvent().locals[REGISTRY] ??= {};
  const ssrRequestAssets = sharedConfig.context?.assets;
  const cssKeys = [];
  for (const asset of assets) {
    const entity = getEntity(registry, asset);
    const isCSSLink = asset.tag === "link" && asset.attrs.rel === "stylesheet";
    const isCSS = isCSSLink || asset.tag === "style";
    if (isCSS) {
      cssKeys.push(entity.key);
    }
    entity.consumers++;
    if (entity.consumers > 1) continue;
    useAssets$1(() => renderAsset(asset, nonce));
    entity.ssrIdx = ssrRequestAssets.length - 1;
  }
  onCleanup(() => {
    for (const key of cssKeys) {
      const entity = registry[key];
      entity.consumers--;
      if (entity.consumers != 0) {
        continue;
      }
      ssrRequestAssets.splice(entity.ssrIdx, 1, NOOP);
      delete registry[key];
    }
  });
};
const assetsById = {};
const getAssets = async (id) => {
  if (assetsById[id]) return assetsById[id];
  const manifest2 = getSsrManifest();
  const assets = await manifest2.getAssets(id);
  assetsById[id] = assets;
  return assets;
};
const withAssets = function(fn) {
  const wrapper = async () => {
    const mod = await fn();
    const id = mod.id$$;
    if (!id) return mod;
    if (!mod.default) {
      console.error(`Module ${id} does not export default`);
      return {
        default: () => []
      };
    }
    const assets = await getAssets(id);
    if (!assets.length) return mod;
    return {
      default: (props) => {
        const {
          nonce
        } = getRequestEvent();
        useAssets(assets, nonce);
        return mod.default(props);
      }
    };
  };
  return wrapper;
};
const lazy = !isServer ? lazy$1 : (fn) => lazy$1(withAssets(fn));
function createBeforeLeave() {
  let listeners = /* @__PURE__ */ new Set();
  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  let ignore = false;
  function confirm(to, options) {
    if (ignore) return !(ignore = false);
    const e = {
      to,
      options,
      defaultPrevented: false,
      preventDefault: () => e.defaultPrevented = true
    };
    for (const l of listeners) l.listener({
      ...e,
      from: l.location,
      retry: (force) => {
        force && (ignore = true);
        l.navigate(to, {
          ...options,
          resolve: false
        });
      }
    });
    return !e.defaultPrevented;
  }
  return {
    subscribe,
    confirm
  };
}
let depth;
function saveCurrentDepth() {
  if (!window.history.state || window.history.state._depth == null) {
    window.history.replaceState({
      ...window.history.state,
      _depth: window.history.length - 1
    }, "");
  }
  depth = window.history.state._depth;
}
if (!isServer) {
  saveCurrentDepth();
}
function keepDepth(state) {
  return {
    ...state,
    _depth: window.history.state && window.history.state._depth
  };
}
function notifyIfNotBlocked(notify, block) {
  let ignore = false;
  return () => {
    const prevDepth = depth;
    saveCurrentDepth();
    const delta = prevDepth == null ? null : depth - prevDepth;
    if (ignore) {
      ignore = false;
      return;
    }
    if (delta && block(delta)) {
      ignore = true;
      window.history.go(-delta);
    } else {
      notify();
    }
  };
}
const hasSchemeRegex = /^(?:[a-z0-9]+:)?\/\//i;
const trimPathRegex = /^\/+|(\/)\/+$/g;
const mockBase = "http://sr";
function normalizePath(path, omitSlash = false) {
  const s = path.replace(trimPathRegex, "$1");
  return s ? omitSlash || /^[?#]/.test(s) ? s : "/" + s : "";
}
function resolvePath(base, path, from) {
  if (hasSchemeRegex.test(path)) {
    return void 0;
  }
  const basePath = normalizePath(base);
  const fromPath = from && normalizePath(from);
  let result = "";
  if (!fromPath || path.startsWith("/")) {
    result = basePath;
  } else if (fromPath.toLowerCase().indexOf(basePath.toLowerCase()) !== 0) {
    result = basePath + fromPath;
  } else {
    result = fromPath;
  }
  return (result || "/") + normalizePath(path, !result);
}
function invariant(value, message) {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}
function joinPaths(from, to) {
  return normalizePath(from).replace(/\/*(\*.*)?$/g, "") + normalizePath(to);
}
function extractSearchParams(url) {
  const params = {};
  url.searchParams.forEach((value, key) => {
    if (key in params) {
      if (Array.isArray(params[key])) params[key].push(value);
      else params[key] = [params[key], value];
    } else params[key] = value;
  });
  return params;
}
function createMatcher(path, partial, matchFilters) {
  const [pattern, splat] = path.split("/*", 2);
  const segments = pattern.split("/").filter(Boolean);
  const len = segments.length;
  return (location) => {
    const locSegments = location.split("/").filter(Boolean);
    const lenDiff = locSegments.length - len;
    if (lenDiff < 0 || lenDiff > 0 && splat === void 0 && !partial) {
      return null;
    }
    const match = {
      path: len ? "" : "/",
      params: {}
    };
    const matchFilter = (s) => matchFilters === void 0 ? void 0 : matchFilters[s];
    for (let i = 0; i < len; i++) {
      const segment = segments[i];
      const dynamic = segment[0] === ":";
      const locSegment = dynamic ? locSegments[i] : locSegments[i].toLowerCase();
      const key = dynamic ? segment.slice(1) : segment.toLowerCase();
      if (dynamic && matchSegment(locSegment, matchFilter(key))) {
        match.params[key] = locSegment;
      } else if (dynamic || !matchSegment(locSegment, key)) {
        return null;
      }
      match.path += `/${locSegment}`;
    }
    if (splat) {
      const remainder = lenDiff ? locSegments.slice(-lenDiff).join("/") : "";
      if (matchSegment(remainder, matchFilter(splat))) {
        match.params[splat] = remainder;
      } else {
        return null;
      }
    }
    return match;
  };
}
function matchSegment(input, filter) {
  const isEqual = (s) => s === input;
  if (filter === void 0) {
    return true;
  } else if (typeof filter === "string") {
    return isEqual(filter);
  } else if (typeof filter === "function") {
    return filter(input);
  } else if (Array.isArray(filter)) {
    return filter.some(isEqual);
  } else if (filter instanceof RegExp) {
    return filter.test(input);
  }
  return false;
}
function scoreRoute(route) {
  const [pattern, splat] = route.pattern.split("/*", 2);
  const segments = pattern.split("/").filter(Boolean);
  return segments.reduce((score, segment) => score + (segment.startsWith(":") ? 2 : 3), segments.length - (splat === void 0 ? 0 : 1));
}
function createMemoObject(fn) {
  const map = /* @__PURE__ */ new Map();
  const owner = getOwner();
  return new Proxy({}, {
    get(_, property) {
      if (!map.has(property)) {
        runWithOwner(owner, () => map.set(property, createMemo(() => fn()[property])));
      }
      return map.get(property)();
    },
    getOwnPropertyDescriptor() {
      return {
        enumerable: true,
        configurable: true
      };
    },
    ownKeys() {
      return Reflect.ownKeys(fn());
    },
    has(_, property) {
      return property in fn();
    }
  });
}
function expandOptionals(pattern) {
  let match = /(\/?\:[^\/]+)\?/.exec(pattern);
  if (!match) return [pattern];
  let prefix = pattern.slice(0, match.index);
  let suffix = pattern.slice(match.index + match[0].length);
  const prefixes = [prefix, prefix += match[1]];
  while (match = /^(\/\:[^\/]+)\?/.exec(suffix)) {
    prefixes.push(prefix += match[1]);
    suffix = suffix.slice(match[0].length);
  }
  return expandOptionals(suffix).reduce((results, expansion) => [...results, ...prefixes.map((p) => p + expansion)], []);
}
const MAX_REDIRECTS = 100;
const RouterContextObj = createContext();
const RouteContextObj = createContext();
const useRouter = () => invariant(useContext(RouterContextObj), "<A> and 'use' router primitives can be only used inside a Route.");
const useRoute = () => useContext(RouteContextObj) || useRouter().base;
const useResolvedPath = (path) => {
  const route = useRoute();
  return createMemo(() => route.resolvePath(path()));
};
const useHref = (to) => {
  const router2 = useRouter();
  return createMemo(() => {
    const to_ = to();
    return to_ !== void 0 ? router2.renderPath(to_) : to_;
  });
};
const useNavigate = () => useRouter().navigatorFactory();
const useLocation = () => useRouter().location;
const useParams = () => useRouter().params;
function createRoutes$1(routeDef, base = "") {
  const {
    component,
    preload,
    load,
    children: children2,
    info
  } = routeDef;
  const isLeaf = !children2 || Array.isArray(children2) && !children2.length;
  const shared = {
    key: routeDef,
    component,
    preload: preload || load,
    info
  };
  return asArray(routeDef.path).reduce((acc, originalPath) => {
    for (const expandedPath of expandOptionals(originalPath)) {
      const path = joinPaths(base, expandedPath);
      let pattern = isLeaf ? path : path.split("/*", 1)[0];
      pattern = pattern.split("/").map((s) => {
        return s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s);
      }).join("/");
      acc.push({
        ...shared,
        originalPath,
        pattern,
        matcher: createMatcher(pattern, !isLeaf, routeDef.matchFilters)
      });
    }
    return acc;
  }, []);
}
function createBranch(routes2, index = 0) {
  return {
    routes: routes2,
    score: scoreRoute(routes2[routes2.length - 1]) * 1e4 - index,
    matcher(location) {
      const matches = [];
      for (let i = routes2.length - 1; i >= 0; i--) {
        const route = routes2[i];
        const match = route.matcher(location);
        if (!match) {
          return null;
        }
        matches.unshift({
          ...match,
          route
        });
      }
      return matches;
    }
  };
}
function asArray(value) {
  return Array.isArray(value) ? value : [value];
}
function createBranches(routeDef, base = "", stack = [], branches = []) {
  const routeDefs = asArray(routeDef);
  for (let i = 0, len = routeDefs.length; i < len; i++) {
    const def = routeDefs[i];
    if (def && typeof def === "object") {
      if (!def.hasOwnProperty("path")) def.path = "";
      const routes2 = createRoutes$1(def, base);
      for (const route of routes2) {
        stack.push(route);
        const isEmptyArray = Array.isArray(def.children) && def.children.length === 0;
        if (def.children && !isEmptyArray) {
          createBranches(def.children, route.pattern, stack, branches);
        } else {
          const branch = createBranch([...stack], branches.length);
          branches.push(branch);
        }
        stack.pop();
      }
    }
  }
  return stack.length ? branches : branches.sort((a, b) => b.score - a.score);
}
function getRouteMatches(branches, location) {
  for (let i = 0, len = branches.length; i < len; i++) {
    const match = branches[i].matcher(location);
    if (match) {
      return match;
    }
  }
  return [];
}
function createLocation(path, state, queryWrapper) {
  const origin = new URL(mockBase);
  const url = createMemo((prev) => {
    const path_ = path();
    try {
      return new URL(path_, origin);
    } catch (err) {
      console.error(`Invalid path ${path_}`);
      return prev;
    }
  }, origin, {
    equals: (a, b) => a.href === b.href
  });
  const pathname = createMemo(() => url().pathname);
  const search = createMemo(() => url().search, true);
  const hash = createMemo(() => url().hash);
  const key = () => "";
  const queryFn = on(search, () => extractSearchParams(url()));
  return {
    get pathname() {
      return pathname();
    },
    get search() {
      return search();
    },
    get hash() {
      return hash();
    },
    get state() {
      return state();
    },
    get key() {
      return key();
    },
    query: queryWrapper ? queryWrapper(queryFn) : createMemoObject(queryFn)
  };
}
let intent;
function getIntent() {
  return intent;
}
function createRouterContext(integration, branches, getContext, options = {}) {
  const {
    signal: [source, setSource],
    utils = {}
  } = integration;
  const parsePath = utils.parsePath || ((p) => p);
  const renderPath = utils.renderPath || ((p) => p);
  const beforeLeave = utils.beforeLeave || createBeforeLeave();
  const basePath = resolvePath("", options.base || "");
  if (basePath === void 0) {
    throw new Error(`${basePath} is not a valid base path`);
  } else if (basePath && !source().value) {
    setSource({
      value: basePath,
      replace: true,
      scroll: false
    });
  }
  const [isRouting, setIsRouting] = createSignal(false);
  let lastTransitionTarget;
  const transition = (newIntent, newTarget) => {
    if (newTarget.value === reference() && newTarget.state === state()) return;
    if (lastTransitionTarget === void 0) setIsRouting(true);
    intent = newIntent;
    lastTransitionTarget = newTarget;
    startTransition(() => {
      if (lastTransitionTarget !== newTarget) return;
      setReference(lastTransitionTarget.value);
      setState(lastTransitionTarget.state);
      resetErrorBoundaries();
      if (!isServer) submissions[1]((subs) => subs.filter((s) => s.pending));
    }).finally(() => {
      if (lastTransitionTarget !== newTarget) return;
      batch(() => {
        intent = void 0;
        if (newIntent === "navigate") navigateEnd(lastTransitionTarget);
        setIsRouting(false);
        lastTransitionTarget = void 0;
      });
    });
  };
  const [reference, setReference] = createSignal(source().value);
  const [state, setState] = createSignal(source().state);
  const location = createLocation(reference, state, utils.queryWrapper);
  const referrers = [];
  const submissions = createSignal(isServer ? initFromFlash2() : []);
  const matches = createMemo(() => {
    if (typeof options.transformUrl === "function") {
      return getRouteMatches(branches(), options.transformUrl(location.pathname));
    }
    return getRouteMatches(branches(), location.pathname);
  });
  const buildParams = () => {
    const m = matches();
    const params2 = {};
    for (let i = 0; i < m.length; i++) {
      Object.assign(params2, m[i].params);
    }
    return params2;
  };
  const params = utils.paramsWrapper ? utils.paramsWrapper(buildParams, branches) : createMemoObject(buildParams);
  const baseRoute = {
    pattern: basePath,
    path: () => basePath,
    outlet: () => null,
    resolvePath(to) {
      return resolvePath(basePath, to);
    }
  };
  createRenderEffect(on(source, (source2) => transition("native", source2), {
    defer: true
  }));
  return {
    base: baseRoute,
    location,
    params,
    isRouting,
    renderPath,
    parsePath,
    navigatorFactory,
    matches,
    beforeLeave,
    preloadRoute,
    singleFlight: options.singleFlight === void 0 ? true : options.singleFlight,
    submissions
  };
  function navigateFromRoute(route, to, options2) {
    untrack(() => {
      if (typeof to === "number") {
        if (!to) ;
        else if (utils.go) {
          utils.go(to);
        } else {
          console.warn("Router integration does not support relative routing");
        }
        return;
      }
      const queryOnly = !to || to[0] === "?";
      const {
        replace,
        resolve,
        scroll,
        state: nextState
      } = {
        replace: false,
        resolve: !queryOnly,
        scroll: true,
        ...options2
      };
      const resolvedTo = resolve ? route.resolvePath(to) : resolvePath(queryOnly && location.pathname || "", to);
      if (resolvedTo === void 0) {
        throw new Error(`Path '${to}' is not a routable path`);
      } else if (referrers.length >= MAX_REDIRECTS) {
        throw new Error("Too many redirects");
      }
      const current = reference();
      if (resolvedTo !== current || nextState !== state()) {
        if (isServer) {
          const e = getRequestEvent();
          e && (e.response = {
            status: 302,
            headers: new Headers({
              Location: resolvedTo
            })
          });
          setSource({
            value: resolvedTo,
            replace,
            scroll,
            state: nextState
          });
        } else if (beforeLeave.confirm(resolvedTo, options2)) {
          referrers.push({
            value: current,
            replace,
            scroll,
            state: state()
          });
          transition("navigate", {
            value: resolvedTo,
            state: nextState
          });
        }
      }
    });
  }
  function navigatorFactory(route) {
    route = route || useContext(RouteContextObj) || baseRoute;
    return (to, options2) => navigateFromRoute(route, to, options2);
  }
  function navigateEnd(next) {
    const first = referrers[0];
    if (first) {
      setSource({
        ...next,
        replace: first.replace,
        scroll: first.scroll
      });
      referrers.length = 0;
    }
  }
  function preloadRoute(url, preloadData) {
    const matches2 = getRouteMatches(branches(), url.pathname);
    const prevIntent = intent;
    intent = "preload";
    for (let match in matches2) {
      const {
        route,
        params: params2
      } = matches2[match];
      route.component && route.component.preload && route.component.preload();
      const {
        preload
      } = route;
      preloadData && preload && runWithOwner(getContext(), () => preload({
        params: params2,
        location: {
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
          query: extractSearchParams(url),
          state: null,
          key: ""
        },
        intent: "preload"
      }));
    }
    intent = prevIntent;
  }
  function initFromFlash2() {
    const e = getRequestEvent();
    return e && e.router && e.router.submission ? [e.router.submission] : [];
  }
}
function createRouteContext(router2, parent, outlet, match) {
  const {
    base,
    location,
    params
  } = router2;
  const {
    pattern,
    component,
    preload
  } = match().route;
  const path = createMemo(() => match().path);
  component && component.preload && component.preload();
  const data = preload ? preload({
    params,
    location,
    intent: intent || "initial"
  }) : void 0;
  const route = {
    parent,
    pattern,
    path,
    outlet: () => component ? createComponent(component, {
      params,
      location,
      data,
      get children() {
        return outlet();
      }
    }) : outlet(),
    resolvePath(to) {
      return resolvePath(base.path(), to, path());
    }
  };
  return route;
}
const createRouterComponent = (router2) => (props) => {
  const {
    base
  } = props;
  const routeDefs = children(() => props.children);
  const branches = createMemo(() => createBranches(routeDefs(), props.base || ""));
  let context;
  const routerState = createRouterContext(router2, branches, () => context, {
    base,
    singleFlight: props.singleFlight,
    transformUrl: props.transformUrl
  });
  router2.create && router2.create(routerState);
  return createComponent$1(RouterContextObj.Provider, {
    value: routerState,
    get children() {
      return createComponent$1(Root, {
        routerState,
        get root() {
          return props.root;
        },
        get preload() {
          return props.rootPreload || props.rootLoad;
        },
        get children() {
          return [(context = getOwner()) && null, createComponent$1(Routes, {
            routerState,
            get branches() {
              return branches();
            }
          })];
        }
      });
    }
  });
};
function Root(props) {
  const location = props.routerState.location;
  const params = props.routerState.params;
  const data = createMemo(() => props.preload && untrack(() => {
    props.preload({
      params,
      location,
      intent: getIntent() || "initial"
    });
  }));
  return createComponent$1(Show, {
    get when() {
      return props.root;
    },
    keyed: true,
    get fallback() {
      return props.children;
    },
    children: (Root2) => createComponent$1(Root2, {
      params,
      location,
      get data() {
        return data();
      },
      get children() {
        return props.children;
      }
    })
  });
}
function Routes(props) {
  if (isServer) {
    const e = getRequestEvent();
    if (e && e.router && e.router.dataOnly) {
      dataOnly(e, props.routerState, props.branches);
      return;
    }
    e && ((e.router || (e.router = {})).matches || (e.router.matches = props.routerState.matches().map(({
      route,
      path,
      params
    }) => ({
      path: route.originalPath,
      pattern: route.pattern,
      match: path,
      params,
      info: route.info
    }))));
  }
  const disposers = [];
  let root;
  const routeStates = createMemo(on(props.routerState.matches, (nextMatches, prevMatches, prev) => {
    let equal = prevMatches && nextMatches.length === prevMatches.length;
    const next = [];
    for (let i = 0, len = nextMatches.length; i < len; i++) {
      const prevMatch = prevMatches && prevMatches[i];
      const nextMatch = nextMatches[i];
      if (prev && prevMatch && nextMatch.route.key === prevMatch.route.key) {
        next[i] = prev[i];
      } else {
        equal = false;
        if (disposers[i]) {
          disposers[i]();
        }
        createRoot((dispose) => {
          disposers[i] = dispose;
          next[i] = createRouteContext(props.routerState, next[i - 1] || props.routerState.base, createOutlet(() => routeStates()[i + 1]), () => {
            const routeMatches = props.routerState.matches();
            return routeMatches[i] ?? routeMatches[0];
          });
        });
      }
    }
    disposers.splice(nextMatches.length).forEach((dispose) => dispose());
    if (prev && equal) {
      return prev;
    }
    root = next[0];
    return next;
  }));
  return createOutlet(() => routeStates() && root)();
}
const createOutlet = (child) => {
  return () => createComponent$1(Show, {
    get when() {
      return child();
    },
    keyed: true,
    children: (child2) => createComponent$1(RouteContextObj.Provider, {
      value: child2,
      get children() {
        return child2.outlet();
      }
    })
  });
};
function dataOnly(event, routerState, branches) {
  const url = new URL(event.request.url);
  const prevMatches = getRouteMatches(branches, new URL(event.router.previousUrl || event.request.url).pathname);
  const matches = getRouteMatches(branches, url.pathname);
  for (let match = 0; match < matches.length; match++) {
    if (!prevMatches[match] || matches[match].route !== prevMatches[match].route) event.router.dataOnly = true;
    const {
      route,
      params
    } = matches[match];
    route.preload && route.preload({
      params,
      location: routerState.location,
      intent: "preload"
    });
  }
}
function intercept([value, setValue], get, set) {
  return [value, set ? (v) => setValue(set(v)) : setValue];
}
function createRouter(config) {
  let ignore = false;
  const wrap = (value) => typeof value === "string" ? {
    value
  } : value;
  const signal = intercept(createSignal(wrap(config.get()), {
    equals: (a, b) => a.value === b.value && a.state === b.state
  }), void 0, (next) => {
    !ignore && config.set(next);
    if (sharedConfig.registry && !sharedConfig.done) sharedConfig.done = true;
    return next;
  });
  config.init && onCleanup(config.init((value = config.get()) => {
    ignore = true;
    signal[1](wrap(value));
    ignore = false;
  }));
  return createRouterComponent({
    signal,
    create: config.create,
    utils: config.utils
  });
}
function bindEvent(target, type, handler) {
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}
function scrollToHash(hash, fallbackTop) {
  const el = hash && document.getElementById(hash);
  if (el) {
    el.scrollIntoView();
  } else if (fallbackTop) {
    window.scrollTo(0, 0);
  }
}
function getPath(url) {
  const u = new URL(url);
  return u.pathname + u.search;
}
function StaticRouter(props) {
  let e;
  const obj = {
    value: props.url || (e = getRequestEvent()) && getPath(e.request.url) || ""
  };
  return createRouterComponent({
    signal: [() => obj, (next) => Object.assign(obj, next)]
  })(props);
}
const actions = /* @__PURE__ */ new Map();
function setupNativeEvents({
  preload = true,
  explicitLinks = false,
  actionBase = "/_server",
  transformUrl
} = {}) {
  return (router2) => {
    const basePath = router2.base.path();
    const navigateFromRoute = router2.navigatorFactory(router2.base);
    let preloadTimeout;
    let lastElement;
    function isSvg(el) {
      return el.namespaceURI === "http://www.w3.org/2000/svg";
    }
    function handleAnchor(evt) {
      if (evt.defaultPrevented || evt.button !== 0 || evt.metaKey || evt.altKey || evt.ctrlKey || evt.shiftKey) return;
      const a = evt.composedPath().find((el) => el instanceof Node && el.nodeName.toUpperCase() === "A");
      if (!a || explicitLinks && !a.hasAttribute("link")) return;
      const svg = isSvg(a);
      const href = svg ? a.href.baseVal : a.href;
      const target = svg ? a.target.baseVal : a.target;
      if (target || !href && !a.hasAttribute("state")) return;
      const rel = (a.getAttribute("rel") || "").split(/\s+/);
      if (a.hasAttribute("download") || rel && rel.includes("external")) return;
      const url = svg ? new URL(href, document.baseURI) : new URL(href);
      if (url.origin !== window.location.origin || basePath && url.pathname && !url.pathname.toLowerCase().startsWith(basePath.toLowerCase())) return;
      return [a, url];
    }
    function handleAnchorClick(evt) {
      const res = handleAnchor(evt);
      if (!res) return;
      const [a, url] = res;
      const to = router2.parsePath(url.pathname + url.search + url.hash);
      const state = a.getAttribute("state");
      evt.preventDefault();
      navigateFromRoute(to, {
        resolve: false,
        replace: a.hasAttribute("replace"),
        scroll: !a.hasAttribute("noscroll"),
        state: state ? JSON.parse(state) : void 0
      });
    }
    function handleAnchorPreload(evt) {
      const res = handleAnchor(evt);
      if (!res) return;
      const [a, url] = res;
      transformUrl && (url.pathname = transformUrl(url.pathname));
      router2.preloadRoute(url, a.getAttribute("preload") !== "false");
    }
    function handleAnchorMove(evt) {
      clearTimeout(preloadTimeout);
      const res = handleAnchor(evt);
      if (!res) return lastElement = null;
      const [a, url] = res;
      if (lastElement === a) return;
      transformUrl && (url.pathname = transformUrl(url.pathname));
      preloadTimeout = setTimeout(() => {
        router2.preloadRoute(url, a.getAttribute("preload") !== "false");
        lastElement = a;
      }, 20);
    }
    function handleFormSubmit(evt) {
      if (evt.defaultPrevented) return;
      let actionRef = evt.submitter && evt.submitter.hasAttribute("formaction") ? evt.submitter.getAttribute("formaction") : evt.target.getAttribute("action");
      if (!actionRef) return;
      if (!actionRef.startsWith("https://action/")) {
        const url = new URL(actionRef, mockBase);
        actionRef = router2.parsePath(url.pathname + url.search);
        if (!actionRef.startsWith(actionBase)) return;
      }
      if (evt.target.method.toUpperCase() !== "POST") throw new Error("Only POST forms are supported for Actions");
      const handler = actions.get(actionRef);
      if (handler) {
        evt.preventDefault();
        const data = new FormData(evt.target, evt.submitter);
        handler.call({
          r: router2,
          f: evt.target
        }, evt.target.enctype === "multipart/form-data" ? data : new URLSearchParams(data));
      }
    }
    delegateEvents(["click", "submit"]);
    document.addEventListener("click", handleAnchorClick);
    if (preload) {
      document.addEventListener("mousemove", handleAnchorMove, {
        passive: true
      });
      document.addEventListener("focusin", handleAnchorPreload, {
        passive: true
      });
      document.addEventListener("touchstart", handleAnchorPreload, {
        passive: true
      });
    }
    document.addEventListener("submit", handleFormSubmit);
    onCleanup(() => {
      document.removeEventListener("click", handleAnchorClick);
      if (preload) {
        document.removeEventListener("mousemove", handleAnchorMove);
        document.removeEventListener("focusin", handleAnchorPreload);
        document.removeEventListener("touchstart", handleAnchorPreload);
      }
      document.removeEventListener("submit", handleFormSubmit);
    });
  };
}
function Router(props) {
  if (isServer) return StaticRouter(props);
  const getSource = () => {
    const url = window.location.pathname.replace(/^\/+/, "/") + window.location.search;
    const state = window.history.state && window.history.state._depth && Object.keys(window.history.state).length === 1 ? void 0 : window.history.state;
    return {
      value: url + window.location.hash,
      state
    };
  };
  const beforeLeave = createBeforeLeave();
  return createRouter({
    get: getSource,
    set({
      value,
      replace,
      scroll,
      state
    }) {
      if (replace) {
        window.history.replaceState(keepDepth(state), "", value);
      } else {
        window.history.pushState(state, "", value);
      }
      scrollToHash(decodeURIComponent(window.location.hash.slice(1)), scroll);
      saveCurrentDepth();
    },
    init: (notify) => bindEvent(window, "popstate", notifyIfNotBlocked(notify, (delta) => {
      if (delta) {
        return !beforeLeave.confirm(delta);
      } else {
        const s = getSource();
        return !beforeLeave.confirm(s.value, {
          state: s.state
        });
      }
    })),
    create: setupNativeEvents({
      preload: props.preload,
      explicitLinks: props.explicitLinks,
      actionBase: props.actionBase,
      transformUrl: props.transformUrl
    }),
    utils: {
      go: (delta) => window.history.go(delta),
      beforeLeave
    }
  })(props);
}
const fileRoutes = [{ "page": true, "$component": { "src": "src/routes/[...404].tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_...404_-R2HCm90c.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_...404_-R2HCm90c.js"
) }, "path": "/*404" }, { "page": true, "$component": { "src": "src/routes/about.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/about-k65Gi6lo.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/about-k65Gi6lo.js"
) }, "path": "/about" }, { "page": false, "$GET": { "src": "src/routes/health.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/health-DlRq_6NL.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/health-DlRq_6NL.js"
) }, "$HEAD": { "src": "src/routes/health.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/health-DlRq_6NL.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/health-DlRq_6NL.js"
) }, "path": "/health" }, { "page": true, "$component": { "src": "src/routes/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-4X0MzDNU.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-4X0MzDNU.js"
) }, "path": "/" }, { "page": true, "$component": { "src": "src/routes/requests.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/requests-hHb383xw.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/requests-hHb383xw.js"
) }, "path": "/requests" }, { "page": false, "$POST": { "src": "src/routes/api/grpc.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/grpc-DodanEtS.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/grpc-DodanEtS.js"
) }, "path": "/api/grpc" }, { "page": false, "$GET": { "src": "src/routes/api/health.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/health-CUAOk9Hr.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/health-CUAOk9Hr.js"
) }, "$HEAD": { "src": "src/routes/api/health.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/health-CUAOk9Hr.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/health-CUAOk9Hr.js"
) }, "path": "/api/health" }, { "page": true, "$component": { "src": "src/routes/connections/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DdxNxgBB.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DdxNxgBB.js"
) }, "path": "/connections/" }, { "page": true, "$component": { "src": "src/routes/dashboards/[id].tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-D-KQPs6f.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-D-KQPs6f.js"
) }, "path": "/dashboards/:id" }, { "page": true, "$component": { "src": "src/routes/dashboards/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DveKGneN.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DveKGneN.js"
) }, "path": "/dashboards/" }, { "page": true, "$component": { "src": "src/routes/database/[db].tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_db_-DQOz63em.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_db_-DQOz63em.js"
) }, "path": "/database/:db" }, { "page": true, "$component": { "src": "src/routes/database/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BFTcs6yI.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BFTcs6yI.js"
) }, "path": "/database/" }, { "page": true, "$component": { "src": "src/routes/p/[id].tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-BSIAuzRN.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-BSIAuzRN.js"
) }, "path": "/p/:id" }, { "page": true, "$component": { "src": "src/routes/protos/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Cu-UtF0w.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Cu-UtF0w.js"
) }, "path": "/protos/" }, { "page": true, "$component": { "src": "src/routes/workflows/[id].tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-Bjr0Jqos.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-Bjr0Jqos.js"
) }, "path": "/workflows/:id" }, { "page": true, "$component": { "src": "src/routes/workflows/index.tsx?pick=default&pick=$css", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BPpV8xRz.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BPpV8xRz.js"
) }, "path": "/workflows/" }, { "page": false, "$GET": { "src": "src/routes/api/auth/[...solidauth].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-BCuQeedD.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-BCuQeedD.js"
) }, "$HEAD": { "src": "src/routes/api/auth/[...solidauth].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-BCuQeedD.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-BCuQeedD.js"
) }, "$POST": { "src": "src/routes/api/auth/[...solidauth].ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-CcNQu43f.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_...solidauth_-CcNQu43f.js"
) }, "path": "/api/auth/*solidauth" }, { "page": false, "$DELETE": { "src": "src/routes/api/connections/[id].ts?pick=DELETE", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-By8_KaPV.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-By8_KaPV.js"
) }, "$GET": { "src": "src/routes/api/connections/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CoWOLRSe.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CoWOLRSe.js"
) }, "$HEAD": { "src": "src/routes/api/connections/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CoWOLRSe.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CoWOLRSe.js"
) }, "$PUT": { "src": "src/routes/api/connections/[id].ts?pick=PUT", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CwcToce6.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CwcToce6.js"
) }, "path": "/api/connections/:id" }, { "page": false, "$GET": { "src": "src/routes/api/connections/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DxjLeygS.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DxjLeygS.js"
) }, "$HEAD": { "src": "src/routes/api/connections/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DxjLeygS.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DxjLeygS.js"
) }, "$POST": { "src": "src/routes/api/connections/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-D7wd_MJc.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-D7wd_MJc.js"
) }, "path": "/api/connections/" }, { "page": false, "$POST": { "src": "src/routes/api/connections/test-token.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/test-token-FSxWnVgd.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/test-token-FSxWnVgd.js"
) }, "path": "/api/connections/test-token" }, { "page": false, "$GET": { "src": "src/routes/api/dashboards/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1-cP9Sf.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1-cP9Sf.js"
) }, "$HEAD": { "src": "src/routes/api/dashboards/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1-cP9Sf.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1-cP9Sf.js"
) }, "$POST": { "src": "src/routes/api/dashboards/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BKVuHuR_.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BKVuHuR_.js"
) }, "path": "/api/dashboards/" }, { "page": false, "$GET": { "src": "src/routes/api/database/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-fPZxY0G3.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-fPZxY0G3.js"
) }, "$HEAD": { "src": "src/routes/api/database/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-fPZxY0G3.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-fPZxY0G3.js"
) }, "$POST": { "src": "src/routes/api/database/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CzKXOucW.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CzKXOucW.js"
) }, "path": "/api/database/" }, { "page": false, "$DELETE": { "src": "src/routes/api/protos/[id].ts?pick=DELETE", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-BMtopFeK.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-BMtopFeK.js"
) }, "$GET": { "src": "src/routes/api/protos/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CULQehWe.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CULQehWe.js"
) }, "$HEAD": { "src": "src/routes/api/protos/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CULQehWe.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CULQehWe.js"
) }, "$PUT": { "src": "src/routes/api/protos/[id].ts?pick=PUT", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-DTYZ6hJK.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-DTYZ6hJK.js"
) }, "path": "/api/protos/:id" }, { "page": false, "$GET": { "src": "src/routes/api/protos/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CXcdNx5h.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CXcdNx5h.js"
) }, "$HEAD": { "src": "src/routes/api/protos/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CXcdNx5h.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CXcdNx5h.js"
) }, "$POST": { "src": "src/routes/api/protos/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-T93isU7n.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-T93isU7n.js"
) }, "path": "/api/protos/" }, { "page": false, "$GET": { "src": "src/routes/api/workflows/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BBvHSLjT.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BBvHSLjT.js"
) }, "$HEAD": { "src": "src/routes/api/workflows/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BBvHSLjT.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-BBvHSLjT.js"
) }, "$POST": { "src": "src/routes/api/workflows/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CH5L950W.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CH5L950W.js"
) }, "path": "/api/workflows/" }, { "page": false, "$DELETE": { "src": "src/routes/api/dashboards/[id]/index.ts?pick=DELETE", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DYgv6vvz.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-DYgv6vvz.js"
) }, "$GET": { "src": "src/routes/api/dashboards/[id]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1MmM_Tl.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1MmM_Tl.js"
) }, "$HEAD": { "src": "src/routes/api/dashboards/[id]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1MmM_Tl.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C1MmM_Tl.js"
) }, "$PUT": { "src": "src/routes/api/dashboards/[id]/index.ts?pick=PUT", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C9A2D0Wx.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-C9A2D0Wx.js"
) }, "path": "/api/dashboards/:id/" }, { "page": false, "$POST": { "src": "src/routes/api/database/[db]/query.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/query-906QqfWb.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/query-906QqfWb.js"
) }, "path": "/api/database/:db/query" }, { "page": false, "$GET": { "src": "src/routes/api/database/[db]/tables.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/tables-BdnVDVtW.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/tables-BdnVDVtW.js"
) }, "$HEAD": { "src": "src/routes/api/database/[db]/tables.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/tables-BdnVDVtW.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/tables-BdnVDVtW.js"
) }, "path": "/api/database/:db/tables" }, { "page": false, "$DELETE": { "src": "src/routes/api/workflows/[id]/index.ts?pick=DELETE", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Da9lyuuj.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Da9lyuuj.js"
) }, "$GET": { "src": "src/routes/api/workflows/[id]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-6mlVxWxN.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-6mlVxWxN.js"
) }, "$HEAD": { "src": "src/routes/api/workflows/[id]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-6mlVxWxN.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-6mlVxWxN.js"
) }, "$PUT": { "src": "src/routes/api/workflows/[id]/index.ts?pick=PUT", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Cif9O646.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-Cif9O646.js"
) }, "path": "/api/workflows/:id/" }, { "page": false, "$GET": { "src": "src/routes/api/workflows/[id]/run.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/run-BnH3JkaS.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/run-BnH3JkaS.js"
) }, "$HEAD": { "src": "src/routes/api/workflows/[id]/run.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/run-BnH3JkaS.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/run-BnH3JkaS.js"
) }, "$POST": { "src": "src/routes/api/workflows/[id]/run.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/run-aT1HWcyM.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/run-aT1HWcyM.js"
) }, "path": "/api/workflows/:id/run" }, { "page": false, "$GET": { "src": "src/routes/api/workflows/runs/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CY4Kx25M.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CY4Kx25M.js"
) }, "$HEAD": { "src": "src/routes/api/workflows/runs/[id].ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CY4Kx25M.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_id_-CY4Kx25M.js"
) }, "path": "/api/workflows/runs/:id" }, { "page": false, "$POST": { "src": "src/routes/api/dashboards/[id]/trigger/[buttonId].ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/_buttonId_-uyjcn9Nw.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/_buttonId_-uyjcn9Nw.js"
) }, "path": "/api/dashboards/:id/trigger/:buttonId" }, { "page": false, "$GET": { "src": "src/routes/api/database/[db]/[table]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-eFXFo8KD.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-eFXFo8KD.js"
) }, "$HEAD": { "src": "src/routes/api/database/[db]/[table]/index.ts?pick=GET", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-eFXFo8KD.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-eFXFo8KD.js"
) }, "$POST": { "src": "src/routes/api/database/[db]/[table]/index.ts?pick=POST", "build": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CTDp6dyY.js"
), "import": () => import(
  /* @vite-ignore */
  "./_build/assets/index-CTDp6dyY.js"
) }, "path": "/api/database/:db/:table/" }];
const pageRoutes = defineRoutes(fileRoutes.filter((o) => o.page));
function defineRoutes(fileRoutes2) {
  function processRoute(routes2, route, id, full) {
    const parentRoute = Object.values(routes2).find((o) => {
      return id.startsWith(o.id + "/");
    });
    if (!parentRoute) {
      routes2.push({
        ...route,
        id,
        path: id.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/")
      });
      return routes2;
    }
    processRoute(parentRoute.children || (parentRoute.children = []), route, id.slice(parentRoute.id.length));
    return routes2;
  }
  return fileRoutes2.sort((a, b) => a.path.length - b.path.length).reduce((prevRoutes, route) => {
    return processRoute(prevRoutes, route, route.path, route.path);
  }, []);
}
const router = createRouter$1({
  routes: fileRoutes.reduce((memo, route) => {
    if (!containsHTTP(route)) return memo;
    const path = route.path.replace(/\([^)/]+\)/g, "").replace(/\/+/g, "/").replace(/\*([^/]*)/g, (_, m) => `**:${m}`).split("/").map((s) => s.startsWith(":") || s.startsWith("*") ? s : encodeURIComponent(s)).join("/");
    if (/:[^/]*\?/g.test(path)) {
      throw new Error(`Optional parameters are not supported in API routes: ${path}`);
    }
    if (memo[path]) {
      throw new Error(`Duplicate API routes for "${path}" found at "${memo[path].route.path}" and "${route.path}"`);
    }
    memo[path] = {
      route
    };
    return memo;
  }, {})
});
function containsHTTP(route) {
  return route["$HEAD"] || route["$GET"] || route["$POST"] || route["$PUT"] || route["$PATCH"] || route["$DELETE"];
}
function matchAPIRoute(path, method) {
  const match = router.lookup(path);
  if (match && match.route) {
    const route = match.route;
    const handler = method === "HEAD" ? route.$HEAD || route.$GET : route[`$${method}`];
    if (handler === void 0) return;
    const isPage = route.page === true && route.$component !== void 0;
    return {
      handler,
      params: match.params,
      isPage
    };
  }
  return void 0;
}
const components = {};
function createRoutes() {
  function createRoute(route) {
    const component = route.$component && (components[route.$component.src] ??= lazy(route.$component.import));
    return {
      ...route,
      ...route.$$route ? route.$$route.require().route : void 0,
      info: {
        ...route.$$route ? route.$$route.require().route.info : {},
        filesystem: true
      },
      component,
      children: route.children ? route.children.map(createRoute) : void 0
    };
  }
  const routes2 = pageRoutes.map(createRoute);
  return routes2;
}
let routes;
const FileRoutes = isServer ? () => getRequestEvent().routes : () => routes || (routes = createRoutes());
var _tmpl$$3 = ["<div", ' class="flex items-center gap-3"><span class="text-sm font-mono text-[#8b8b9e] bg-[#1e1e2e]/50 px-2 py-1 rounded">', '</span><button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700">Logout</button></div>'], _tmpl$2$2 = ["<nav", ' class="sticky top-0 z-50 border-b border-[#1e1e2e] bg-[#0a0a0f]/90 backdrop-blur-xl"><div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><a href="/" class="flex items-center gap-3 group"><div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg></div><span class="text-lg font-bold tracking-tight text-white">Solid<span class="gradient-text">Flow</span></span></a><ul class="flex items-center gap-1">', '</ul><div class="flex items-center gap-4"><div class="flex items-center gap-2 rounded-full bg-[#10b981]/10 px-3 py-1.5"><span class="relative flex h-2 w-2"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span></span><span class="text-xs font-medium text-emerald-400">Live</span></div><!--$-->', "<!--/--></div></div></nav>"], _tmpl$3 = ["<li", "><a", ' rel="external" class="', '">', "</a></li>"], _tmpl$4 = ["<div", ' class="h-9 w-20" aria-label="Checking session"></div>'], _tmpl$5 = ["<button", ' class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700">Log In</button>'];
const fetchSession = async () => {
  try {
    const res = await fetch("/api/auth/session");
    if (!res.ok) return null;
    const session = await res.json();
    return session && typeof session === "object" && Object.keys(session).length > 0 ? session : null;
  } catch (e) {
    return null;
  }
};
function Nav() {
  const [session, setSession] = createSignal(void 0);
  onMount(async () => {
    setSession(await fetchSession());
  });
  const active = (path) => {
    if (isServer) return "text-[#8b8b9e]";
    return window.location.pathname === path ? "text-white" : "text-[#8b8b9e] hover:text-white";
  };
  return ssr(_tmpl$2$2, ssrHydrationKey(), escape(["/", "/dashboards", "/workflows", "/connections", "/protos", "/database", "/requests", "/about"].map((path) => ssr(_tmpl$3, ssrHydrationKey(), ssrAttribute("href", escape(path, true), false), `rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${escape(active(path), true)}`, path === "/" ? "Home" : escape(path.replace("/", "").charAt(0).toUpperCase()) + escape(path.replace("/", "").slice(1))))), escape(createComponent$1(Show, {
    get when() {
      return session() !== void 0;
    },
    get fallback() {
      return ssr(_tmpl$4, ssrHydrationKey());
    },
    get children() {
      return createComponent$1(Show, {
        get when() {
          return session();
        },
        get fallback() {
          return ssr(_tmpl$5, ssrHydrationKey());
        },
        get children() {
          return ssr(_tmpl$$3, ssrHydrationKey(), escape(session()?.user?.sub) || "No Subject");
        }
      });
    }
  })));
}
function App$1() {
  return createComponent$1(Router, {
    root: (props) => [createComponent$1(Nav, {}), createComponent$1(Suspense, {
      get children() {
        return props.children;
      }
    })],
    get children() {
      return createComponent$1(FileRoutes, {});
    }
  });
}
const app = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1
}, Symbol.toStringTag, { value: "Module" }));
const HttpStatusCode = isServer ? (props) => {
  const event = getRequestEvent();
  event.response.status = props.code;
  event.response.statusText = props.text;
  onCleanup(() => (
    // !event.nativeEvent.handled &&
    !event.complete && (event.response.status = 200)
  ));
  return null;
} : (_props) => null;
var _tmpl$$2 = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">', "</span>"], _tmpl$2$1 = ["<span", ' style="font-size:1.5em;text-align:center;position:fixed;left:0px;bottom:55%;width:100%;">500 | Internal Server Error</span>'];
const ErrorBoundary = (props) => {
  const message = isServer ? "500 | Internal Server Error" : "Error | Uncaught Client Exception";
  return createComponent$1(ErrorBoundary$1, {
    fallback: (error) => {
      console.error(error);
      return [ssr(_tmpl$$2, ssrHydrationKey(), escape(message)), createComponent$1(HttpStatusCode, {
        code: 500
      })];
    },
    get children() {
      return props.children;
    }
  });
};
const TopErrorBoundary = (props) => {
  let isError = false;
  const res = catchError(() => props.children, (err) => {
    console.error(err);
    isError = !!err;
  });
  return isError ? [ssr(_tmpl$2$1, ssrHydrationKey()), createComponent$1(HttpStatusCode, {
    code: 500
  })] : res;
};
const PatchVirtualDevStyles = (props) => {
};
var _tmpl$$1 = ["<script", ' type="module"', " async", "><\/script>"];
const docType = ssr("<!DOCTYPE html>");
function StartServer(props) {
  const context = getRequestEvent();
  const nonce = context.nonce;
  useAssets(context.assets, nonce);
  return createComponent$1(NoHydration, {
    get children() {
      return [docType, createComponent$1(TopErrorBoundary, {
        get children() {
          return createComponent$1(props.document, {
            get assets() {
              return createComponent$1(HydrationScript, {});
            },
            get scripts() {
              return [createComponent$1(PatchVirtualDevStyles, {
                nonce
              }), ssr(_tmpl$$1, ssrHydrationKey(), ssrAttribute("nonce", escape(nonce, true), false), ssrAttribute("src", escape(getSsrManifest().path("./src/entry-client.tsx"), true), false))];
            },
            get children() {
              return createComponent$1(Hydration, {
                get children() {
                  return createComponent$1(ErrorBoundary, {
                    get children() {
                      return createComponent$1(App$1, {});
                    }
                  });
                }
              });
            }
          });
        }
      })];
    }
  });
}
const middleware = {};
const FETCH_EVENT_CONTEXT = "solidFetchEvent";
function createFetchEvent(event) {
  return {
    request: event.req,
    response: event.res,
    clientAddress: getRequestIP(event),
    locals: {},
    nativeEvent: event
  };
}
function getFetchEvent(h3Event) {
  if (!h3Event.context[FETCH_EVENT_CONTEXT]) {
    const fetchEvent = createFetchEvent(h3Event);
    h3Event.context[FETCH_EVENT_CONTEXT] = fetchEvent;
  }
  return h3Event.context[FETCH_EVENT_CONTEXT];
}
function mergeResponseHeaders(h3Event, headers) {
  for (const [key, value] of headers.entries()) {
    h3Event.res.headers.append(key, value);
  }
}
const decorateHandler = (fn) => (event) => provideRequestEvent(getFetchEvent(event), () => fn(event));
const decorateMiddleware = (fn) => (event, next) => provideRequestEvent(getFetchEvent(event), () => fn(event, next));
const manifest = {};
async function getServerFnById(id) {
  const serverFnInfo = manifest[id];
  if (!serverFnInfo) {
    throw new Error("Server function info not found for " + id);
  }
  const fnModule = await serverFnInfo.importer();
  if (!fnModule) {
    console.info("serverFnInfo", serverFnInfo);
    throw new Error("Server function module not resolved for " + id);
  }
  const action = fnModule[serverFnInfo.functionName];
  if (!action) {
    console.info("serverFnInfo", serverFnInfo);
    console.info("fnModule", fnModule);
    throw new Error(
      `Server function module export not resolved for serverFn ID: ${id}`
    );
  }
  return action;
}
const validRedirectStatuses = /* @__PURE__ */ new Set([301, 302, 303, 307, 308]);
function getExpectedRedirectStatus(response) {
  if (response.status && validRedirectStatuses.has(response.status)) {
    return response.status;
  }
  return 302;
}
function createChunk(data) {
  const encodeData = new TextEncoder().encode(data);
  const bytes = encodeData.length;
  const baseHex = bytes.toString(16);
  const totalHex = "00000000".substring(0, 8 - baseHex.length) + baseHex;
  const head = new TextEncoder().encode(`;0x${totalHex};`);
  const chunk = new Uint8Array(12 + bytes);
  chunk.set(head);
  chunk.set(encodeData, 12);
  return chunk;
}
function serializeToStream(id, value) {
  return new ReadableStream({
    start(controller) {
      crossSerializeStream(value, {
        scopeId: id,
        plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin],
        onSerialize(data, initial) {
          controller.enqueue(createChunk(initial ? `(${getCrossReferenceHeader(id)},${data})` : data));
        },
        onDone() {
          controller.close();
        },
        onError(error) {
          controller.error(error);
        }
      });
    }
  });
}
async function handleServerFunction(h3Event) {
  const event = getFetchEvent(h3Event);
  const request = event.request;
  const serverReference = request.headers.get("X-Server-Id");
  const instance = request.headers.get("X-Server-Instance");
  const singleFlight = request.headers.has("X-Single-Flight");
  const url = new URL(request.url.startsWith("/") ? `http://localhost${request.url}` : request.url);
  let functionId;
  if (serverReference) {
    [functionId] = serverReference.split("#");
  } else {
    functionId = url.searchParams.get("id");
    if (!functionId) {
      return process.env.NODE_ENV === "development" ? new Response("Server function not found", {
        status: 404
      }) : new Response(null, {
        status: 404
      });
    }
  }
  const serverFunction = await getServerFnById(functionId);
  let parsed = [];
  if (!instance || h3Event.method === "GET") {
    const args = url.searchParams.get("args");
    if (args) {
      const json = JSON.parse(args);
      (json.t ? fromJSON(json, {
        plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin]
      }) : json).forEach((arg) => {
        parsed.push(arg);
      });
    }
  }
  if (h3Event.method === "POST") {
    const contentType = request.headers.get("content-type");
    if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
      parsed.push(await event.request.formData());
    } else if (contentType?.startsWith("application/json")) {
      parsed = fromJSON(await event.request.json(), {
        plugins: [CustomEventPlugin, DOMExceptionPlugin, EventPlugin, FormDataPlugin, HeadersPlugin, ReadableStreamPlugin, RequestPlugin, ResponsePlugin, URLSearchParamsPlugin, URLPlugin]
      });
    }
  }
  try {
    let result = await provideRequestEvent(event, async () => {
      sharedConfig.context = {
        event
      };
      event.locals.serverFunctionMeta = {
        id: functionId
      };
      return serverFunction(...parsed);
    });
    if (singleFlight && instance) {
      result = await handleSingleFlight(event, result);
    }
    if (result instanceof Response) {
      if (result.headers && result.headers.has("X-Content-Raw")) return result;
      if (instance) {
        if (result.headers) mergeResponseHeaders(h3Event, result.headers);
        if (result.status && (result.status < 300 || result.status >= 400)) h3Event.res.status = result.status;
        if (result.customBody) {
          result = await result.customBody();
        } else if (result.body == void 0) result = null;
      }
    }
    if (!instance) return handleNoJS(result, request, parsed);
    h3Event.res.headers.set("content-type", "text/javascript");
    return serializeToStream(instance, result);
  } catch (x) {
    if (x instanceof Response) {
      if (singleFlight && instance) {
        x = await handleSingleFlight(event, x);
      }
      if (x.headers) mergeResponseHeaders(h3Event, x.headers);
      if (x.status && (!instance || x.status < 300 || x.status >= 400)) h3Event.res.status = x.status;
      if (x.customBody) {
        x = x.customBody();
      } else if (x.body === void 0) x = null;
      h3Event.res.headers.set("X-Error", "true");
    } else if (instance) {
      const error = x instanceof Error ? x.message : typeof x === "string" ? x : "true";
      h3Event.res.headers.set("X-Error", error.replace(/[\r\n]+/g, ""));
    } else {
      x = handleNoJS(x, request, parsed, true);
    }
    if (instance) {
      h3Event.res.headers.set("content-type", "text/javascript");
      return serializeToStream(instance, x);
    }
    return x;
  }
}
function handleNoJS(result, request, parsed, thrown) {
  const url = new URL(request.url.startsWith("/") ? `http://localhost${request.url}` : request.url);
  const isError = result instanceof Error;
  let statusCode = 302;
  let headers;
  if (result instanceof Response) {
    headers = new Headers(result.headers);
    if (result.headers.has("Location")) {
      headers.set(`Location`, new URL(result.headers.get("Location"), url.origin + "/").toString());
      statusCode = getExpectedRedirectStatus(result);
    }
  } else headers = new Headers({
    Location: new URL(request.headers.get("referer")).toString()
  });
  if (result) {
    headers.append("Set-Cookie", `flash=${encodeURIComponent(JSON.stringify({
      url: url.pathname + url.search,
      result: isError ? result.message : result,
      thrown,
      error: isError,
      input: [...parsed.slice(0, -1), [...parsed[parsed.length - 1].entries()]]
    }))}; Secure; HttpOnly;`);
  }
  return new Response(null, {
    status: statusCode,
    headers
  });
}
let App;
function createSingleFlightHeaders(sourceEvent) {
  const headers = sourceEvent.request.headers;
  const cookies = parseCookies(sourceEvent.nativeEvent);
  const SetCookies = sourceEvent.response.headers.getSetCookie();
  headers.delete("cookie");
  SetCookies.forEach((cookie) => {
    if (!cookie) return;
    const {
      maxAge,
      expires,
      name,
      value
    } = parseSetCookie(cookie);
    if (maxAge != null && maxAge <= 0) {
      delete cookies[name];
      return;
    }
    if (expires != null && expires.getTime() <= Date.now()) {
      delete cookies[name];
      return;
    }
    cookies[name] = value;
  });
  Object.entries(cookies).forEach(([key, value]) => {
    headers.append("cookie", `${key}=${value}`);
  });
  return headers;
}
async function handleSingleFlight(sourceEvent, result) {
  let revalidate;
  let url = new URL(sourceEvent.request.headers.get("referer")).toString();
  if (result instanceof Response) {
    if (result.headers.has("X-Revalidate")) revalidate = result.headers.get("X-Revalidate").split(",");
    if (result.headers.has("Location")) url = new URL(result.headers.get("Location"), new URL(sourceEvent.request.url).origin + "/").toString();
  }
  const event = {
    ...sourceEvent
  };
  event.request = new Request(url, {
    headers: createSingleFlightHeaders(sourceEvent)
  });
  return await provideRequestEvent(event, async () => {
    await createPageEvent(event);
    App || (App = (await Promise.resolve().then(() => app)).default);
    event.router.dataOnly = revalidate || true;
    event.router.previousUrl = sourceEvent.request.headers.get("referer");
    try {
      renderToString(() => {
        sharedConfig.context.event = event;
        App();
      });
    } catch (e) {
      console.log(e);
    }
    const body = event.router.data;
    if (!body) return result;
    let containsKey = false;
    for (const key in body) {
      if (body[key] === void 0) delete body[key];
      else containsKey = true;
    }
    if (!containsKey) return result;
    if (!(result instanceof Response)) {
      body["_$value"] = result;
      result = new Response(null, {
        status: 200
      });
    } else if (result.customBody) {
      body["_$value"] = result.customBody();
    }
    result.customBody = () => body;
    result.headers.set("X-Single-Flight", "true");
    return result;
  });
}
const SERVER_FN_BASE = "/_server";
function createBaseHandler(createPageEvent2, fn, options = {}) {
  const handler = defineHandler({
    middleware: middleware.length ? middleware.map(decorateMiddleware) : void 0,
    handler: decorateHandler(async (e) => {
      const event = getRequestEvent();
      const url = new URL(event.request.url.startsWith("/") ? `http://localhost${event.request.url}` : event.request.url);
      const pathname = stripBaseUrl(url.pathname);
      if (pathname.startsWith(SERVER_FN_BASE)) {
        const serverFnResponse = await handleServerFunction(e);
        if (serverFnResponse instanceof Response) return produceResponseWithEventHeaders(serverFnResponse);
        return new Response(serverFnResponse, {
          headers: e.res.headers
        });
      }
      const match = matchAPIRoute(pathname, event.request.method);
      if (match) {
        const mod = await match.handler.import();
        const fn2 = event.request.method === "HEAD" ? mod["HEAD"] || mod["GET"] : mod[event.request.method];
        event.params = match.params || {};
        sharedConfig.context = {
          event
        };
        const res = await fn2(event);
        if (res !== void 0) {
          if (res instanceof Response) return produceResponseWithEventHeaders(res);
          return res;
        }
        if (event.request.method !== "GET") {
          throw new Error(`API handler for ${event.request.method} "${event.request.url}" did not return a response.`);
        }
        if (!match.isPage) return;
      }
      const context = await createPageEvent2(event);
      const resolvedOptions = typeof options === "function" ? await options(context) : {
        ...options
      };
      const mode = resolvedOptions.mode || "stream";
      if (resolvedOptions.nonce) context.nonce = resolvedOptions.nonce;
      if (mode === "sync" || false) {
        const html = renderToString(() => {
          sharedConfig.context.event = context;
          return fn(context);
        }, resolvedOptions);
        context.complete = true;
        if (context.response && context.response.headers.get("Location")) {
          const status = getExpectedRedirectStatus(context.response);
          return redirect(context.response.headers.get("Location"), status);
        }
        event.response.headers.set("content-type", "text/html");
        return html;
      }
      if (resolvedOptions.onCompleteAll) {
        const og = resolvedOptions.onCompleteAll;
        resolvedOptions.onCompleteAll = (options2) => {
          handleStreamCompleteRedirect(context)(options2);
          og(options2);
        };
      } else resolvedOptions.onCompleteAll = handleStreamCompleteRedirect(context);
      if (resolvedOptions.onCompleteShell) {
        const og = resolvedOptions.onCompleteShell;
        resolvedOptions.onCompleteShell = (options2) => {
          handleShellCompleteRedirect(context, e)();
          og(options2);
        };
      } else resolvedOptions.onCompleteShell = handleShellCompleteRedirect(context, e);
      const _stream = renderToStream(() => {
        sharedConfig.context.event = context;
        return fn(context);
      }, resolvedOptions);
      const stream = _stream;
      if (context.response && context.response.headers.get("Location")) {
        const status = getExpectedRedirectStatus(context.response);
        return redirect(context.response.headers.get("Location"), status);
      }
      if (mode === "async") return await stream;
      delete stream.then;
      if (globalThis.USING_SOLID_START_DEV_SERVER) return stream;
      const {
        writable,
        readable
      } = new TransformStream();
      stream.pipeTo(writable);
      return readable;
    })
  });
  const app2 = new H3();
  app2.use(handler);
  return app2;
}
function createHandler(fn, options = {}) {
  return createBaseHandler(createPageEvent, fn, options);
}
async function createPageEvent(ctx) {
  ctx.response.headers.set("Content-Type", "text/html");
  const manifest2 = getSsrManifest();
  const mergedCSS = await manifest2.getAssets("style.css");
  const assets = [
    ...mergedCSS,
    ...await manifest2.getAssets("./src/entry-client.tsx"),
    ...await manifest2.getAssets("/home/c/workspace/solid-project/src/app.tsx")
    // ...(import.meta.env.START_ISLANDS
    //   ? (await serverManifest.inputs[serverManifest.handler]!.assets()).filter(
    //       s => (s as any).attrs.rel !== "modulepreload"
    //     )
    //   : [])
  ];
  const pageEvent = Object.assign(ctx, {
    assets,
    router: {
      submission: initFromFlash(ctx)
    },
    routes: createRoutes(),
    // prevUrl: prevPath || "",
    // mutation: mutation,
    // $type: FETCH_EVENT,
    complete: false,
    $islands: /* @__PURE__ */ new Set()
  });
  return pageEvent;
}
function initFromFlash(ctx) {
  const flash = getCookie(ctx.nativeEvent, "flash");
  if (!flash) return;
  try {
    const param = JSON.parse(flash);
    if (!param || !param.result) return;
    const input = [...param.input.slice(0, -1), new Map(param.input[param.input.length - 1])];
    const result = param.error ? new Error(param.result) : param.result;
    return {
      input,
      url: param.url,
      pending: false,
      result: param.thrown ? void 0 : result,
      error: param.thrown ? result : void 0
    };
  } catch (e) {
    console.error(e);
  } finally {
    setCookie(ctx.nativeEvent, "flash", "", {
      maxAge: 0
    });
  }
}
function handleShellCompleteRedirect(context, e) {
  return () => {
    if (context.response && context.response.headers.get("Location")) {
      const status = getExpectedRedirectStatus(context.response);
      e.res.status = status;
      e.res.headers.set("Location", context.response.headers.get("Location"));
    }
  };
}
function handleStreamCompleteRedirect(context) {
  return ({
    write
  }) => {
    context.complete = true;
    const to = context.response && context.response.headers.get("Location");
    to && write(`<script>window.location="${to}"<\/script>`);
  };
}
function produceResponseWithEventHeaders(res) {
  const event = getRequestEvent();
  let ret = res;
  if (300 <= res.status && res.status < 400) {
    const cookies = res.headers.getSetCookie?.() ?? [];
    const headers = new Headers();
    res.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "set-cookie") {
        headers.set(key, value);
      }
    });
    for (const cookie of cookies) {
      headers.append("Set-Cookie", cookie);
    }
    ret = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers
    });
  }
  const eventCookies = event.response.headers.getSetCookie?.() ?? [];
  for (const cookie of eventCookies) {
    ret.headers.append("Set-Cookie", cookie);
  }
  for (const [name, value] of event.response.headers) {
    if (name.toLowerCase() !== "set-cookie") {
      ret.headers.set(name, value);
    }
  }
  return ret;
}
function stripBaseUrl(path) {
  return path;
}
var _tmpl$ = ['<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="/favicon.ico">', "</head>"], _tmpl$2 = ["<html", ' lang="en">', '<body><div id="app">', "</div><!--$-->", "<!--/--></body></html>"];
const id$$ = "src/entry-server.tsx";
const entryServer = createHandler((event) => {
  return createComponent$1(StartServer, {
    document: ({
      assets,
      children: children2,
      scripts
    }) => ssr(_tmpl$2, ssrHydrationKey(), createComponent$1(NoHydration, {
      get children() {
        return ssr(_tmpl$, escape(assets));
      }
    }), escape(children2), escape(scripts))
  });
});
export {
  useNavigate as a,
  useResolvedPath as b,
  useHref as c,
  useLocation as d,
  entryServer as default,
  id$$,
  normalizePath as n,
  useParams as u
};
//# sourceMappingURL=entry-server.js.map
