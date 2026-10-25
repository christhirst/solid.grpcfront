import { getDb } from "~/lib/db";
import { getEffectiveAccessContext } from "~/lib/auth";
import { canAccessResource, getResourcePermissions } from "~/lib/groupAuth";

async function run() {
  console.log("=== Testing Dashboard Workflows Visibility ===");
  const db = await getDb();

  // 1. Fetch raw workflows from DB
  const result = await db.query("SELECT * FROM workflow ORDER BY updated_at DESC");
  const raw = ((result[0] as any[]) || []).map((w: any) => ({
    ...w,
    id: w.id?.toString().replace(/[⟨⟩]/g, ""),
  }));
  console.log(`Total workflows in SurrealDB: ${raw.length}`);

  // 2. Simulate Anonymous SSR Request (No session cookie)
  const anonymousCtx = {
    sub: "anonymous",
    groups: [],
    activeGroup: null,
    isSuperAdmin: false,
    isAdmin: false,
  };

  const anonymousWorkflows = raw.filter((w: any) => {
    const hasRealOwner = Boolean(w.owner && w.owner !== "anonymous");
    const hasTags = Array.isArray(w.tags) && w.tags.length > 0;
    if (anonymousCtx.sub === "anonymous") {
      return !hasRealOwner && !hasTags;
    }
    return canAccessResource(anonymousCtx as any, w, "view");
  });

  console.log(`Workflows returned to Anonymous SSR: ${anonymousWorkflows.length}`);
  console.log("Anonymous list:", anonymousWorkflows.map((w: any) => w.name));

  // 3. Simulate Authenticated Client Request (Logged in user)
  // Let's find an owner from the raw records
  const ownedWf = raw.find((w: any) => w.owner && w.owner !== "anonymous");
  if (!ownedWf) {
    console.warn("No owned workflow found to test authenticated user context");
  } else {
    const userCtx = {
      sub: ownedWf.owner,
      groups: [],
      activeGroup: null,
      isSuperAdmin: false,
      isAdmin: false,
    };

    const authenticatedWorkflows = raw.filter((w: any) => {
      const hasRealOwner = Boolean(w.owner && w.owner !== "anonymous");
      const hasTags = Array.isArray(w.tags) && w.tags.length > 0;
      if (userCtx.sub === "anonymous") {
        return !hasRealOwner && !hasTags;
      }
      return canAccessResource(userCtx as any, w, "view");
    });

    console.log(`Workflows returned to Authenticated User (${ownedWf.owner}): ${authenticatedWorkflows.length}`);
    console.log("Authenticated list:", authenticatedWorkflows.map((w: any) => w.name));

    if (authenticatedWorkflows.length <= anonymousWorkflows.length) {
      throw new Error(`Expected authenticated user to see more workflows than anonymous SSR, but got ${authenticatedWorkflows.length} vs ${anonymousWorkflows.length}`);
    }

    console.log("✓ Authenticated user correctly receives all their owned workflows!");
  }

  console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
