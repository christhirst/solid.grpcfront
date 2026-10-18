import crypto from "crypto";

export interface S3ObjectItem {
  key: string;
  name: string;
  bucket: string;
  s3Uri: string;
  size: number;
  lastModified?: string;
  etag?: string;
}

export interface S3ListOptions {
  endpoint: string;
  region?: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  prefix?: string;
  delimiter?: string;
  maxKeys?: number;
  forcePathStyle?: boolean;
  caCert?: string;
  acceptInvalidCert?: boolean;
  /** Optional filename/key filter pattern (e.g. "*.csv", "2026-*", or substring) */
  pattern?: string;
  /** Optional explicit list of object keys or s3:// URIs selected by user */
  selectedKeys?: string[];
  /** Output format preference for files/file fields (default: "s3_uri") */
  outputFormat?: "s3_uri" | "key" | "filename";
}

export interface S3ListResult {
  success: boolean;
  bucket: string;
  endpoint: string;
  prefix?: string;
  objects: S3ObjectItem[];
  commonPrefixes: string[];
  /** Primary single S3 URI ("s3://bucket/key") */
  uri: string;
  /** Array of all matched S3 URIs (["s3://bucket/key1", ...]) */
  uris: string[];
  /** Single formatted file reference according to outputFormat (defaults to s3://bucket/key) */
  file: string;
  /** Array of formatted file references according to outputFormat (defaults to ["s3://bucket/key1", ...]) */
  files: string[];
  /** Single object key ("folder/file.csv") */
  key: string;
  /** Array of object keys (["folder/file.csv", ...]) */
  keys: string[];
  /** Single basename ("file.csv") */
  filename: string;
  /** Array of basenames (["file.csv", ...]) */
  filenames: string[];
  count: number;
  latencyMs: number;
  error?: string;
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? decodeXmlEntities(match[1].trim()) : undefined;
}

function extractAllXmlBlocks(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

/**
 * Matches a key or filename against a glob pattern (e.g. "*.csv", "data/*.parquet") or substring.
 */
export function matchesS3Pattern(key: string, pattern?: string): boolean {
  if (!pattern || !pattern.trim()) return true;
  const p = pattern.trim();
  const basename = key.split("/").filter(Boolean).pop() || key;

  if (p.includes("*") || p.includes("?")) {
    const escaped = p
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp(`^${escaped}$`, "i");
    return regex.test(key) || regex.test(basename);
  }

  const lowerP = p.toLowerCase();
  return key.toLowerCase().includes(lowerP) || basename.toLowerCase().includes(lowerP);
}

/**
 * Normalizes a key or s3://bucket/key into a clean object key and s3:// URI.
 */
export function toS3ObjectItem(bucket: string, rawKeyOrUri: string, meta?: Partial<S3ObjectItem>): S3ObjectItem {
  let cleanBucket = (bucket || "").trim().replace(/^s3:\/\//i, "").replace(/\/+$/, "");
  let cleanKey = (rawKeyOrUri || "").trim();

  if (cleanKey.startsWith("s3://")) {
    const withoutScheme = cleanKey.slice(5);
    const slashIdx = withoutScheme.indexOf("/");
    if (slashIdx !== -1) {
      if (!cleanBucket) cleanBucket = withoutScheme.slice(0, slashIdx);
      cleanKey = withoutScheme.slice(slashIdx + 1);
    } else {
      cleanKey = withoutScheme;
    }
  } else {
    cleanKey = cleanKey.replace(/^\/+/, "");
  }

  const name = cleanKey.split("/").filter(Boolean).pop() || cleanKey;
  const s3Uri = cleanBucket ? `s3://${cleanBucket}/${cleanKey}` : `s3://${cleanKey}`;

  return {
    key: cleanKey,
    name,
    bucket: cleanBucket,
    s3Uri,
    size: meta?.size ?? 0,
    lastModified: meta?.lastModified,
    etag: meta?.etag,
  };
}

/**
 * Formats an S3ListResult from a list of S3ObjectItems.
 */
export function buildS3ListResult(
  bucket: string,
  endpoint: string,
  prefix: string | undefined,
  objects: S3ObjectItem[],
  commonPrefixes: string[],
  outputFormat: "s3_uri" | "key" | "filename" = "s3_uri",
  latencyMs = 0,
): S3ListResult {
  const uris = objects.map((o) => o.s3Uri);
  const keys = objects.map((o) => o.key);
  const filenames = objects.map((o) => o.name);

  const files =
    outputFormat === "key"
      ? keys
      : outputFormat === "filename"
        ? filenames
        : uris;

  return {
    success: true,
    bucket,
    endpoint,
    prefix,
    objects,
    commonPrefixes,
    uri: uris[0] || "",
    uris,
    file: files[0] || "",
    files,
    key: keys[0] || "",
    keys,
    filename: filenames[0] || "",
    filenames,
    count: objects.length,
    latencyMs,
  };
}

/**
 * Signs an S3 HTTP GET request using AWS Signature V4.
 */
export function signS3RequestV4(params: {
  method: string;
  url: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  now?: Date;
}): Record<string, string> {
  const { method, url, region, accessKeyId, secretAccessKey, sessionToken, now = new Date() } = params;
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = iso.slice(0, 8);
  const payloadHash = sha256Hex("");

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": iso,
  };

  if (sessionToken) {
    headers["x-amz-security-token"] = sessionToken;
  }

  // Canonical URI
  const canonicalUri = url.pathname
    .split("/")
    .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
    .join("/") || "/";

  // Canonical Query String (sorted by parameter name)
  const queryPairs: Array<[string, string]> = [];
  url.searchParams.forEach((val, key) => {
    queryPairs.push([encodeRfc3986(key), encodeRfc3986(val)]);
  });
  queryPairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const canonicalQueryString = queryPairs.map(([k, v]) => `${k}=${v}`).join("&");

  // Canonical Headers
  const sortedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const canonicalHeaders = sortedHeaderKeys.map((k) => `${k}:${headers[k].trim()}\n`).join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    iso,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  headers["Authorization"] =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

/**
 * Lists objects in an S3 bucket using S3 ListObjectsV2 REST API without downloading object contents.
 */
export async function listS3Objects(options: S3ListOptions): Promise<S3ListResult> {
  const startTime = Date.now();
  const cleanBucket = (options.bucket || "").trim().replace(/^s3:\/\//i, "").replace(/\/+$/, "");
  const region = (options.region || "us-east-1").trim() || "us-east-1";
  const outputFormat = options.outputFormat || "s3_uri";
  let rawEndpoint = (options.endpoint || "https://s3.amazonaws.com").trim();

  if (!cleanBucket) {
    return {
      success: false,
      bucket: "",
      endpoint: rawEndpoint,
      objects: [],
      commonPrefixes: [],
      uri: "",
      uris: [],
      file: "",
      files: [],
      key: "",
      keys: [],
      filename: "",
      filenames: [],
      count: 0,
      latencyMs: 0,
      error: "S3 bucket name is required.",
    };
  }

  if (rawEndpoint && !rawEndpoint.startsWith("http://") && !rawEndpoint.startsWith("https://")) {
    rawEndpoint = `https://${rawEndpoint}`;
  }

  try {
    const baseUrl = new URL(rawEndpoint);
    const forcePathStyle = options.forcePathStyle !== undefined ? options.forcePathStyle : true;

    let targetUrl: URL;
    if (forcePathStyle) {
      const basePath = baseUrl.pathname.replace(/\/+$/, "");
      // Avoid duplicating bucket in path if user already included it in endpoint URL
      const pathEndsWithBucket = basePath === `/${cleanBucket}` || basePath.endsWith(`/${cleanBucket}`);
      const fullPath = pathEndsWithBucket ? `${basePath}/` : `${basePath}/${encodeURIComponent(cleanBucket)}`;
      targetUrl = new URL(fullPath, baseUrl.origin);
    } else {
      const host = baseUrl.host.startsWith(`${cleanBucket}.`) ? baseUrl.host : `${cleanBucket}.${baseUrl.host}`;
      targetUrl = new URL(`${baseUrl.protocol}//${host}${baseUrl.pathname}`);
    }

    targetUrl.searchParams.set("list-type", "2");
    if (options.prefix && options.prefix.trim()) {
      targetUrl.searchParams.set("prefix", options.prefix.trim().replace(/^\/+/, ""));
    }
    if (options.delimiter) {
      targetUrl.searchParams.set("delimiter", options.delimiter);
    }
    const maxKeys = options.maxKeys && options.maxKeys > 0 ? Math.min(options.maxKeys, 1000) : 200;
    targetUrl.searchParams.set("max-keys", String(maxKeys));

    let headers: Record<string, string> = {
      Accept: "application/xml, text/xml, */*",
    };

    if (options.accessKeyId && options.secretAccessKey) {
      const signedHeaders = signS3RequestV4({
        method: "GET",
        url: targetUrl,
        region,
        accessKeyId: options.accessKeyId.trim(),
        secretAccessKey: options.secretAccessKey.trim(),
        sessionToken: options.sessionToken?.trim() || undefined,
      });
      headers = { ...headers, ...signedHeaders };
    }

    const fetchOptions: any = {
      method: "GET",
      headers,
    };

    if (options.caCert || options.acceptInvalidCert) {
      fetchOptions.tls = {
        ca: options.caCert,
        rejectUnauthorized: !options.acceptInvalidCert,
      };
    }

    const res = await fetch(targetUrl.toString(), fetchOptions);
    const latencyMs = Date.now() - startTime;
    const xmlText = await res.text();

    if (!res.ok) {
      const errCode = extractXmlTag(xmlText, "Code");
      const errMsg = extractXmlTag(xmlText, "Message");
      const detail = errCode || errMsg ? `${errCode || "S3Error"}: ${errMsg || xmlText.slice(0, 300)}` : xmlText.slice(0, 300);
      return {
        success: false,
        bucket: cleanBucket,
        endpoint: rawEndpoint,
        prefix: options.prefix,
        objects: [],
        commonPrefixes: [],
        uri: "",
        uris: [],
        file: "",
        files: [],
        key: "",
        keys: [],
        filename: "",
        filenames: [],
        count: 0,
        latencyMs,
        error: `S3 HTTP ${res.status}: ${detail}`,
      };
    }

    // Parse <Contents> blocks from S3 ListObjectsV2 XML (or JSON if a custom mock returns JSON)
    let objects: S3ObjectItem[] = [];
    const commonPrefixes: string[] = [];

    const trimmedBody = xmlText.trim();
    if (trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
      try {
        const parsedJson = JSON.parse(trimmedBody);
        const rawList = Array.isArray(parsedJson) ? parsedJson : (parsedJson.objects || parsedJson.Contents || []);
        for (const item of rawList) {
          const key = typeof item === "string" ? item : (item.key || item.Key || "");
          if (!key || key.endsWith("/")) continue;
          objects.push(
            toS3ObjectItem(cleanBucket, key, {
              size: Number(item.size ?? item.Size ?? 0),
              lastModified: item.lastModified ?? item.LastModified,
              etag: item.etag ?? item.ETag,
            }),
          );
        }
      } catch {}
    } else {
      const contentBlocks = extractAllXmlBlocks(xmlText, "Contents");
      for (const block of contentBlocks) {
        const key = extractXmlTag(block, "Key");
        if (!key || key.endsWith("/")) continue; // Skip folder placeholder keys
        const sizeStr = extractXmlTag(block, "Size");
        const lastModified = extractXmlTag(block, "LastModified");
        const etag = extractXmlTag(block, "ETag")?.replace(/^"+|"+$/g, "");
        objects.push(
          toS3ObjectItem(cleanBucket, key, {
            size: sizeStr ? Number(sizeStr) : 0,
            lastModified,
            etag,
          }),
        );
      }

      const prefixBlocks = extractAllXmlBlocks(xmlText, "CommonPrefixes");
      for (const block of prefixBlocks) {
        const p = extractXmlTag(block, "Prefix");
        if (p) commonPrefixes.push(p);
      }
    }

    // Apply optional pattern filter
    if (options.pattern && options.pattern.trim()) {
      objects = objects.filter((obj) => matchesS3Pattern(obj.key, options.pattern));
    }

    // Apply optional explicit selectedKeys filter
    if (Array.isArray(options.selectedKeys) && options.selectedKeys.length > 0) {
      const normalizedSelected = new Set(
        options.selectedKeys
          .map((k) => toS3ObjectItem(cleanBucket, k).key)
          .filter(Boolean),
      );
      if (normalizedSelected.size > 0) {
        const matchedMap = new Map(objects.map((o) => [o.key, o]));
        const selectedObjects: S3ObjectItem[] = [];
        for (const selKey of normalizedSelected) {
          const existing = matchedMap.get(selKey);
          if (existing) {
            selectedObjects.push(existing);
          } else {
            selectedObjects.push(toS3ObjectItem(cleanBucket, selKey));
          }
        }
        objects = selectedObjects;
      }
    }

    return buildS3ListResult(
      cleanBucket,
      rawEndpoint,
      options.prefix,
      objects,
      commonPrefixes,
      outputFormat,
      latencyMs,
    );
  } catch (err: any) {
    return {
      success: false,
      bucket: cleanBucket,
      endpoint: rawEndpoint,
      prefix: options.prefix,
      objects: [],
      commonPrefixes: [],
      uri: "",
      uris: [],
      file: "",
      files: [],
      key: "",
      keys: [],
      filename: "",
      filenames: [],
      count: 0,
      latencyMs: Date.now() - startTime,
      error: `S3 Request Failed: ${err.message}`,
    };
  }
}
