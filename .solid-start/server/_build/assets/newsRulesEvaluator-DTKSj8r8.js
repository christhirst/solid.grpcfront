import { createComponent, ssr, ssrHydrationKey, escape, ssrAttribute } from "solid-js/web";
import { Show, For } from "solid-js";
import get from "lodash.get";
var _tmpl$ = ["<label", ' class="flex items-center gap-3 cursor-pointer py-1.5"><input type="checkbox" class="w-4 h-4 rounded border-[#2a2a3a] bg-[#1e1e2e] text-purple-500 focus:ring-purple-500/50"', '><span class="text-sm text-white">Enable</span></label>'], _tmpl$2 = ["<select", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"', "><option value disabled>Select an option...</option><!--$-->", "<!--/--></select>"], _tmpl$3 = ["<option", ">", "</option>"], _tmpl$4 = ["<textarea", ' rows="3"', ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-mono"', ' placeholder="', '"></textarea>'], _tmpl$5 = ["<input", "", ' class="w-full rounded-lg border border-[#2a2a3a] bg-[#1e1e2e] p-2.5 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"', ' placeholder="', '">'], _tmpl$6 = ["<div", ' class="rounded-2xl border border-[#2a2a3a] bg-[#0e0e15] p-5 shadow-xl space-y-4 text-left"><div class="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]"><span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span><h3 class="text-sm font-bold text-white">', '</h3></div><div class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">', '</div><div class="pt-2"><button', ">", "</button></div></div>"], _tmpl$7 = ["<button", "", ">", "</button>"], _tmpl$8 = ["<div", ' class="col-span-1"><label class="block text-xs font-bold text-[#8b8b9e] mb-1.5">', "</label><!--$-->", "<!--/--></div>"], _tmpl$9 = ["<svg", ' width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'], _tmpl$0 = ["<span", ">", "</span>"], _tmpl$1 = ["<svg", ' class="animate-spin h-4 w-4 text-purple-400" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'], _tmpl$10 = ["<span", ">Running...</span>"], _tmpl$11 = ["<svg", ' class="animate-bounce h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>'], _tmpl$12 = ["<span", ">Success!</span>"], _tmpl$13 = ["<svg", ' class="animate-pulse h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'], _tmpl$14 = ["<span", ">Failed</span>"];
const colorClassMap = {
  blue: "bg-blue-600 hover:bg-blue-500 ring-blue-500/50",
  red: "bg-red-600 hover:bg-red-500 ring-red-500/50",
  emerald: "bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/50",
  purple: "bg-purple-600 hover:bg-purple-500 ring-purple-500/50",
  slate: "bg-slate-700 hover:bg-slate-600 ring-slate-500/50"
};
function buildButtonClass(state, color) {
  const base = "w-full h-full min-h-[36px] py-2 px-3 text-xs sm:text-sm font-bold text-white rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 select-none truncate";
  if (state === "running") return `${base} bg-slate-800 text-white/70 cursor-not-allowed`;
  if (state === "success") return `${base} bg-emerald-600 ring-2 ring-emerald-500/50`;
  if (state === "error") return `${base} bg-red-600 ring-2 ring-red-500/50`;
  const colorStyle = colorClassMap[color || "blue"] || colorClassMap.blue;
  return `${base} active:scale-[0.98] focus:ring-2 focus:outline-none ${colorStyle}`;
}
function getFieldValue(field, formValues) {
  if (formValues && field.name in formValues) return formValues[field.name];
  return field.value ?? field.defaultValue ?? "";
}
function FormFieldInput(props) {
  const {
    field
  } = props;
  if (field.type === "boolean") {
    return ssr(_tmpl$, ssrHydrationKey(), ssrAttribute("checked", !!props.value, true));
  }
  if (field.type === "select") {
    return ssr(_tmpl$2, ssrHydrationKey(), ssrAttribute("value", escape(String(props.value ?? ""), true), false), escape(createComponent(For, {
      get each() {
        return (field.options || "").split(",").map((o) => o.trim()).filter(Boolean);
      },
      children: (opt) => ssr(_tmpl$3, ssrHydrationKey() + ssrAttribute("value", escape(opt, true), false), escape(opt))
    })));
  }
  if (field.type === "textarea") {
    return ssr(_tmpl$4, ssrHydrationKey(), ssrAttribute("required", field.required, true), ssrAttribute("value", escape(String(props.value ?? ""), true), false), `Enter ${escape(field.label, true)}...`);
  }
  const isNumber = field.type === "number";
  return ssr(_tmpl$5, ssrHydrationKey() + ssrAttribute("type", isNumber ? "number" : "text", false), ssrAttribute("required", field.required, true), ssrAttribute("value", escape(String(props.value ?? ""), true), false), `Enter ${escape(field.label, true)}...`);
}
function DashboardButtonFormWidget(props) {
  const {
    btn,
    effective,
    state,
    formState,
    updateForm,
    onTrigger
  } = props;
  if (effective.hidden) return null;
  const formValues = () => formState[btn.id] || {};
  const fields = () => btn.formConfig || [];
  const hasFields = () => fields().length > 0;
  const btnClass = () => buildButtonClass(state, btn.color);
  return createComponent(Show, {
    get when() {
      return !effective.formHidden && hasFields();
    },
    get fallback() {
      return ssr(_tmpl$7, ssrHydrationKey(), ssrAttribute("disabled", state !== "idle", true) + ssrAttribute("class", escape(btnClass(), true), false), escape(createComponent(ButtonContent, {
        state,
        get label() {
          return effective.label;
        }
      })));
    },
    get children() {
      return ssr(_tmpl$6, ssrHydrationKey(), escape(effective.label), escape(createComponent(For, {
        get each() {
          return fields();
        },
        children: (field) => {
          const value = () => getFieldValue(field, formValues());
          return ssr(_tmpl$8, ssrHydrationKey(), escape(field.label), escape(createComponent(FormFieldInput, {
            field,
            get value() {
              return value();
            },
            onChange: (value2) => updateForm(btn.id, field.name, value2)
          })));
        }
      })), ssrAttribute("disabled", state !== "idle", true) + ssrAttribute("class", escape(btnClass(), true), false), escape(createComponent(ButtonContent, {
        state,
        get label() {
          return `Execute ${effective.label}`;
        }
      })));
    }
  });
}
function ButtonContent(props) {
  return [createComponent(Show, {
    get when() {
      return props.state === "idle";
    },
    get children() {
      return [ssr(_tmpl$9, ssrHydrationKey()), ssr(_tmpl$0, ssrHydrationKey(), escape(props.label))];
    }
  }), createComponent(Show, {
    get when() {
      return props.state === "running";
    },
    get children() {
      return [ssr(_tmpl$1, ssrHydrationKey()), ssr(_tmpl$10, ssrHydrationKey())];
    }
  }), createComponent(Show, {
    get when() {
      return props.state === "success";
    },
    get children() {
      return [ssr(_tmpl$11, ssrHydrationKey()), ssr(_tmpl$12, ssrHydrationKey())];
    }
  }), createComponent(Show, {
    get when() {
      return props.state === "error";
    },
    get children() {
      return [ssr(_tmpl$13, ssrHydrationKey()), ssr(_tmpl$14, ssrHydrationKey())];
    }
  })];
}
function getValueAtPath(data, path) {
  if (!path || path.trim() === "") return data;
  return get(data, path);
}
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : void 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return void 0;
}
function coerceTo(value, target) {
  if (typeof target === "boolean") {
    if (value === "true" || value === true || value === 1 || value === "1") return true;
    if (value === "false" || value === false || value === 0 || value === "0") return false;
  }
  if (typeof target === "number" && (typeof value === "string" || typeof value === "number")) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
}
function compareNumeric(left, right, cmp) {
  const a = toNumber(left);
  const b = toNumber(right);
  if (a === void 0 || b === void 0) return false;
  switch (cmp) {
    case "gt":
      return a > b;
    case "lt":
      return a < b;
    case "gte":
      return a >= b;
    case "lte":
      return a <= b;
  }
}
function evaluateCondition(data, rule) {
  const value = getValueAtPath(data, rule.path);
  switch (rule.operator) {
    case "equals":
      return value == coerceTo(rule.value, value);
    case "notEquals":
      return value != coerceTo(rule.value, value);
    case "contains":
      if (typeof value === "string" && typeof rule.value === "string") {
        return value.includes(rule.value);
      }
      if (Array.isArray(value)) {
        return value.includes(rule.value);
      }
      return false;
    case "truthy":
      return !!value;
    case "falsy":
      return !value;
    case "gt":
      return compareNumeric(value, rule.value, "gt");
    case "lt":
      return compareNumeric(value, rule.value, "lt");
    case "gte":
      return compareNumeric(value, rule.value, "gte");
    case "lte":
      return compareNumeric(value, rule.value, "lte");
    default:
      return false;
  }
}
function applyAction(effective, action, targetValue) {
  switch (action) {
    case "showWidget":
      return {
        ...effective,
        hidden: false
      };
    case "hideWidget":
      return {
        ...effective,
        hidden: true
      };
    case "showForm":
      return {
        ...effective,
        formHidden: false
      };
    case "hideForm":
      return {
        ...effective,
        formHidden: true
      };
    case "setLabel":
      return targetValue === void 0 ? effective : {
        ...effective,
        label: targetValue
      };
    case "setWorkflow":
      return targetValue === void 0 ? effective : {
        ...effective,
        workflowId: targetValue
      };
    default:
      return effective;
  }
}
function defaultEffectiveConfig(widget) {
  return {
    hidden: false,
    formHidden: false,
    label: widget.label ?? "",
    workflowId: widget.workflowId ?? ""
  };
}
function applyWidgetConditions(widget, outcome) {
  const effective = defaultEffectiveConfig(widget);
  const rules = widget.conditionRules ?? [];
  if (rules.length === 0) return effective;
  return rules.reduce((acc, rule) => {
    const matched = evaluateCondition(outcome, rule);
    return matched ? applyAction(acc, rule.action, rule.targetValue) : acc;
  }, effective);
}
function extractRunOutcome(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return void 0;
  const last = [...logs].reverse().find((log) => log.status === "success");
  if (!last) return void 0;
  return last.response ?? last.meta ?? void 0;
}
function evaluateNewsRules(dataValue, rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    const valStr = dataValue !== void 0 && dataValue !== null ? typeof dataValue === "object" ? JSON.stringify(dataValue) : String(dataValue) : "No Data";
    return {
      color: "blue",
      text: valStr
    };
  }
  const strVal = typeof dataValue === "object" ? JSON.stringify(dataValue) : String(dataValue ?? "");
  const numVal = Number(dataValue);
  for (const rule of rules) {
    let match = false;
    const ruleVal = rule.value || "";
    switch (rule.operator) {
      case "equals":
        match = strVal.toLowerCase() === ruleVal.toLowerCase();
        break;
      case "contains":
        match = strVal.toLowerCase().includes(ruleVal.toLowerCase());
        break;
      case "gt":
        match = !isNaN(numVal) && !isNaN(Number(ruleVal)) && numVal > Number(ruleVal);
        break;
      case "lt":
        match = !isNaN(numVal) && !isNaN(Number(ruleVal)) && numVal < Number(ruleVal);
        break;
      case "regex":
        try {
          match = new RegExp(ruleVal, "i").test(strVal);
        } catch {
          match = false;
        }
        break;
      case "default":
        match = true;
        break;
    }
    if (match) {
      const renderedText = (rule.textTemplate || "{{ value }}").replace(/\{\{\s*value\s*\}\}/g, strVal);
      return {
        color: rule.color || "blue",
        text: renderedText
      };
    }
  }
  const defaultRule = rules.find((r) => r.operator === "default");
  if (defaultRule) {
    const renderedText = (defaultRule.textTemplate || "{{ value }}").replace(/\{\{\s*value\s*\}\}/g, strVal);
    return {
      color: defaultRule.color || "blue",
      text: renderedText
    };
  }
  return {
    color: "slate",
    text: strVal || "No matching data"
  };
}
const newsColorClasses = {
  emerald: {
    bg: "bg-emerald-950/40",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
  },
  red: {
    bg: "bg-red-950/40",
    border: "border-red-500/40",
    text: "text-red-300",
    badge: "bg-red-500/20 text-red-300 border-red-500/30"
  },
  amber: {
    bg: "bg-amber-950/40",
    border: "border-amber-500/40",
    text: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/30"
  },
  blue: {
    bg: "bg-blue-950/40",
    border: "border-blue-500/40",
    text: "text-blue-300",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30"
  },
  purple: {
    bg: "bg-purple-950/40",
    border: "border-purple-500/40",
    text: "text-purple-300",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/30"
  },
  slate: {
    bg: "bg-slate-900/60",
    border: "border-slate-700/60",
    text: "text-slate-300",
    badge: "bg-slate-700/30 text-slate-300 border-slate-600/30"
  }
};
export {
  DashboardButtonFormWidget as D,
  extractRunOutcome as a,
  applyWidgetConditions as b,
  defaultEffectiveConfig as d,
  evaluateNewsRules as e,
  newsColorClasses as n
};
//# sourceMappingURL=newsRulesEvaluator-DTKSj8r8.js.map
