import { createTable } from "@tanstack/table-core";
import { mergeProps, createComputed, createComponent } from "solid-js";
import { createStore } from "solid-js/store";
function flexRender(Comp, props) {
  if (!Comp) return null;
  if (typeof Comp === "function") {
    return createComponent(Comp, props);
  }
  return Comp;
}
function createSolidTable(options) {
  const resolvedOptions = mergeProps({
    state: {},
    // Dummy state
    onStateChange: () => {
    },
    // noop
    renderFallbackValue: null,
    mergeOptions: (defaultOptions, options2) => {
      return mergeProps(defaultOptions, options2);
    }
  }, options);
  const table = createTable(resolvedOptions);
  const [state, setState] = createStore(table.initialState);
  createComputed(() => {
    table.setOptions((prev) => {
      return mergeProps(prev, options, {
        state: mergeProps(state, options.state || {}),
        // Similarly, we'll maintain both our internal state and any user-provided
        // state.
        onStateChange: (updater) => {
          setState(updater);
          options.onStateChange == null || options.onStateChange(updater);
        }
      });
    });
  });
  return table;
}
export {
  createSolidTable as c,
  flexRender as f
};
//# sourceMappingURL=index-DNUuAjQM.js.map
