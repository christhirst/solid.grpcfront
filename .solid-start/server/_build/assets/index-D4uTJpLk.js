import { createComponent, mergeProps, ssr, ssrHydrationKey, ssrAttribute, escape } from "solid-js/web";
import { createSignal, mergeProps as mergeProps$1, onMount, createEffect, on, onCleanup } from "solid-js";
import { Chart, LineController, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { unwrap } from "solid-js/store";
var _tmpl$ = ["<canvas", ">", "</canvas>"];
function chain(callbacks) {
  return (...args) => {
    for (const callback of callbacks) callback && callback(...args);
  };
}
function mergeRefs(...refs) {
  return chain(refs);
}
function DefaultChart(props) {
  const [canvasRef, setCanvasRef] = createSignal();
  const [chart, setChart] = createSignal();
  const merged = mergeProps$1({
    width: 512,
    height: 512,
    type: "line",
    data: {},
    options: {
      responsive: true
    },
    plugins: []
  }, props);
  const init = () => {
    const ctx = canvasRef()?.getContext("2d");
    const config = unwrap(merged);
    if (config.type !== "radar") {
      if (config.options.scales?.r) {
        delete config.options.scales?.r;
      }
    }
    const chart2 = new Chart(ctx, {
      type: config.type,
      data: config.data,
      options: config.options,
      plugins: config.plugins
    });
    setChart(chart2);
  };
  onMount(() => {
    init();
  });
  createEffect(on(() => merged.data, () => {
    chart().data = merged.data;
    chart().update();
  }, {
    defer: true
  }));
  createEffect(on(() => merged.options, () => {
    chart().options = merged.options;
    chart().update();
  }, {
    defer: true
  }));
  createEffect(on([() => merged.width, () => merged.height], () => {
    chart().resize(merged.width, merged.height);
  }, {
    defer: true
  }));
  createEffect(on(() => merged.type, () => {
    const dimensions = [chart().width, chart().height];
    chart().destroy();
    init();
    chart().resize(...dimensions);
  }, {
    defer: true
  }));
  onCleanup(() => {
    chart()?.destroy();
    mergeRefs(props.ref, null);
  });
  return ssr(_tmpl$, ssrHydrationKey() + ssrAttribute("height", escape(merged.height, true), false) + ssrAttribute("width", escape(merged.width, true), false), escape(merged.fallback));
}
function createTypedChart(type, registerables) {
  Chart.register(registerables);
  return (props) => createComponent(DefaultChart, mergeProps({
    type
  }, props));
}
var Line = /* @__PURE__ */ createTypedChart("line", [LineController, CategoryScale, LinearScale, PointElement, LineElement]);
export {
  DefaultChart as D,
  Line as L
};
//# sourceMappingURL=index-D4uTJpLk.js.map
