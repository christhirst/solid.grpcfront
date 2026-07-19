async function run() {
  const workflowId = "472b8245-80fe-434a-8abd-f9d4e561226d";
  const url = `http://127.0.0.1:3003/api/workflows/${workflowId}/run`;
  
  console.log("Triggering workflow run via API...", url);
  try {
    const res = await fetch(url, { method: "POST" });
    const json = await res.json();
    console.log("Response status:", res.status);
    console.log("Response body:", JSON.stringify(json, null, 2));
  } catch (e: any) {
    console.error("Fetch failed:", e.message);
  }
}

run().then(() => process.exit(0)).catch(() => process.exit(1));
