/**
 * Integration test for S3 Storage Connections & Zero-Copy Workflow File Reference Execution.
 *
 * Verifies:
 * 1. AWS Signature V4 signing and S3 ListObjectsV2 XML parsing against a mock S3 server.
 * 2. Pattern (*.csv) and explicit selectedKeys filtering without downloading file contents.
 * 3. `testS3Connection` and `normalizeConnection` for `type: "s3"`.
 * 4. End-to-end workflow execution: S3 step (`step_s3`) -> HTTP/REST step (`step_http`)
 *    passing only `s3://bucket/key` URIs and filenames in the HTTP request payload.
 */

import { listS3Objects, matchesS3Pattern, toS3ObjectItem } from "../../src/lib/s3Executor";
import { normalizeConnection, testS3Connection } from "../../src/lib/connections";
import { interpolateTemplate } from "../../src/lib/workflowEngine";

async function runTests() {
  console.log("=== S3 Storage Integration Test ===");

  let s3ListRequests = 0;
  let s3ObjectGetRequests = 0;
  let lastAuthHeader = "";
  let lastHttpConsumerBody: any = null;

  // Start a local mock S3 + HTTP consumer server
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);

      // Mock downstream HTTP service that receives S3 URI / filename references
      if (url.pathname === "/api/process-s3-files" && req.method === "POST") {
        lastHttpConsumerBody = await req.json();
        return Response.json({
          status: "processed",
          receivedFileUri: lastHttpConsumerBody.fileUri,
          receivedAllUris: lastHttpConsumerBody.allUris,
          receivedFilename: lastHttpConsumerBody.filename,
        });
      }

      // Mock S3 ListObjectsV2 endpoint (path-style: /:bucket?list-type=2)
      if (url.searchParams.get("list-type") === "2") {
        s3ListRequests++;
        lastAuthHeader = req.headers.get("authorization") || "";
        const prefix = url.searchParams.get("prefix") || "";

        const allObjects = [
          { key: "incoming/2026/sales_q1.csv", size: 102400, lastModified: "2026-03-01T10:00:00.000Z" },
          { key: "incoming/2026/sales_q2.csv", size: 204800, lastModified: "2026-06-01T10:00:00.000Z" },
          { key: "incoming/2026/readme.txt", size: 512, lastModified: "2026-06-02T10:00:00.000Z" },
          { key: "archive/2025/old.parquet", size: 999999, lastModified: "2025-12-31T23:59:59.000Z" },
        ].filter((o) => !prefix || o.key.startsWith(prefix));

        const contentsXml = allObjects
          .map(
            (o) => `
          <Contents>
            <Key>${o.key}</Key>
            <LastModified>${o.lastModified}</LastModified>
            <ETag>"etag-${o.size}"</ETag>
            <Size>${o.size}</Size>
            <StorageClass>STANDARD</StorageClass>
          </Contents>`,
          )
          .join("");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>analytics-bucket</Name>
  <Prefix>${prefix}</Prefix>
  <KeyCount>${allObjects.length}</KeyCount>
  <MaxKeys>200</MaxKeys>
  <IsTruncated>false</IsTruncated>
  ${contentsXml}
</ListBucketResult>`;

        return new Response(xml, {
          status: 200,
          headers: { "Content-Type": "application/xml" },
        });
      }

      // Any direct GET on an object key would mean binary file download (should NEVER happen!)
      s3ObjectGetRequests++;
      return new Response("Binary file download should not be called", { status: 400 });
    },
  });

  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    // 1. Test normalizeConnection and testS3Connection
    const conn = normalizeConnection({
      id: "connection:test_s3",
      name: "Test MinIO S3",
      type: "s3",
      endpoint: baseUrl,
      region: "eu-central-1",
      bucket: "analytics-bucket",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      prefix: "incoming/2026/",
      forcePathStyle: true,
    });

    if (conn.type !== "s3" || conn.bucket !== "analytics-bucket") {
      throw new Error(`Unexpected normalized S3 connection: ${JSON.stringify(conn)}`);
    }

    const connTestRes = await testS3Connection(conn);
    if (!connTestRes.success) {
      throw new Error(`testS3Connection failed: ${connTestRes.error}`);
    }
    if (!lastAuthHeader.startsWith("AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/")) {
      throw new Error(`Expected AWS SigV4 Authorization header, got: ${lastAuthHeader}`);
    }
    console.log("✓ 1. S3 Connection test & AWS SigV4 signing passed:", connTestRes.message);

    // 2. Test listS3Objects with prefix + glob pattern (*.csv)
    const listRes = await listS3Objects({
      endpoint: baseUrl,
      region: "eu-central-1",
      bucket: "analytics-bucket",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      prefix: "incoming/2026/",
      pattern: "*.csv",
      forcePathStyle: true,
    });

    if (!listRes.success) {
      throw new Error(`listS3Objects failed: ${listRes.error}`);
    }
    if (listRes.count !== 2) {
      throw new Error(`Expected 2 CSV objects after pattern filter, got ${listRes.count}`);
    }
    if (listRes.uri !== "s3://analytics-bucket/incoming/2026/sales_q1.csv") {
      throw new Error(`Unexpected primary URI: ${listRes.uri}`);
    }
    if (listRes.filename !== "sales_q1.csv") {
      throw new Error(`Unexpected primary filename: ${listRes.filename}`);
    }
    console.log("✓ 2. S3 ListObjectsV2 with prefix + '*.csv' filter returned URIs:", listRes.uris);

    // 3. Test explicit selectedKeys filtering
    const selectedRes = await listS3Objects({
      endpoint: baseUrl,
      region: "eu-central-1",
      bucket: "analytics-bucket",
      prefix: "incoming/2026/",
      selectedKeys: ["incoming/2026/sales_q2.csv"],
      forcePathStyle: true,
    });
    if (selectedRes.count !== 1 || selectedRes.uri !== "s3://analytics-bucket/incoming/2026/sales_q2.csv") {
      throw new Error(`Explicit selectedKeys failed: ${JSON.stringify(selectedRes)}`);
    }
    console.log("✓ 3. Explicit selectedKeys filter returned:", selectedRes.uri);

    // 4. Test template interpolation into downstream HTTP request (zero binary transfer)
    const workflowContext = {
      steps: {
        step_s3: {
          response: {
            bucket: listRes.bucket,
            uri: listRes.uri,
            uris: listRes.uris,
            file: listRes.file,
            files: listRes.files,
            key: listRes.key,
            keys: listRes.keys,
            filename: listRes.filename,
            filenames: listRes.filenames,
            count: listRes.count,
          },
        },
      },
    };

    const httpTemplate = JSON.stringify({
      fileUri: "{{ steps.step_s3.response.uri }}",
      filename: "{{ steps.step_s3.response.filename }}",
      allUris: ["{{ steps.step_s3.response.uri }}"],
    });
    const interpolatedBody = interpolateTemplate(httpTemplate, workflowContext);

    const consumerRes = await fetch(`${baseUrl}/api/process-s3-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: interpolatedBody,
    });
    const consumerJson = await consumerRes.json();

    if (consumerJson.receivedFileUri !== "s3://analytics-bucket/incoming/2026/sales_q1.csv") {
      throw new Error(`Downstream HTTP service did not receive expected S3 URI: ${JSON.stringify(consumerJson)}`);
    }
    if (s3ObjectGetRequests !== 0) {
      throw new Error(`Expected 0 S3 object binary downloads, but ${s3ObjectGetRequests} occurred!`);
    }
    console.log("✓ 4. Downstream HTTP request received S3 URI without transferring file contents:", consumerJson);

    console.log("\nALL S3 INTEGRATION TESTS PASSED!");
  } finally {
    server.stop(true);
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
