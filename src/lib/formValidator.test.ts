import { describe, expect, it } from "bun:test";
import {
  createModularFieldValidator,
  formatValidatorBadge,
  hasActiveValidator,
  mergeWorkflowAndFormValidatorConfigs,
  validateFormFieldValue,
  validateFormPayload,
  validateWorkflowFormPayload,
} from "./formValidator";
import { buildFormFieldFromVariable, checkWidgetVariablesConfigured } from "./workflowVariableChecker";

describe("validateFormFieldValue - built-in presets & regex", () => {
  it("accepts any value when validator is none and not required", () => {
    expect(validateFormFieldValue({ name: "note", type: "string", validator: "none" }, "")).toEqual({
      valid: true,
    });
    expect(
      validateFormFieldValue({ name: "note", type: "string", validator: "none" }, "anything")
    ).toEqual({ valid: true });
  });

  it("enforces required on string, number (allowing 0), list, and boolean", () => {
    expect(
      validateFormFieldValue({ name: "title", label: "Title", type: "string", validator: "required" }, "  ")
        .valid
    ).toBe(false);
    expect(
      validateFormFieldValue({ name: "title", label: "Title", type: "string", validator: "required" }, "ok")
        .valid
    ).toBe(true);

    expect(
      validateFormFieldValue({ name: "count", type: "number", required: true }, "").valid
    ).toBe(false);
    expect(
      validateFormFieldValue({ name: "count", type: "number", required: true }, 0).valid
    ).toBe(true);

    expect(
      validateFormFieldValue({ name: "tags", type: "list", validator: "required" }, []).valid
    ).toBe(false);
    expect(
      validateFormFieldValue({ name: "tags", type: "list", validator: "required" }, ["a"]).valid
    ).toBe(true);

    expect(
      validateFormFieldValue({ name: "agree", type: "boolean", validator: "required" }, false).valid
    ).toBe(false);
    expect(
      validateFormFieldValue({ name: "agree", type: "boolean", validator: "required" }, true).valid
    ).toBe(true);
  });

  it("validates email, url, uuid, date (including leap/calendar check), ipv4_host, json, and alphanumeric", () => {
    expect(validateFormFieldValue({ name: "e", validator: "email" }, "user@example.com").valid).toBe(true);
    expect(validateFormFieldValue({ name: "e", validator: "email" }, "bad-email").valid).toBe(false);

    expect(validateFormFieldValue({ name: "u", validator: "url" }, "https://example.com/api").valid).toBe(true);
    expect(validateFormFieldValue({ name: "u", validator: "url" }, "ws://surrealdb-4:8000/rpc").valid).toBe(true);
    expect(validateFormFieldValue({ name: "u", validator: "url" }, "not a url").valid).toBe(false);

    expect(
      validateFormFieldValue({ name: "id", validator: "uuid" }, "92a5d7b0-a4f7-47f5-ad6a-525c481f16b5").valid
    ).toBe(true);
    expect(validateFormFieldValue({ name: "id", validator: "uuid" }, "not-a-uuid").valid).toBe(false);

    expect(validateFormFieldValue({ name: "d", validator: "date" }, "2026-11-24").valid).toBe(true);
    expect(validateFormFieldValue({ name: "d", validator: "date" }, "2024-02-29").valid).toBe(true);
    expect(validateFormFieldValue({ name: "d", validator: "date" }, "2026-02-30").valid).toBe(false);
    expect(validateFormFieldValue({ name: "d", validator: "date" }, "24-11-2026").valid).toBe(false);

    expect(validateFormFieldValue({ name: "h", validator: "ipv4_host" }, "192.168.1.10:8080").valid).toBe(true);
    expect(validateFormFieldValue({ name: "h", validator: "ipv4_host" }, "surrealdb-4.default:8000").valid).toBe(
      true
    );
    expect(validateFormFieldValue({ name: "h", validator: "ipv4_host" }, "999.999.1.1").valid).toBe(false);
    expect(validateFormFieldValue({ name: "h", validator: "ipv4_host" }, "bad host!").valid).toBe(false);

    expect(validateFormFieldValue({ name: "j", validator: "json" }, '{"a":1}').valid).toBe(true);
    expect(validateFormFieldValue({ name: "j", validator: "json" }, "{bad}").valid).toBe(false);

    expect(validateFormFieldValue({ name: "a", validator: "alphanumeric" }, "table_name-1").valid).toBe(true);
    expect(validateFormFieldValue({ name: "a", validator: "alphanumeric" }, "bad table!").valid).toBe(false);
  });

  it("validates custom regex and catches malformed regex patterns safely", () => {
    expect(
      validateFormFieldValue(
        { name: "slug", validator: "regex", validatorPattern: "^[a-z0-9-]+$" },
        "valid-slug-1"
      ).valid
    ).toBe(true);
    expect(
      validateFormFieldValue(
        { name: "slug", validator: "regex", validatorPattern: "^[a-z0-9-]+$" },
        "Invalid_Slug"
      ).valid
    ).toBe(false);

    const badPattern = validateFormFieldValue(
      { name: "slug", label: "Slug", validator: "regex", validatorPattern: "[unclosed" },
      "abc"
    );
    expect(badPattern.valid).toBe(false);
    expect(badPattern.error).toContain("invalid regex pattern");
  });
});

describe("validateFormFieldValue - min/max bounds, list items & custom error messages", () => {
  it("enforces numeric min/max bounds", () => {
    const cfg = { name: "age", label: "Age", type: "number", validatorMin: 18, validatorMax: 99 };
    expect(validateFormFieldValue(cfg, 17).valid).toBe(false);
    expect(validateFormFieldValue(cfg, 18).valid).toBe(true);
    expect(validateFormFieldValue(cfg, 99).valid).toBe(true);
    expect(validateFormFieldValue(cfg, 100).valid).toBe(false);
  });

  it("enforces string/textarea length bounds", () => {
    const cfg = { name: "bio", label: "Bio", type: "textarea", validatorMin: 3, validatorMax: 5 };
    expect(validateFormFieldValue(cfg, "ab").valid).toBe(false);
    expect(validateFormFieldValue(cfg, "abc").valid).toBe(true);
    expect(validateFormFieldValue(cfg, "abcdef").valid).toBe(false);
    expect(validateFormFieldValue(cfg, "").valid).toBe(false);
  });

  it("enforces list item count bounds and validates every list item against preset/regex", () => {
    const cfg = {
      name: "emails",
      label: "Recipients",
      type: "list",
      validator: "email" as const,
      validatorMin: 1,
      validatorMax: 3,
    };
    expect(validateFormFieldValue(cfg, []).valid).toBe(false);
    expect(validateFormFieldValue(cfg, ["a@b.com", "c@d.org"]).valid).toBe(true);
    expect(validateFormFieldValue(cfg, ["a@b.com", "invalid"]).valid).toBe(false);
    expect(validateFormFieldValue(cfg, ["a@b.com", "b@b.com", "c@b.com", "d@b.com"]).valid).toBe(false);
  });

  it("uses custom validatorMessage when provided", () => {
    const res = validateFormFieldValue(
      {
        name: "code",
        label: "Code",
        validator: "regex",
        validatorPattern: "^[A-Z]{3}$",
        validatorMessage: "Please enter a 3-letter uppercase country code.",
      },
      "us"
    );
    expect(res.valid).toBe(false);
    expect(res.error).toBe("Please enter a 3-letter uppercase country code.");
  });
});

describe("workflow variable carryover & merged validation", () => {
  it("carries over type, options, and validator config via buildFormFieldFromVariable and checkWidgetVariablesConfigured", () => {
    const workflow = {
      id: "workflow:wf_1",
      steps: [
        {
          id: "s1",
          requestBodyTemplate: "INSERT INTO users SET email = {{ user_email }}, role = {{ user_role }};",
          variables: [
            {
              id: "v1",
              name: "user_email",
              alias: "User Email",
              direction: "down" as const,
              type: "string" as const,
              required: true,
              validator: "email" as const,
              validatorMessage: "Valid work email required",
            },
            {
              id: "v2",
              name: "user_role",
              alias: "Role",
              direction: "down" as const,
              type: "select" as const,
              options: "admin, user, viewer",
              required: true,
            },
          ],
        },
      ],
    };

    const status = checkWidgetVariablesConfigured(workflow, []);
    const emailVar = status.varsWithStatus.find((v) => v.name === "user_email");
    expect(emailVar?.validator).toBe("email");
    expect(emailVar?.validatorMessage).toBe("Valid work email required");

    const builtField = buildFormFieldFromVariable(emailVar!);
    expect(builtField).toEqual({
      name: "user_email",
      label: "User Email",
      type: "string",
      required: true,
      validator: "email",
      validatorMessage: "Valid work email required",
    });

    const roleVar = status.varsWithStatus.find((v) => v.name === "user_role");
    const roleField = buildFormFieldFromVariable(roleVar!);
    expect(roleField).toEqual({
      name: "user_role",
      label: "Role",
      type: "select",
      options: "admin, user, viewer",
      required: true,
    });
  });

  it("merges workflow downstream variable validators with dashboard formConfig and validates payload", () => {
    const workflow = {
      steps: [
        {
          id: "s1",
          requestBodyTemplate: "SELECT * FROM {{ dashboard_form.target_table }} WHERE id = {{ record_uuid }};",
          variables: [
            {
              id: "v1",
              name: "dashboard_form.target_table",
              alias: "Table",
              direction: "down",
              type: "string",
              validator: "alphanumeric",
              validatorMin: 3,
            },
            {
              id: "v2",
              name: "record_uuid",
              alias: "Record ID",
              direction: "down",
              type: "string",
              validator: "uuid",
              required: true,
            },
          ],
        },
      ],
    };

    // Dashboard formConfig only has target_table without validator set, and omits record_uuid
    const formConfig = [{ name: "target_table", label: "Target Table", type: "string" }];
    const merged = mergeWorkflowAndFormValidatorConfigs(workflow, formConfig);
    expect(merged.length).toBe(2);
    expect(merged[0].validator).toBe("alphanumeric");
    expect(merged[0].validatorMin).toBe(3);

    const invalidRes = validateWorkflowFormPayload(workflow, formConfig, {
      target_table: "bad table!",
      record_uuid: "",
    });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.errors.target_table).toContain("letters, numbers");
    expect(invalidRes.errors.record_uuid).toContain("required");

    const validRes = validateWorkflowFormPayload(workflow, formConfig, {
      target_table: "incident_source",
      record_uuid: "92a5d7b0-a4f7-47f5-ad6a-525c481f16b5",
    });
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toEqual({});
  });

  it("formats validator badges and checks active state cleanly", () => {
    expect(hasActiveValidator({ validator: "none" })).toBe(false);
    expect(formatValidatorBadge({ validator: "none" })).toBeNull();
    expect(hasActiveValidator({ validator: "email", validatorMin: 5 })).toBe(true);
    expect(formatValidatorBadge({ validator: "email", validatorMin: 5, validatorMax: 50 })).toBe(
      "Email · 5..50"
    );
    expect(formatValidatorBadge({ validator: "none", required: true, validatorMin: 2 })).toBe(
      "Required · Min 2"
    );
  });

  it("validateFormPayload validates multiple fields and reports firstError", () => {
    const res = validateFormPayload(
      [
        { name: "email", label: "Email", type: "string", validator: "email", required: true },
        { name: "port", label: "Port", type: "number", validatorMin: 1, validatorMax: 65535 },
      ],
      { email: "not-an-email", port: 70000 }
    );
    expect(res.valid).toBe(false);
    expect(res.firstError).toContain("Email");
    expect(res.errors.port).toContain("at most 65535");
  });
});

describe("survey field types", () => {
  it("validates radio options", () => {
    const f = { name: "r", label: "R", type: "radio", options: "a, b", required: true };
    expect(validateFormFieldValue(f, "a").valid).toBe(true);
    expect(validateFormFieldValue(f, "c").valid).toBe(false);
    expect(validateFormFieldValue(f, "").valid).toBe(false);
  });

  it("validates checkbox_group required, min/max and options", () => {
    const f = { name: "c", label: "C", type: "checkbox_group", options: "a,b,c", required: true, validatorMin: 1, validatorMax: 2 };
    expect(validateFormFieldValue(f, []).valid).toBe(false);
    expect(validateFormFieldValue(f, ["a"]).valid).toBe(true);
    expect(validateFormFieldValue(f, ["a", "b", "c"]).valid).toBe(false);
    expect(validateFormFieldValue(f, ["z"]).valid).toBe(false);
  });

  it("validates rating bounds for 1-5 and 1-10 scales", () => {
    const five = { name: "s", label: "S", type: "rating", required: true };
    expect(validateFormFieldValue(five, "5").valid).toBe(true);
    expect(validateFormFieldValue(five, "6").valid).toBe(false);
    expect(validateFormFieldValue(five, 0).valid).toBe(false);
    expect(validateFormFieldValue(five, "").valid).toBe(false);
    const ten = { ...five, ratingMax: 10 };
    expect(validateFormFieldValue(ten, 10).valid).toBe(true);
    expect(validateFormFieldValue(ten, 11).valid).toBe(false);
  });

  it("validates date fields as calendar dates", () => {
    const f = { name: "d", label: "D", type: "date" };
    expect(validateFormFieldValue(f, "2024-02-29").valid).toBe(true);
    expect(validateFormFieldValue(f, "2023-02-29").valid).toBe(false);
    expect(validateFormFieldValue(f, "nope").valid).toBe(false);
    expect(validateFormFieldValue(f, "").valid).toBe(true);
  });

  it("createModularFieldValidator returns '' when valid and message when invalid", () => {
    const v = createModularFieldValidator({ name: "e", label: "Email", type: "string", validator: "email" });
    expect(v("a@b.co")).toBe("");
    expect(v("bad")).toContain("Email");
  });
});
