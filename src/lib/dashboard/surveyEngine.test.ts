import { describe, expect, it } from "bun:test";
import {
  SURVEY_COMPLETE_TARGET,
  buildSurveyInitialValues,
  buildSurveyWorkflowPayload,
  collectVisitedSurveyFields,
  computeInitialVisibleWidgetIds,
  createDefaultSurveyConfig,
  evaluateBranchRule,
  findChainRootId,
  getChainMemberIds,
  isWidgetInFormSequence,
  normalizeSurveyStepAnswers,
  parseOptionsList,
  resolveNextSurveyStep,
} from "./surveyEngine";
import type { SurveyStep } from "./widgetTypes";

const steps: SurveyStep[] = [
  {
    id: "s1",
    title: "One",
    fields: [{ name: "role", label: "Role", type: "radio", options: "dev,other", required: true }],
    branchRules: [
      { id: "r1", field: "role", operator: "equals", value: "other", targetStepId: "s3" },
    ],
  },
  {
    id: "s2",
    title: "Two",
    fields: [{ name: "stack", label: "Stack", type: "checkbox_group", options: "ts,rust", required: true }],
  },
  {
    id: "s3",
    title: "Three",
    fields: [{ name: "score", label: "Score", type: "rating", ratingMax: 5 }],
    branchRules: [
      { id: "r2", field: "score", operator: "lt", value: "3", targetStepId: SURVEY_COMPLETE_TARGET },
    ],
  },
  { id: "s4", title: "Four", fields: [{ name: "note", label: "Note", type: "textarea" }] },
];

describe("evaluateBranchRule", () => {
  it("handles string operators case-insensitively", () => {
    expect(evaluateBranchRule({ field: "a", operator: "equals", value: "Yes" }, { a: " yes " })).toBe(true);
    expect(evaluateBranchRule({ field: "a", operator: "notEquals", value: "no" }, { a: "yes" })).toBe(true);
    expect(evaluateBranchRule({ field: "a", operator: "contains", value: "ell" }, { a: "Hello" })).toBe(true);
  });

  it("handles numeric operators and ratings", () => {
    expect(evaluateBranchRule({ field: "n", operator: "gt", value: "3" }, { n: 4 })).toBe(true);
    expect(evaluateBranchRule({ field: "n", operator: "lt", value: "3" }, { n: "2" })).toBe(true);
    expect(evaluateBranchRule({ field: "n", operator: "gte", value: "3" }, { n: 3 })).toBe(true);
    expect(evaluateBranchRule({ field: "n", operator: "lte", value: "3" }, { n: 4 })).toBe(false);
    expect(evaluateBranchRule({ field: "n", operator: "gt", value: "3" }, { n: "abc" })).toBe(false);
    expect(evaluateBranchRule({ field: "n", operator: "gt", value: "3" }, {})).toBe(false);
  });

  it("handles checkbox arrays and empties", () => {
    expect(evaluateBranchRule({ field: "c", operator: "equals", value: "rust" }, { c: ["ts", "Rust"] })).toBe(true);
    expect(evaluateBranchRule({ field: "c", operator: "notEquals", value: "go" }, { c: ["ts"] })).toBe(true);
    expect(evaluateBranchRule({ field: "c", operator: "contains", value: "us" }, { c: ["rust"] })).toBe(true);
    expect(evaluateBranchRule({ field: "c", operator: "isEmpty" }, { c: [] })).toBe(true);
    expect(evaluateBranchRule({ field: "c", operator: "isNotEmpty" }, { c: ["x"] })).toBe(true);
    expect(evaluateBranchRule({ field: "c", operator: "isEmpty" }, { c: "  " })).toBe(true);
  });
});

describe("resolveNextSurveyStep", () => {
  it("advances sequentially by default", () => {
    expect(resolveNextSurveyStep(steps, 0, { role: "dev" })).toEqual({ type: "step", index: 1, stepId: "s2" });
  });

  it("jumps ahead on a matching branch rule", () => {
    expect(resolveNextSurveyStep(steps, 0, { role: "other" })).toEqual({ type: "step", index: 2, stepId: "s3" });
  });

  it("finishes early on __complete__", () => {
    expect(resolveNextSurveyStep(steps, 2, { score: 1 })).toEqual({ type: "complete" });
    expect(resolveNextSurveyStep(steps, 2, { score: 5 })).toEqual({ type: "step", index: 3, stepId: "s4" });
  });

  it("completes after the last step and ignores self-loop rules", () => {
    expect(resolveNextSurveyStep(steps, 3, {})).toEqual({ type: "complete" });
    const loop: SurveyStep[] = [
      { id: "a", title: "A", fields: [], branchRules: [{ id: "x", field: "f", operator: "isEmpty", targetStepId: "a" }] },
      { id: "b", title: "B", fields: [] },
    ];
    expect(resolveNextSurveyStep(loop, 0, {})).toEqual({ type: "step", index: 1, stepId: "b" });
  });
});

describe("collectVisitedSurveyFields", () => {
  it("skips bypassed branches", () => {
    const names = collectVisitedSurveyFields(steps, { role: "other", score: 5 }).map((f) => f.name);
    expect(names).toEqual(["role", "score", "note"]);
  });

  it("includes all steps on the default path", () => {
    const names = collectVisitedSurveyFields(steps, { role: "dev", score: 5 }).map((f) => f.name);
    expect(names).toEqual(["role", "stack", "score", "note"]);
  });

  it("guards against cycles", () => {
    const cyc: SurveyStep[] = [
      { id: "a", title: "A", fields: [{ name: "x", label: "x", type: "string" }], branchRules: [{ id: "1", field: "x", operator: "isEmpty", targetStepId: "b" }] },
      { id: "b", title: "B", fields: [{ name: "y", label: "y", type: "string" }], branchRules: [{ id: "2", field: "y", operator: "isEmpty", targetStepId: "a" }] },
    ];
    expect(collectVisitedSurveyFields(cyc, {}).map((f) => f.name)).toEqual(["x", "y"]);
  });
});

describe("payload building & normalization", () => {
  it("normalizes list, checkbox, rating, number, boolean", () => {
    const out = normalizeSurveyStepAnswers(
      [
        { name: "l", label: "l", type: "list" },
        { name: "c", label: "c", type: "checkbox_group" },
        { name: "r", label: "r", type: "rating" },
        { name: "n", label: "n", type: "number" },
        { name: "b", label: "b", type: "boolean" },
        { name: "e", label: "e", type: "rating" },
      ],
      { l: "a, b", c: ["x", "y"], r: "4", n: "2.5", b: 1, e: "" }
    );
    expect(out).toEqual({ l: ["a", "b"], c: ["x", "y"], r: 4, n: 2.5, b: true, e: "" });
  });

  it("merges accumulated answers when passAccumulated is true", () => {
    const payload = buildSurveyWorkflowPayload(steps, [0, 1], 1, { role: "dev", stack: ["ts"] }, true);
    expect(payload.role).toBe("dev");
    expect(payload.stack).toEqual(["ts"]);
    expect(payload._survey_step_id).toBe("s2");
    expect(payload._survey_step_index).toBe(1);
    expect((payload._survey_steps as any).s1.role).toBe("dev");
  });

  it("only sends the current step when passAccumulated is false", () => {
    const payload = buildSurveyWorkflowPayload(steps, [0, 1], 1, { role: "dev", stack: ["ts"] }, false);
    expect(payload.role).toBeUndefined();
    expect(payload.stack).toEqual(["ts"]);
    expect(payload._survey_steps).toBeUndefined();
  });

  it("builds initial values and default config", () => {
    const init = buildSurveyInitialValues([
      { id: "a", title: "A", fields: [
        { name: "c", label: "c", type: "checkbox_group", defaultValue: "x,y" },
        { name: "b", label: "b", type: "boolean" },
        { name: "s", label: "s", type: "string", defaultValue: 4 },
      ] },
    ]);
    expect(init).toEqual({ c: ["x", "y"], b: false, s: "4" });
    const cfg = createDefaultSurveyConfig();
    expect(cfg.steps.length).toBe(2);
    expect(parseOptionsList("a, b\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("sequential form chain helpers", () => {
  const buttons = [
    { id: "f1", sequenceConfig: { hideOnSubmit: true, nextWidgetId: "f2" } },
    { id: "f2", sequenceConfig: { startsHidden: true, hideOnSubmit: true, nextWidgetId: "f3" } },
    { id: "f3", sequenceConfig: { startsHidden: true, hideOnSubmit: true } },
    { id: "solo" },
  ];

  it("computes initial visibility", () => {
    expect([...computeInitialVisibleWidgetIds(buttons)].sort()).toEqual(["f1", "solo"]);
  });

  it("finds roots and members", () => {
    expect(findChainRootId(buttons, "f3")).toBe("f1");
    expect(findChainRootId(buttons, "solo")).toBe("solo");
    expect(getChainMemberIds(buttons, "f1")).toEqual(["f1", "f2", "f3"]);
  });

  it("guards cycles", () => {
    const cyc = [
      { id: "a", sequenceConfig: { nextWidgetId: "b" } },
      { id: "b", sequenceConfig: { nextWidgetId: "a" } },
    ];
    expect(getChainMemberIds(cyc, "a")).toEqual(["a", "b"]);
    expect(["a", "b"]).toContain(findChainRootId(cyc, "a"));
  });

  it("detects sequence membership", () => {
    expect(isWidgetInFormSequence(buttons, "f2")).toBe(true);
    expect(isWidgetInFormSequence(buttons, "solo")).toBe(false);
    expect(isWidgetInFormSequence([{ id: "x" }, { id: "y", sequenceConfig: { nextWidgetId: "x" } }], "x")).toBe(true);
  });
});
