import { describe, expect, it } from "bun:test";
import jsonata from "jsonata";
import {
  applySed,
  applyGrep,
  executeShellPipeline,
  executeTextTransform,
  normalizeToPem,
  registerJsonataTextFunctions,
} from "./textProcessor";

describe("textProcessor - sed / grep / OpenBao PEM pipeline", () => {
  const openBaoRawCaChainFile = `[
  "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoRootCA111111\\n-----END CERTIFICATE-----",
  "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoSubCA2222222\\n-----END CERTIFICATE-----"
]`;

  const expectedPem = [
    "-----BEGIN CERTIFICATE-----",
    "MIIBszCCAVmgAwIBAgIUOpenBaoRootCA111111",
    "-----END CERTIFICATE-----",
    "-----BEGIN CERTIFICATE-----",
    "MIIBszCCAVmgAwIBAgIUOpenBaoSubCA2222222",
    "-----END CERTIFICATE-----",
  ].join("\n");

  it("executes the exact OpenBao sed + grep shell pipeline command", () => {
    const cmd = `sed 's/\\n/\n/g; s/["[],]//g' ca_chain.crt | grep -v '^[[:space:]]*$' > fixed_ca.pem`;
    const output = executeShellPipeline(openBaoRawCaChainFile, cmd);
    const trimmedLines = output
      .split("\n")
      .map((l) => l.trim())
      .join("\n");
    expect(trimmedLines).toBe(expectedPem);
  });

  it("processes OpenBao JSON object via executeTextTransform with inputPath and pipeline", () => {
    const openBaoApiResponse = {
      request_id: "3480-991a",
      data: {
        ca_chain: [
          "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoRootCA111111\\n-----END CERTIFICATE-----",
          "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoSubCA2222222\\n-----END CERTIFICATE-----",
        ],
      },
    };

    const result = executeTextTransform(openBaoApiResponse, {
      inputPath: "data.ca_chain",
      mode: "pipeline",
      pipelineCommand: `sed 's/\\n/\n/g; s/["[],]//g' | grep -v '^[[:space:]]*$'`,
      outputFormat: "string",
    });

    expect(result).toBe(expectedPem);
  });

  it("normalizes OpenBao certificates directly via normalizeToPem and visual operations", () => {
    const openBaoApiResponse = {
      data: {
        ca_chain: [
          "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoRootCA111111\\n-----END CERTIFICATE-----",
          "-----BEGIN CERTIFICATE-----\\nMIIBszCCAVmgAwIBAgIUOpenBaoSubCA2222222\\n-----END CERTIFICATE-----",
        ],
      },
    };

    expect(normalizeToPem(openBaoApiResponse)).toBe(expectedPem);

    const chainedResult = executeTextTransform(openBaoApiResponse, {
      mode: "operations",
      operations: [
        { type: "extract_path", path: "data.ca_chain" },
        { type: "sed_replace", pattern: `s/\\n/\n/g; s/["[],]//g` },
        { type: "grep_filter", pattern: "^[[:space:]]*$", invert: true },
        { type: "trim_lines", removeEmptyLines: true },
      ],
      outputFormat: "object",
    });

    expect(chainedResult.text).toBe(expectedPem);
    expect(chainedResult.lineCount).toBe(6);
  });

  it("supports base64_encode and base64_decode operations", () => {
    const encoded = executeTextTransform("hello openbao", {
      mode: "operations",
      operations: [{ type: "base64_encode" }],
      outputFormat: "string",
    });
    expect(encoded).toBe("aGVsbG8gb3BlbmJhbw==");

    const decoded = executeTextTransform(encoded, {
      mode: "operations",
      operations: [{ type: "base64_decode" }],
      outputFormat: "string",
    });
    expect(decoded).toBe("hello openbao");
  });

  it("registers custom JSONata functions ($toPem, $sed, $grep, $pipeline)", async () => {
    const scope = {
      source: {
        data: {
          ca_chain: openBaoRawCaChainFile,
        },
      },
    };

    const expr1 = jsonata("$toPem(source.data.ca_chain)");
    registerJsonataTextFunctions(expr1);
    const res1 = await expr1.evaluate(scope);
    expect(
      res1
        .split("\n")
        .map((l: string) => l.trim())
        .join("\n")
    ).toBe(expectedPem);

    const expr2 = jsonata(
      `$pipeline(source.data.ca_chain, "sed 's/\\\\\\\\n/\\\\n/g; s/[\\"[],]//g' | grep -v '^[[:space:]]*$'")`
    );
    registerJsonataTextFunctions(expr2);
    const res2 = await expr2.evaluate(scope);
    expect(
      res2
        .split("\n")
        .map((l: string) => l.trim())
        .join("\n")
    ).toBe(expectedPem);
  });
});
