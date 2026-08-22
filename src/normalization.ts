import type { VariableWorkspace } from "./workspace.js";
import type {
  QxqyParamNode,
  VariableValuePresence,
} from "./types.js";
import { clone, isParamNode, isRecord } from "./utils.js";

const presence = new WeakMap<object, VariableValuePresence>();

export function getPresence(node: QxqyParamNode): VariableValuePresence {
  return presence.get(node) ?? "present";
}

export function setPresence(
  node: QxqyParamNode,
  value: VariableValuePresence,
): void {
  if (value === "present") presence.delete(node);
  else presence.set(node, value);
}

/**
 * Completes definition fields without mutating the caller's source object.
 * Fields are positional in Qianxing JSON, so only tail additions/removals are
 * unambiguous. Lists and dictionary entry counts are variable by definition.
 */
export function normalizeNode(
  workspace: VariableWorkspace,
  node: QxqyParamNode,
  expected?: QxqyParamNode,
): void {
  const effectiveType = node.param_type || expected?.param_type;

  if (effectiveType === "Struct" && isRecord(node.value)) {
    const rawValues = Array.isArray(node.value.value) ? node.value.value : undefined;
    if (!rawValues) return;
    const expectedValue = expected && isRecord(expected.value) ? expected.value : undefined;
    const expectedId =
      typeof expectedValue?.structId === "string" ? expectedValue.structId : undefined;
    const actualId =
      typeof node.value.structId === "string" ? node.value.structId : undefined;
    const definition = workspace.definitionRef(expectedId) ?? workspace.definitionRef(actualId);
    if (!definition) return;

    const originalLength = rawValues.length;
    for (let index = 0; index < definition.value.length; index += 1) {
      const field = definition.value[index]!;
      let child = rawValues[index];
      if (!isParamNode(child)) {
        child = clone(field.value);
        child.param_type = "";
        rawValues[index] = child;
        setPresence(child, "missing");
      }
      normalizeNode(workspace, child, field.value);
    }
    for (let index = definition.value.length; index < originalLength; index += 1) {
      const child = rawValues[index];
      if (!isParamNode(child)) continue;
      setPresence(child, "extra");
      normalizeNode(workspace, child);
    }
    return;
  }

  if (
    effectiveType === "StructList" &&
    isRecord(node.value) &&
    Array.isArray(node.value.value)
  ) {
    const structId = typeof node.value.structId === "string" ? node.value.structId : undefined;
    const defaultItem =
      structId && workspace.definitionRef(structId)
        ? workspace.createDefaultParam("Struct", structId)
        : undefined;
    for (const child of node.value.value) {
      if (isParamNode(child)) normalizeNode(workspace, child, defaultItem);
    }
    return;
  }

  if (effectiveType !== "Dict" || !isRecord(node.value) || !Array.isArray(node.value.value)) {
    return;
  }
  const expectedValue = expected && isRecord(expected.value) ? expected.value : undefined;
  const keyType =
    typeof expectedValue?.key_type === "string"
      ? expectedValue.key_type
      : typeof node.value.key_type === "string"
        ? node.value.key_type
        : undefined;
  const valueType =
    typeof expectedValue?.value_type === "string"
      ? expectedValue.value_type
      : typeof node.value.value_type === "string"
        ? node.value.value_type
        : undefined;
  const valueStructId =
    typeof expectedValue?.value_structId === "string"
      ? expectedValue.value_structId
      : typeof node.value.value_structId === "string"
        ? node.value.value_structId
        : undefined;
  const keyDefault = keyType ? workspace.createDefaultParam(keyType) : undefined;
  const valueDefault =
    valueType && (valueType !== "Struct" || (valueStructId && workspace.definitionRef(valueStructId)))
      ? workspace.createDefaultParam(valueType, valueStructId)
      : undefined;
  for (const entry of node.value.value) {
    if (!isRecord(entry)) continue;
    if (isParamNode(entry.key)) normalizeNode(workspace, entry.key, keyDefault);
    if (isParamNode(entry.value)) normalizeNode(workspace, entry.value, valueDefault);
  }
}
