import get from "lodash.get";

export type TextTransformOpType =
  | "extract_path"
  | "unescape"
  | "sed_replace"
  | "grep_filter"
  | "pem_normalize"
  | "base64_decode"
  | "base64_encode"
  | "trim_lines"
  | "shell_pipeline";

export interface TextTransformOperation {
  id?: string;
  type: TextTransformOpType;
  /** Path for extract_path (e.g. "data.ca_chain") */
  path?: string;
  /** Pattern or sed expression (e.g. 's/\\n/\n/g; s/["[],]//g' or regex pattern) */
  pattern?: string;
  /** Replacement string for sed_replace when pattern is a raw regex instead of s/.../.../ */
  replacement?: string;
  /** Regex flags (e.g. "g", "gi", "gm") */
  flags?: string;
  /** For grep_filter: invert match (equivalent to grep -v) */
  invert?: boolean;
  /** For grep_filter: case-insensitive match (equivalent to grep -i) */
  ignoreCase?: boolean;
  /** For trim_lines: whether to also remove empty lines */
  removeEmptyLines?: boolean;
  /** For shell_pipeline: full pipeline string e.g. sed 's/\\n/\n/g; s/["[],]//g' | grep -v '^[[:space:]]*$' */
  command?: string;
}

export type TextOutputFormat = "string" | "object" | "lines" | "json";

export interface TextTransformConfig {
  inputPath?: string;
  mode?: "pipeline" | "operations";
  pipelineCommand?: string;
  operations?: TextTransformOperation[];
  outputFormat?: TextOutputFormat;
}

const POSIX_CLASSES: Record<string, string> = {
  "[:space:]": "\\s",
  "[:blank:]": "[ \\t]",
  "[:digit:]": "\\d",
  "[:alnum:]": "[a-zA-Z0-9]",
  "[:alpha:]": "[a-zA-Z]",
  "[:lower:]": "[a-z]",
  "[:upper:]": "[A-Z]",
  "[:xdigit:]": "[0-9a-fA-F]",
  "[:word:]": "\\w",
  "[:punct:]": "[!\"#$%&'()*+,\\-./:;<=>?@[\\\\\\]^_`{|}~]",
};

/**
 * Converts POSIX regex constructs (like [[:space:]] or sed bracket expressions like ["[],])
 * into valid JavaScript RegExp patterns.
 */
export function normalizePosixRegex(pattern: string): string {
  if (!pattern) return "";

  // 1. Replace [[:class:]] when it is the sole content of a bracket or inside a bracket
  let normalized = pattern.replace(/\[\[:([a-z]+):\]\]/g, (full, cls) => {
    const key = `[:${cls}:]`;
    return POSIX_CLASSES[key] || full;
  });

  for (const [posixKey, jsEquiv] of Object.entries(POSIX_CLASSES)) {
    if (normalized.includes(posixKey)) {
      // If inside outer brackets [...], strip outer brackets from jsEquiv if present
      const inner = jsEquiv.startsWith("[") && jsEquiv.endsWith("]")
        ? jsEquiv.slice(1, -1)
        : jsEquiv;
      normalized = normalized.split(posixKey).join(inner);
    }
  }

  // 2. Fix unescaped inner '[' and ']' inside character classes such as ["[],]
  // In sed/POSIX or casual regexes, ["[],] is used to strip ", [, ], and ,
  normalized = fixBracketExpressions(normalized);

  return normalized;
}

/**
 * Repairs bracket expressions containing unescaped `[` or `]` inside `[...]`,
 * e.g. `["[],]` -> `["\[\],]` and `[]abc]` -> `[\]abc]`.
 */
function fixBracketExpressions(pattern: string): string {
  let result = "";
  let i = 0;
  const len = pattern.length;

  while (i < len) {
    const ch = pattern[i];
    if (ch === "\\") {
      result += pattern.slice(i, i + 2);
      i += 2;
      continue;
    }

    if (ch === "[") {
      // Find the matching closing ']' for this character class.
      // If there are multiple ']' before a quantifier/end or if '['/']' appear inside,
      // scan ahead to find the logical end of the bracket expression.
      let j = i + 1;
      if (j < len && pattern[j] === "^") j++;
      if (j < len && pattern[j] === "]") j++; // POSIX leading ] is literal

      let closeIdx = -1;
      while (j < len) {
        if (pattern[j] === "\\") {
          j += 2;
          continue;
        }
        if (pattern[j] === "]") {
          // Check if immediately followed by characters that look like they are still part of the same intended class,
          // e.g. `["[],]` where `]` is followed by `,` and another `]` without an intermediate `[`
          let k = j + 1;
          let foundAnotherCloseBeforeOpen = false;
          while (k < len) {
            if (pattern[k] === "\\") {
              k += 2;
              continue;
            }
            if (pattern[k] === "[") break;
            if (pattern[k] === "]") {
              foundAnotherCloseBeforeOpen = true;
              break;
            }
            k++;
          }
          if (foundAnotherCloseBeforeOpen) {
            j++;
            continue;
          }
          closeIdx = j;
          break;
        }
        j++;
      }

      if (closeIdx !== -1) {
        const rawInner = pattern.slice(i + 1, closeIdx);
        const leadingCaret = rawInner.startsWith("^") ? "^" : "";
        const body = leadingCaret ? rawInner.slice(1) : rawInner;
        let escapedBody = "";
        for (let m = 0; m < body.length; m++) {
          if (body[m] === "\\") {
            escapedBody += body.slice(m, m + 2);
            m++;
          } else if (body[m] === "[" || body[m] === "]") {
            escapedBody += "\\" + body[m];
          } else {
            escapedBody += body[m];
          }
        }
        result += `[${leadingCaret}${escapedBody}]`;
        i = closeIdx + 1;
        continue;
      }
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Converts any input value (string, array of strings, object) into a working text string.
 */
export function coerceToText(input: any): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input;
  if (Array.isArray(input)) {
    return input
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item, null, 2)))
      .join("\n");
  }
  if (typeof input === "object") {
    return JSON.stringify(input, null, 2);
  }
  return String(input);
}

/**
 * Interprets replacement escape sequences like \n, \r, \t, and backreferences \1 -> $1.
 */
function parseSedReplacement(replacement: string): string {
  let out = "";
  for (let i = 0; i < replacement.length; i++) {
    if (replacement[i] === "\\" && i + 1 < replacement.length) {
      const next = replacement[i + 1];
      if (next === "n") {
        out += "\n";
        i++;
      } else if (next === "r") {
        out += "\r";
        i++;
      } else if (next === "t") {
        out += "\t";
        i++;
      } else if (next >= "1" && next <= "9") {
        out += `$${next}`;
        i++;
      } else if (next === "\\") {
        out += "\\";
        i++;
      } else {
        out += next;
        i++;
      }
    } else if (replacement[i] === "&") {
      out += "$&";
    } else {
      out += replacement[i];
    }
  }
  return out;
}

/**
 * Splits a sed script by `;` or newlines while respecting delimiters and escapes.
 */
function splitSedStatements(script: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSubst = false;
  let delimiter = "";
  let delimiterCount = 0;

  for (let i = 0; i < script.length; i++) {
    const ch = script[i];
    if (ch === "\\" && i + 1 < script.length) {
      current += ch + script[i + 1];
      i++;
      continue;
    }

    if (!inSubst && current.trim() === "s" && ch && !/[a-zA-Z0-9\s]/.test(ch)) {
      inSubst = true;
      delimiter = ch;
      delimiterCount = 1;
      current += ch;
      continue;
    }

    if (inSubst && ch === delimiter) {
      delimiterCount++;
      current += ch;
      if (delimiterCount >= 3) {
        inSubst = false;
      }
      continue;
    }

    if (!inSubst && (ch === ";" || ch === "\n")) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      delimiter = "";
      delimiterCount = 0;
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements;
}

/**
 * Executes a sed expression (such as `s/\\n/\n/g; s/["[],]//g` or `/pattern/d`) against text.
 */
export function applySed(input: any, sedExpr: string, replacementArg?: string, flagsArg?: string): string {
  let text = coerceToText(input);
  const trimmed = (sedExpr || "").trim();
  if (!trimmed) return text;

  // Unwrap surrounding single or double quotes if someone passed "'s/a/b/g'"
  const unwrapped =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ? trimmed.slice(1, -1)
      : trimmed;

  // If caller provided an explicit replacement argument (or it doesn't look like a sed command), treat as regex replace
  if (replacementArg !== undefined) {
    const normPattern = normalizePosixRegex(unwrapped);
    const regex = new RegExp(normPattern, flagsArg || "g");
    return text.replace(regex, parseSedReplacement(replacementArg));
  }

  const statements = splitSedStatements(unwrapped);
  for (const stmt of statements) {
    // 1. Check for deletion command: /pattern/d
    const deleteMatch = stmt.match(/^\/(.+)\/d$/);
    if (deleteMatch) {
      const normPattern = normalizePosixRegex(deleteMatch[1]);
      const regex = new RegExp(normPattern);
      text = text
        .split(/\r?\n/)
        .filter((line) => !regex.test(line))
        .join("\n");
      continue;
    }

    // 2. Check for substitution command: s<delim><pattern><delim><replacement><delim><flags>
    if (stmt.startsWith("s") && stmt.length >= 4 && !/[a-zA-Z0-9\s]/.test(stmt[1])) {
      const delim = stmt[1];
      const parts: string[] = [];
      let buf = "";
      for (let i = 2; i < stmt.length; i++) {
        if (stmt[i] === "\\" && i + 1 < stmt.length) {
          if (stmt[i + 1] === delim) {
            buf += delim;
          } else {
            buf += "\\" + stmt[i + 1];
          }
          i++;
        } else if (stmt[i] === delim && parts.length < 2) {
          parts.push(buf);
          buf = "";
        } else {
          buf += stmt[i];
        }
      }
      parts.push(buf); // flags (if 2 delimiters found)

      if (parts.length >= 2) {
        let rawPat = parts[0];
        const rawRep = parts[1];
        const rawFlags = parts[2] || "";
        // In sed, pattern space is line-oriented so `\n` or `\\n` in s/\n/\n/g or s/\\n/\n/g
        // is used to match literal backslash-n (`\n`) sequences in text (e.g. JSON strings).
        rawPat = rawPat.replace(/(^|[^\\])\\n/g, "$1\\\\n");
        const normPattern = normalizePosixRegex(rawPat);
        let jsFlags = "";
        if (rawFlags.includes("g")) jsFlags += "g";
        if (rawFlags.includes("i") || rawFlags.includes("I")) jsFlags += "i";
        if (rawFlags.includes("m") || rawFlags.includes("M")) jsFlags += "m";
        if (!jsFlags) jsFlags = "g"; // Default to global per line; in whole-text mode 'g' is standard

        const regex = new RegExp(normPattern, jsFlags);
        const parsedRep = parseSedReplacement(rawRep);

        // If rawFlags doesn't have 'g' explicitly, sed replaces first occurrence per line
        if (!rawFlags.includes("g") && !rawPat.includes("\\n")) {
          const singleRegex = new RegExp(normPattern, jsFlags.replace("g", ""));
          text = text
            .split(/\r?\n/)
            .map((line) => line.replace(singleRegex, parsedRep))
            .join("\n");
        } else {
          text = text.replace(regex, parsedRep);
        }
        continue;
      }
    }

    // Fallback: treat statement as pattern to strip if no s/.../.../ wrapper
    const normPattern = normalizePosixRegex(stmt);
    const regex = new RegExp(normPattern, flagsArg || "g");
    text = text.replace(regex, "");
  }

  return text;
}

/**
 * Filters lines using a regex pattern (like `grep` or `grep -v`).
 */
export function applyGrep(input: any, pattern: string, invert = false, ignoreCase = false): string {
  const text = coerceToText(input);
  if (!pattern) return text;

  const trimmed = pattern.trim();
  const unwrapped =
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ? trimmed.slice(1, -1)
      : trimmed;

  const normPattern = normalizePosixRegex(unwrapped);
  const regex = new RegExp(normPattern, ignoreCase ? "i" : "");

  return text
    .split(/\r?\n/)
    .filter((line) => {
      const matched = regex.test(line);
      return invert ? !matched : matched;
    })
    .join("\n");
}

/**
 * Unescapes literal \n, \r, \t, \" sequences in a string.
 */
export function unescapeText(input: any): string {
  let text = coerceToText(input);
  // If the entire string is wrapped in quotes like a JSON string literal, try parsing it first
  const trimmed = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        text = parsed;
      }
    } catch {}
  }
  return text
    .replace(/\\\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

/**
 * Normalizes OpenBao / HashiCorp Vault / JSON-wrapped certificates, CA chains, or private keys
 * into a clean multi-line PEM string (`fixed_ca.pem` format).
 */
export function normalizeToPem(input: any): string {
  if (input === null || input === undefined) return "";

  // If input is an object with common OpenBao / Vault certificate fields and no path was extracted yet
  if (typeof input === "object" && !Array.isArray(input)) {
    const candidate =
      get(input, "data.ca_chain") ??
      get(input, "data.data.ca_chain") ??
      get(input, "ca_chain") ??
      get(input, "data.certificate") ??
      get(input, "data.data.certificate") ??
      get(input, "certificate") ??
      get(input, "data.issuing_ca") ??
      get(input, "issuing_ca") ??
      get(input, "pem") ??
      input;
    if (candidate !== input) {
      return normalizeToPem(candidate);
    }
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => normalizeToPem(item))
      .filter(Boolean)
      .join("\n");
  }

  const rawText = coerceToText(input);
  // Apply the exact OpenBao CA chain cleanup logic:
  // 1. Replace literal \n with real newlines
  // 2. Strip JSON array/string syntax characters ["[],]
  // 3. Remove blank / whitespace-only lines
  const step1 = applySed(rawText, 's/\\n/\n/g; s/["[],]//g');
  const step2 = applyGrep(step1, "^[[:space:]]*$", true);
  return step2.trim();
}

/**
 * Parses and executes a shell-style pipeline string safely in pure TypeScript.
 * Supports piped commands such as:
 *   sed 's/\\n/\n/g; s/["[],]//g' ca_chain.crt | grep -v '^[[:space:]]*$' > fixed_ca.pem
 */
export function executeShellPipeline(input: any, pipelineCommand: string): string {
  let text = coerceToText(input);
  const rawCmd = (pipelineCommand || "").trim();
  if (!rawCmd) return text;

  // Split by pipe `|` Outside of single or double quotes
  const segments = splitByPipeOutsideQuotes(rawCmd);

  for (let seg of segments) {
    // Strip trailing output redirection like `> fixed_ca.pem` or `>> out.txt`
    seg = stripOutputRedirection(seg).trim();
    if (!seg) continue;

    const tokens = tokenizeShellSegment(seg);
    if (tokens.length === 0) continue;

    const cmd = tokens[0];

    if (cmd === "sed") {
      // Collect -e expressions or the first non-flag token as the sed script
      const scripts: string[] = [];
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "-e" && i + 1 < tokens.length) {
          scripts.push(tokens[i + 1]);
          i += 2;
        } else if (tok.startsWith("-")) {
          // Ignore flags like -E, -r, -n
          i++;
        } else {
          // First non-flag argument is the sed script; any subsequent token is a filename (e.g. ca_chain.crt) which we ignore
          if (scripts.length === 0) {
            scripts.push(tok);
          }
          i++;
        }
      }
      for (const s of scripts) {
        text = applySed(text, s);
      }
    } else if (cmd === "grep" || cmd === "egrep") {
      let invert = false;
      let ignoreCase = false;
      const patterns: string[] = [];
      let i = 1;
      while (i < tokens.length) {
        const tok = tokens[i];
        if (tok === "-e" && i + 1 < tokens.length) {
          patterns.push(tokens[i + 1]);
          i += 2;
        } else if (tok.startsWith("-") && tok.length > 1) {
          if (tok.includes("v")) invert = true;
          if (tok.includes("i")) ignoreCase = true;
          i++;
        } else {
          if (patterns.length === 0) {
            patterns.push(tok);
          }
          i++;
        }
      }
      for (const pat of patterns) {
        text = applyGrep(text, pat, invert, ignoreCase);
      }
    } else if (cmd === "tr") {
      // Support common `tr -d '...'` or `tr 'a' 'b'`
      let deleteMode = false;
      const args: string[] = [];
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i] === "-d") {
          deleteMode = true;
        } else if (!tokens[i].startsWith("-")) {
          args.push(tokens[i]);
        }
      }
      if (deleteMode && args[0]) {
        const chars = parseSedReplacement(args[0]);
        for (const ch of chars) {
          text = text.split(ch).join("");
        }
      } else if (args.length >= 2) {
        const from = parseSedReplacement(args[0]);
        const to = parseSedReplacement(args[1]);
        for (let c = 0; c < from.length; c++) {
          const rep = to[Math.min(c, to.length - 1)] || "";
          text = text.split(from[c]).join(rep);
        }
      }
    } else if (cmd.startsWith("s") && cmd.length >= 4 && !/[a-zA-Z0-9\s]/.test(cmd[1])) {
      // Bare sed expression without the word `sed`
      text = applySed(text, seg);
    }
  }

  return text;
}

function splitByPipeOutsideQuotes(cmd: string): string[] {
  const parts: string[] = [];
  let buf = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (ch === "\\" && quote !== "'" && i + 1 < cmd.length) {
      buf += ch + cmd[i + 1];
      i++;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "|") {
      parts.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf) parts.push(buf);
  return parts;
}

function stripOutputRedirection(segment: string): string {
  let out = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === "\\" && quote !== "'" && i + 1 < segment.length) {
      out += ch + segment[i + 1];
      i++;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === ">") {
      // Ignore `> filename` or `>> filename` at the end of a segment
      break;
    }
    out += ch;
  }
  return out;
}

function tokenizeShellSegment(segment: string): string[] {
  const tokens: string[] = [];
  let buf = "";
  let quote: "'" | '"' | null = null;
  let hasTokenContent = false;

  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        buf += ch;
      }
      continue;
    }
    if (quote === '"') {
      if (ch === "\\" && i + 1 < segment.length && (segment[i + 1] === '"' || segment[i + 1] === "\\")) {
        buf += segment[i + 1];
        i++;
      } else if (ch === '"') {
        quote = null;
      } else {
        buf += ch;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      hasTokenContent = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (buf.length > 0 || hasTokenContent) {
        tokens.push(buf);
        buf = "";
        hasTokenContent = false;
      }
      continue;
    }
    buf += ch;
    hasTokenContent = true;
  }
  if (buf.length > 0 || hasTokenContent) {
    tokens.push(buf);
  }
  return tokens;
}

export function decodeBase64(input: any): string {
  const str = coerceToText(input).trim();
  if (!str) return "";
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(atob(str)));
}

export function encodeBase64(input: any): string {
  const str = coerceToText(input);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Executes a single `TextTransformOperation` on the current value.
 */
export function applyTextOperation(value: any, op: TextTransformOperation): any {
  switch (op.type) {
    case "extract_path": {
      const path = (op.path || "").trim();
      if (!path) return value;
      let obj = value;
      if (typeof obj === "string") {
        try {
          obj = JSON.parse(obj);
        } catch {}
      }
      if (obj && typeof obj === "object") {
        const extracted = get(obj, path);
        return extracted !== undefined ? extracted : "";
      }
      return value;
    }
    case "unescape":
      return unescapeText(value);
    case "sed_replace": {
      const pat = op.pattern || "";
      if (op.replacement !== undefined && !(pat.startsWith("s") && pat.length >= 4 && !/[a-zA-Z0-9\s]/.test(pat[1]))) {
        return applySed(value, pat, op.replacement, op.flags || "g");
      }
      return applySed(value, pat);
    }
    case "grep_filter":
      return applyGrep(value, op.pattern || "", Boolean(op.invert), Boolean(op.ignoreCase));
    case "pem_normalize":
      return normalizeToPem(value);
    case "base64_decode":
      return decodeBase64(value);
    case "base64_encode":
      return encodeBase64(value);
    case "trim_lines": {
      const text = coerceToText(value);
      let lines = text.split(/\r?\n/).map((l) => l.trim());
      if (op.removeEmptyLines !== false) {
        lines = lines.filter((l) => l.length > 0);
      }
      return lines.join("\n");
    }
    case "shell_pipeline":
      return executeShellPipeline(value, op.command || op.pattern || "");
    default:
      return coerceToText(value);
  }
}

/**
 * Main entry point for the `text_transform` workflow step and live UI preview.
 */
export function executeTextTransform(input: any, config: TextTransformConfig): any {
  let workingValue = input;

  // 1. Extract optional inputPath from upstream JSON object/array
  const inputPath = (config.inputPath || "").trim();
  if (inputPath) {
    workingValue = applyTextOperation(workingValue, { type: "extract_path", path: inputPath });
  }

  // 2. Execute either pipeline mode or visual operations list
  const mode = config.mode || "pipeline";
  if (mode === "operations" && Array.isArray(config.operations) && config.operations.length > 0) {
    for (const op of config.operations) {
      workingValue = applyTextOperation(workingValue, op);
    }
  } else if (config.pipelineCommand && config.pipelineCommand.trim()) {
    workingValue = executeShellPipeline(workingValue, config.pipelineCommand);
  }

  const finalText = coerceToText(workingValue);
  const lines = finalText.length > 0 ? finalText.split(/\r?\n/) : [];
  const format: TextOutputFormat = config.outputFormat || "string";

  if (format === "lines") {
    return lines;
  }
  if (format === "object") {
    return {
      text: finalText,
      pem: finalText,
      lines,
      lineCount: lines.length,
    };
  }
  if (format === "json") {
    try {
      return JSON.parse(finalText);
    } catch {
      return { text: finalText, lines, lineCount: lines.length };
    }
  }
  return finalText;
}

/**
 * Registers custom text, regex, and certificate helper functions on a JSONata expression instance.
 * Available functions in JSONata:
 * - $toPem(val)
 * - $sed(val, exprOrPattern, replacement?, flags?)
 * - $grep(val, pattern, invert?)
 * - $unescape(val)
 * - $base64Decode(val)
 * - $base64Encode(val)
 * - $pipeline(val, cmd)
 */
export function registerJsonataTextFunctions(expression: any): void {
  if (!expression || typeof expression.registerFunction !== "function") return;

  expression.registerFunction("toPem", (val: any) => normalizeToPem(val));
  expression.registerFunction("sed", (val: any, patternOrCmd: string, replacement?: string, flags?: string) =>
    applySed(val, patternOrCmd, replacement, flags)
  );
  expression.registerFunction("grep", (val: any, pattern: string, invert?: boolean, ignoreCase?: boolean) =>
    applyGrep(val, pattern, Boolean(invert), Boolean(ignoreCase))
  );
  expression.registerFunction("unescape", (val: any) => unescapeText(val));
  expression.registerFunction("base64Decode", (val: any) => decodeBase64(val));
  expression.registerFunction("base64Encode", (val: any) => encodeBase64(val));
  expression.registerFunction("pipeline", (val: any, cmd: string) => executeShellPipeline(val, cmd));
}
