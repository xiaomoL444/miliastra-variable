import test from "node:test";
import assert from "node:assert/strict";
import { VariableWorkspace } from "../dist/index.js";

const weaponStructId = "1077936161";
const weaponDefinition = {
  type: "Struct",
  struct_ype: "basic",
  name: "武器数据",
  value: [
    {
      key: "元件id",
      param_type: "EntityReference",
      value: { param_type: "EntityReference", value: "0" },
    },
    {
      key: "攻击力",
      param_type: "Float",
      value: { param_type: "Float", value: "0.00" },
    },
  ],
};

function createWeaponDictionary(entryStructId = weaponStructId) {
  return {
    type: "Dict",
    key_type: "String",
    value_type: "Struct",
    value_structId: weaponStructId,
    value: [
      {
        key: { param_type: "String", value: "[weapon]飞雷之弦振" },
        value: {
          param_type: "Struct",
          value: {
            structId: entryStructId,
            type: "Struct",
            value: [
              { param_type: "EntityReference", value: "1077936193" },
              { param_type: "Float", value: "6.00" },
            ],
          },
        },
      },
    ],
  };
}

function workspace() {
  return new VariableWorkspace({ [weaponStructId]: weaponDefinition });
}

test("parses a raw exported Dict without a Param-node wrapper", () => {
  const source = createWeaponDictionary();
  const original = structuredClone(source);
  const parsed = workspace().parse(source);

  assert.equal(parsed.type, "Dict");
  assert.equal(parsed.defineType, undefined);
  assert.equal(parsed.defineStructId, undefined);
  assert.equal(parsed.isTypeMatch, true);
  assert.deepEqual(parsed.issues, []);

  const entry = parsed.value[0];
  assert.equal(entry.key.value, "[weapon]飞雷之弦振");
  assert.equal(entry.value.type, "Struct");
  assert.equal(entry.value.structId, weaponStructId);
  assert.equal(entry.value.defineStructId, weaponStructId);
  assert.equal(entry.value.isTypeMatch, true);
  assert.equal(entry.value.value["元件id"].value, "1077936193");
  assert.equal(entry.value.value["攻击力"].value, "6.00");

  assert.deepEqual(source, original, "parse must not mutate the caller's export");
  assert.deepEqual(parsed.toQxqyValue(), original);
  assert.deepEqual(JSON.parse(parsed.serialize()), original);
});

test("parses a raw exported Dict JSON string", () => {
  const source = createWeaponDictionary();
  const parsed = workspace().parse(JSON.stringify(source));

  assert.equal(parsed.type, "Dict");
  assert.equal(parsed.value[0].value.value["攻击力"].value, "6.00");
  assert.deepEqual(parsed.toQxqyValue(), source);
});

test("keeps wrapped Dict Param nodes compatible", () => {
  const source = createWeaponDictionary();
  const parsed = workspace().parse({ param_type: "Dict", value: source });

  assert.equal(parsed.isTypeMatch, true);
  assert.deepEqual(parsed.issues, []);
  assert.deepEqual(parsed.toQxqyValue(), source);
});

test("uses raw value_structId for defaults and mismatch diagnostics", () => {
  const parsed = workspace().parse(createWeaponDictionary());

  assert.equal(parsed.appendItem(), 1);
  assert.equal(parsed.value[1].key.value, "");
  assert.equal(parsed.value[1].value.structId, weaponStructId);
  assert.equal(parsed.value[1].value.value["元件id"].value, "0");
  assert.equal(parsed.value[1].value.value["攻击力"].value, "0.00");

  const mismatched = workspace().parse(createWeaponDictionary("9999999999"));
  assert.equal(mismatched.isTypeMatch, true);
  assert.equal(mismatched.value[0].value.isTypeMatch, false);
  assert.equal(mismatched.issues[0].kind, "struct-id-mismatch");
  assert.equal(mismatched.issues[0].defineStructId, weaponStructId);
  assert.equal(mismatched.issues[0].structId, "9999999999");
});

test("rejects malformed raw Dict exports", () => {
  assert.throws(
    () =>
      workspace().parse({
        type: "Dict",
        value_type: "Struct",
        value_structId: weaponStructId,
        value: [],
      }),
    /Expected a Qianxing exported Struct\/Dict value or Param node/,
  );
});