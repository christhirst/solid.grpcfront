import { evaluateNewsRules, type NewsRule } from "../../src/lib/newsRulesEvaluator";


async function runTests() {
  console.log("=== Testing News Widget Rules & Dashboard Text Variable Integration ===");
  let passed = 0;

  // Test 1: News Rules Evaluation
  console.log("\n[Test 1] Testing IF/ELSE News Rules evaluation...");
  const rules: NewsRule[] = [
    { id: "1", operator: "contains", value: "error", color: "red", textTemplate: "CRITICAL ALERT: {{ value }}" },
    { id: "2", operator: "gt", value: "80", color: "amber", textTemplate: "HIGH VALUE: {{ value }}" },
    { id: "3", operator: "equals", value: "ok", color: "emerald", textTemplate: "ALL SYSTEMS GO: {{ value }}" },
    { id: "4", operator: "default", value: "", color: "blue", textTemplate: "INFO: {{ value }}" },
  ];

  const res1 = evaluateNewsRules("Database connection error: timeout", rules);
  console.log(" Input 1 ('error') ->", res1);
  if (res1.color === "red" && res1.text.includes("CRITICAL ALERT")) passed++;

  const res2 = evaluateNewsRules(95, rules);
  console.log(" Input 2 (95 > 80) ->", res2);
  if (res2.color === "amber" && res2.text.includes("HIGH VALUE")) passed++;

  const res3 = evaluateNewsRules("OK", rules);
  console.log(" Input 3 ('OK') ->", res3);
  if (res3.color === "emerald" && res3.text.includes("ALL SYSTEMS GO")) passed++;

  const res4 = evaluateNewsRules("Random status line", rules);
  console.log(" Input 4 (default fallback) ->", res4);
  if (res4.color === "blue" && res4.text.includes("INFO:")) passed++;

  console.log(`\n=== DASHBOARD WIDGET TESTS: ${passed}/4 PASSED ===`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
