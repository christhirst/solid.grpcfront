// Unit test for dashboard filtering logic by name, description, and tags

interface TestDashboard {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  buttons?: any[];
  isPublic?: boolean;
}

function filterDashboards(
  dashboards: TestDashboard[],
  search: string,
  selectedTags: string[],
  widgetFilter: string
): TestDashboard[] {
  let list = [...dashboards];
  const q = search.toLowerCase().trim();

  if (q) {
    list = list.filter((d) => {
      const nameMatch = (d.name || "").toLowerCase().includes(q);
      const descMatch = (d.description || "").toLowerCase().includes(q);
      const tagMatch = (d.tags || []).some((t) => t.toLowerCase().includes(q));
      const widgetMatch = (d.buttons || []).some((b: any) =>
        (b.label || "").toLowerCase().includes(q) || (b.widgetType || "").toLowerCase().includes(q)
      );
      return nameMatch || descMatch || tagMatch || widgetMatch;
    });
  }

  if (widgetFilter !== "all") {
    list = list.filter((d) =>
      (d.buttons || []).some((b: any) => (b.widgetType || "button") === widgetFilter)
    );
  }

  if (selectedTags.length > 0) {
    list = list.filter((d) =>
      selectedTags.every((st) => (d.tags || []).includes(st))
    );
  }

  return list;
}

async function run() {
  console.log("=== Testing Dashboard Description and Tags Filter Logic ===");

  const sampleDashboards: TestDashboard[] = [
    {
      id: "dash_1",
      name: "DevOps Monitoring",
      description: "Live cluster health and latency metrics",
      tags: ["production", "k8s", "infra"],
      buttons: [{ widgetType: "chart", label: "CPU Usage" }],
    },
    {
      id: "dash_2",
      name: "Billing Analytics",
      description: "Monthly recurring revenue and invoice tracking",
      tags: ["finance", "production"],
      buttons: [{ widgetType: "table", label: "Invoices" }],
    },
    {
      id: "dash_3",
      name: "Staging Pipeline",
      description: "CI/CD automated runs and test results",
      tags: ["staging", "ci"],
      buttons: [{ widgetType: "button", label: "Deploy" }],
    },
  ];

  let passed = 0;

  // Test 1: Filter by tag (single tag)
  const res1 = filterDashboards(sampleDashboards, "", ["production"], "all");
  console.log("Test 1: Filter by tag 'production' -> count:", res1.length);
  if (res1.length === 2 && res1.map((d) => d.id).sort().join(",") === "dash_1,dash_2") {
    passed++;
  }

  // Test 2: Filter by multiple tags (AND logic)
  const res2 = filterDashboards(sampleDashboards, "", ["production", "k8s"], "all");
  console.log("Test 2: Filter by tags ['production', 'k8s'] -> count:", res2.length);
  if (res2.length === 1 && res2[0].id === "dash_1") {
    passed++;
  }

  // Test 3: Search by description keyword
  const res3 = filterDashboards(sampleDashboards, "latency", [], "all");
  console.log("Test 3: Search by description 'latency' -> count:", res3.length);
  if (res3.length === 1 && res3[0].id === "dash_1") {
    passed++;
  }

  // Test 4: Search by tag name in search query
  const res4 = filterDashboards(sampleDashboards, "finance", [], "all");
  console.log("Test 4: Search by tag name 'finance' in search bar -> count:", res4.length);
  if (res4.length === 1 && res4[0].id === "dash_2") {
    passed++;
  }

  // Test 5: Search with no matches
  const res5 = filterDashboards(sampleDashboards, "nonexistent", [], "all");
  console.log("Test 5: Search with non-existent term -> count:", res5.length);
  if (res5.length === 0) {
    passed++;
  }

  console.log(`\n=== RESULTS: ${passed}/5 PASSED ===`);
  if (passed !== 5) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
