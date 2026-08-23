import test from "node:test";
import assert from "node:assert/strict";
import { VariableWorkspace } from "../dist/index.js";

const childDefinition = {
  type: "Struct",
  name: "子结构",
  value: [
    { key: "标题", param_type: "String", value: { param_type: "String", value: "默认标题" } },
  ],
};

const rootDefinition = {
  type: "Struct",
  name: "根结构",
  value: [
    { key: "文本", param_type: "String", value: { param_type: "String", value: "默认文本" } },
    { key: "列表", param_type: "Int32List", value: { param_type: "Int32List", value: [] } },
    { key: "子项", param_type: "Struct", value: { param_type: "Struct", value: { structId: "2", type: "Struct", value: [{ param_type: "String", value: "默认标题" }] } } },
    { key: "字典", param_type: "Dict", value: { param_type: "Dict", value: { type: "Dict", key_type: "String", value_type: "Struct", value_structId: "2", value: [] } } },
  ],
};

function createVariable() {
  return {
    structId: "1",
    type: "Struct",
    value: [
      { param_type: "String", value: "hello" },
      { param_type: "Int32List", value: ["1", "2"] },
      { param_type: "Struct", value: { structId: "2", type: "Struct", value: [{ param_type: "String", value: "child" }] } },
      { param_type: "Dict", value: { type: "Dict", key_type: "String", value_type: "Struct", value_structId: "2", value: [{ key: { param_type: "String", value: "first" }, value: { param_type: "Struct", value: { structId: "2", type: "Struct", value: [{ param_type: "String", value: "dict child" }] } } }] } },
    ],
  };
}

function createWorkspace() {
  return new VariableWorkspace({ "1": rootDefinition, "2": childDefinition });
}

test("flattens every compound value and round-trips", () => {
  const source = createVariable();
  const parsed = createWorkspace().parse(source);
  assert.equal(parsed.name, "根结构");
  assert.equal(parsed.value["文本"].value, "hello");
  assert.equal(parsed.value["列表"].value[1], "2");
  assert.equal(parsed.value["子项"].value["标题"].value, "child");
  assert.equal(parsed.value["字典"].value[0].key.value, "first");
  assert.equal(parsed.value["字典"].value[0].value.value["标题"].value, "dict child");
  assert.deepEqual(parsed.toQxqyValue(), source);
});

test("exposes mismatches for rendering", () => {
  const source = createVariable();
  source.value[0].param_type = "Float";
  const parsed = createWorkspace().parse(source);
  assert.equal(parsed.value["文本"].type, "Float");
  assert.equal(parsed.value["文本"].defineType, "String");
  assert.equal(parsed.value["文本"].isTypeMatch, false);
  assert.equal(parsed.issues[0].path, '$.value["文本"]');
});

test("copy/paste checks types and reset uses definition defaults", () => {
  const parsed = createWorkspace().parse(createVariable());
  const text = parsed.value["文本"];
  const copied = text.copy();
  text.setValue("changed");
  assert.equal(text.paste(copied), true);
  assert.equal(text.value, "hello");
  assert.equal(parsed.value["子项"].paste(copied), false);
  assert.equal(text.reset(), true);
  assert.equal(text.value, "默认文本");

  const wrongStruct = parsed.value["子项"].copy();
  wrongStruct.node.value.structId = "999";
  assert.equal(parsed.value["子项"].paste(wrongStruct), false);
});
