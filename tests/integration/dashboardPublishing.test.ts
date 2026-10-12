import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Surreal, RecordId } from "surrealdb";
import { getUserProfile, saveUserNamespace, saveDashboard, resolvePublicDashboard, publishingErrorResponse } from "../../src/lib/dashboard/publishing";

// Run against a local, disposable SurrealDB: SURREAL_TEST_URL=http://127.0.0.1:18081 bun test tests/integration/dashboardPublishing.test.ts
describe.skipIf(!process.env.SURREAL_TEST_URL)("dashboard publishing (SurrealDB)", () => {
  const db = new Surreal();
  const database = `publishing_${crypto.randomUUID().replaceAll("-", "")}`;

  beforeAll(async () => {
    await db.connect(process.env.SURREAL_TEST_URL!, { connection: { timeout: 5000 } });
    await db.query(`DEFINE NAMESPACE IF NOT EXISTS publishing_tests; USE NS publishing_tests; DEFINE DATABASE ${database}; USE DB ${database};`);
    await db.use({ namespace: "publishing_tests", database });
  });

  afterAll(async () => {
    try { await db.query(`REMOVE DATABASE ${database};`); } finally { await db.close(); }
  });

  test("namespace is required to publish; drafts remain saveable", async () => {
    const draft = await saveDashboard(db, "new-user", "draft", { name: "Draft", slug: "draft" }, true);
    expect(draft.isPublic).toBe(false);
    await expect(saveDashboard(db, "new-user", "draft", { isPublic: true })).rejects.toThrow("Set a namespace");
    expect(await getUserProfile(db, "new-user")).toEqual({ namespace: "" });
  });

  test("namespaces are unique and conflicts return an actionable 409", async () => {
    await saveUserNamespace(db, "alice", "team-a");
    try {
      await saveUserNamespace(db, "bob", "team-a");
      throw new Error("Expected a namespace conflict");
    } catch (error) {
      const response = publishingErrorResponse(error);
      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain("already taken");
    }
    await saveUserNamespace(db, "bob", "team-b");
  });

  test("slugs are unique per namespace, preserve ownership, and resolve to real IDs", async () => {
    const alice = await saveDashboard(db, "alice", "sales-a", { name: "Monthly Sales", isPublic: true }, true);
    await saveDashboard(db, "bob", "sales-b", { name: "Monthly Sales", isPublic: true }, true);
    expect(alice.slug).toBe("monthly-sales");
    expect((await resolvePublicDashboard(db, "team-a", "monthly-sales"))?.id).toBe("dashboard:sales-a");
    expect((await resolvePublicDashboard(db, "team-b", "monthly-sales"))?.id).toBe("dashboard:sales-b");
    await expect(saveDashboard(db, "alice", "duplicate", { slug: "monthly-sales", isPublic: true }, true)).rejects.toThrow("dashboard_public_url");
    const updated = await saveDashboard(db, "alice", "sales-a", { name: "New Title", owner: "bob", created_at: "fake" });
    expect(updated.owner).toBe("alice");
    expect(updated.created_at).toBe(alice.created_at);
    expect(updated.slug).toBe("monthly-sales");
    await expect(saveDashboard(db, "bob", "sales-a", { slug: "stolen" })).rejects.toThrow("Only the dashboard owner");
    await expect(saveDashboard(db, "bob", "other", { namespace: "team-a", slug: "stolen", isPublic: true }, true)).rejects.toThrow("user settings");
  });

  test("renames update dashboard URLs atomically; rejected renames leave URLs intact", async () => {
    await expect(saveUserNamespace(db, "alice", "team-b")).rejects.toThrow("user_namespace");
    expect((await resolvePublicDashboard(db, "team-a", "monthly-sales"))?.id).toBe("dashboard:sales-a");
    await saveUserNamespace(db, "alice", "renamed-team");
    expect(await resolvePublicDashboard(db, "team-a", "monthly-sales")).toBeNull();
    expect((await resolvePublicDashboard(db, "renamed-team", "monthly-sales"))?.id).toBe("dashboard:sales-a");
    await saveDashboard(db, "alice", "sales-a", { slug: "overview" });
    expect(await resolvePublicDashboard(db, "renamed-team", "monthly-sales")).toBeNull();
    expect((await resolvePublicDashboard(db, "renamed-team", "overview"))?.id).toBe("dashboard:sales-a");
  });

  test("unpublished dashboards and malformed URLs do not resolve", async () => {
    await saveDashboard(db, "alice", "sales-a", { isPublic: false });
    expect(await resolvePublicDashboard(db, "renamed-team", "overview")).toBeNull();
    expect(await resolvePublicDashboard(db, "../renamed-team", "overview")).toBeNull();
    const record: any = await db.select(new RecordId("dashboard", "sales-a"));
    expect(record.id.id).toBe("sales-a");
  });

  test("concurrent claims cannot create duplicate dashboard URLs", async () => {
    const results = await Promise.allSettled([
      saveDashboard(db, "alice", "race-a", { slug: "racing", isPublic: true }, true),
      saveDashboard(db, "alice", "race-b", { slug: "racing", isPublic: true }, true),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
});
