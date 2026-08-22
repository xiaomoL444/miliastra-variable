import test from "node:test";
import assert from "node:assert/strict";
import { StructWorkspace } from "../dist/index.js";

const childDefinition = {
  type: "Struct",
  name: "子结构",
  value: [
    { key: "标题", param_type: "String", value: { param_type: "String", value: "默认标题" } },
  ],
};

const definition = {
  type: "Struct",
  name: "补全测试",
  value: [
    { key: "已有", param_type: "String", value: { param_type: "String", value: "默认已有" } },
    {
      key: "缺少结构体",
      param_type: "Struct",
      value: {
        param_type: "Struct",
        value: {
          structId: "2",
          type: "Struct",
          value: [{ param_type: "String", value: "默认标题" }],
        },
      },
    },
    { key: "缺少布尔", param_type: "Bool", value: { param_type: "Bool", value: "False" } },
  ],
};

function workspace() {
  return new StructWorkspace({ "1": definition, "2": childDefinition });
}

test("fills missing tail fields with defaults while preserving the warning state", () => {
  const parsed = workspace().parse({
    structId: "1",
    type: "Struct",
    value: [{ param_type: "String", value: "实际值" }],
  });

  const missingStruct = parsed.value.缺少结构体;
  const missingBool = parsed.value.缺少布尔;
  assert.equal(missingStruct.value.标题.value, "默认标题");
  assert.equal(missingStruct.type, "");
  assert.equal(missingStruct.defineType, "Struct");
  assert.equal(missingStruct.presence, "missing");
  assert.equal(missingStruct.isMissing, true);
  assert.equal(missingBool.value, "False");

  assert.deepEqual(
    parsed.warnings.map(({ kind, path }) => ({ kind, path })),
    [
      { kind: "missing-field", path: "$.value.缺少结构体" },
      { kind: "missing-field", path: "$.value.缺少布尔" },
    ],
  );

  const raw = parsed.toQxqyValue();
  assert.equal(raw.value.length, 3);
  assert.equal(raw.value[1].param_type, "");
  assert.equal(raw.value[1].value.value[0].value, "默认标题");

  assert.equal(missingStruct.reset(), true);
  assert.equal(missingStruct.type, "Struct");
  assert.equal(missingStruct.presence, "present");
  assert.equal(parsed.warnings.length, 1);
});

test("retains extra fields, exposes them by source index and warns", () => {
  const source = {
    structId: "1",
    type: "Struct",
    value: [
      { param_type: "String", value: "已有" },
      { param_type: "Struct", value: { structId: "2", type: "Struct", value: [{ param_type: "String", value: "子项" }] } },
      { param_type: "Bool", value: "True" },
      { param_type: "Float", value: "9.99" },
    ],
  };
  const shortDefinition = {
    ...definition,
    value: definition.value.slice(0, 3),
  };
  const ws = new StructWorkspace({ "1": shortDefinition, "2": childDefinition });
  const parsed = ws.parse(source);

  const extra = parsed.value["$extra[3]"];
  assert.equal(extra.value, "9.99");
  assert.equal(extra.type, "Float");
  assert.equal(extra.defineType, undefined);
  assert.equal(extra.isExtra, true);
  assert.equal(parsed.warnings.at(-1).kind, "extra-field");
  assert.equal(parsed.warnings.at(-1).path, "$.value.$extra[3]");
  assert.deepEqual(parsed.toQxqyValue(), source);
});

test("a compatible paste resolves a missing-field warning", () => {
  const ws = workspace();
  const parsed = ws.parse({
    structId: "1",
    type: "Struct",
    value: [
      { param_type: "String", value: "实际值" },
      { param_type: "Struct", value: { structId: "2", type: "Struct", value: [{ param_type: "String", value: "实际标题" }] } },
    ],
  });
  const missing = parsed.value.缺少布尔;
  const valid = ws.createDefault("1").value.缺少布尔.copy();

  assert.equal(missing.canPaste(valid), true);
  assert.equal(missing.paste(valid), true);
  assert.equal(missing.type, "Bool");
  assert.equal(missing.isMissing, false);
  assert.equal(parsed.warnings.length, 0);
});
