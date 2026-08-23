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

const collectionDefinition = {
  type: "Struct",
  name: "集合测试",
  value: [
    { key: "普通列表", param_type: "StringList", value: { param_type: "StringList", value: [] } },
    {
      key: "结构体列表",
      param_type: "StructList",
      value: { param_type: "StructList", value: { structId: "2", value: [] } },
    },
    {
      key: "字典",
      param_type: "Dict",
      value: {
        param_type: "Dict",
        value: {
          type: "Dict",
          key_type: "String",
          value_type: "Struct",
          value_structId: "2",
          value: [],
        },
      },
    },
  ],
};

function createParsed() {
  const workspace = new VariableWorkspace({
    "1": collectionDefinition,
    "2": childDefinition,
  });
  return workspace.parse({
    structId: "1",
    type: "Struct",
    value: [
      { param_type: "StringList", value: ["a", "b"] },
      {
        param_type: "StructList",
        value: {
          structId: "2",
          value: [
            {
              param_type: "Struct",
              value: {
                structId: "2",
                type: "Struct",
                value: [{ param_type: "String", value: "one" }],
              },
            },
          ],
        },
      },
      {
        param_type: "Dict",
        value: {
          type: "Dict",
          key_type: "String",
          value_type: "Struct",
          value_structId: "2",
          value: [
            {
              key: { param_type: "String", value: "k1" },
              value: {
                param_type: "Struct",
                value: {
                  structId: "2",
                  type: "Struct",
                  value: [{ param_type: "String", value: "v1" }],
                },
              },
            },
          ],
        },
      },
    ],
  });
}

test("normal list supports append, insert, swap, remove and defaults", () => {
  const list = createParsed().value["普通列表"];

  assert.equal(list.itemCount, 2);
  assert.equal(list.appendItem("c"), 2);
  assert.equal(list.insertItem(1, "x"), 1);
  list.swapItems(0, 3);
  assert.equal(list.removeItem(1), "x");
  assert.deepEqual(list.value, ["c", "b", "a"]);

  assert.equal(list.appendItem(), 3);
  assert.equal(list.value[3], "");
  assert.throws(() => list.removeItem(99), RangeError);
});

test("StructList supports defaults and clipboard round-trips", () => {
  const list = createParsed().value["结构体列表"];
  const first = list.value[0].copy();

  assert.equal(list.appendItem(), 1);
  assert.equal(list.value[1].value["标题"].value, "默认标题");
  assert.equal(list.insertItem(1, first), 1);
  list.swapItems(0, 2);
  assert.equal(list.value[0].value["标题"].value, "默认标题");

  const removed = list.removeItem(0);
  assert.equal(list.itemCount, 2);
  assert.equal(list.appendItem(removed), 2);
  assert.equal(list.value[2].value["标题"].value, "默认标题");
});

test("Dict supports typed entries, defaults, swap, remove and reinsertion", () => {
  const dict = createParsed().value["字典"];
  const structClipboard = dict.value[0].value.copy();

  assert.equal(dict.appendItem({ key: "k2", value: structClipboard }), 1);
  assert.equal(dict.value[1].key.value, "k2");
  assert.equal(dict.value[1].value.value["标题"].value, "v1");

  assert.equal(dict.insertItem(1, { key: "middle", value: structClipboard }), 1);
  assert.equal(dict.appendItem(), 3);
  assert.equal(dict.value[3].key.value, "");
  assert.equal(dict.value[3].value.value["标题"].value, "默认标题");

  dict.swapItems(0, 3);
  const removed = dict.removeItem(0);
  assert.equal(dict.itemCount, 3);
  assert.equal(dict.appendItem(removed), 3);
  assert.equal(dict.value[3].key.value, "");
  assert.equal(dict.value[3].value.value["标题"].value, "默认标题");

  const raw = dict.toParamNode();
  assert.equal(raw.value.value.length, 4);
  assert.equal(raw.value.value[3].value.param_type, "Struct");
});
