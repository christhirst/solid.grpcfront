import fetch from 'node-fetch';

async function run() {
  console.log("Saving workflow...");
  const saveRes = await fetch('http://localhost:3000/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "Test Flow",
      protoContent: "syntax=\"proto3\"; package flow;",
      serverAddress: "localhost:50051",
      useTls: false,
      steps: []
    })
  });
  const saveJson = await saveRes.json();
  console.log("Save Response:", saveJson);

  if (!saveJson.success) return;

  const wfId = saveJson.data.id.split(':')[1];
  console.log("Running workflow:", wfId);

  const runRes = await fetch(`http://localhost:3000/api/workflows/${wfId}/run`, {
    method: 'POST'
  });
  const runJson = await runRes.json();
  console.log("Run Response:", runJson);

  if (!runJson.success) return;

  const runId = runJson.runId.split(':')[1];
  console.log("Polling run ID:", runId);

  for (let i = 0; i < 5; i++) {
    const pollRes = await fetch(`http://localhost:3000/api/workflows/runs/${runId}`);
    const pollJson = await pollRes.json();
    console.log(`Poll ${i}:`, pollJson);
    if (pollJson.success && (pollJson.data.status === 'completed' || pollJson.data.status === 'failed')) {
      console.log("Finished!");
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

run();
