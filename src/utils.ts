export function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isParamNode(value: unknown): value is import("./types.js").QxqyParamNode {
  return isRecord(value) && typeof value.param_type === "string" && "value" in value;
}

export function isStructNode(value: unknown): value is import("./types.js").QxqyStructNode {
  return (
    isRecord(value) &&
    value.type === "Struct" &&
    typeof value.structId === "string" &&
    Array.isArray(value.value)
  );
}
export function isDictNode(value: unknown): value is import("./types.js").QxqyDictNode {
  return (
    isRecord(value) &&
    value.type === "Dict" &&
    typeof value.key_type === "string" &&
    typeof value.value_type === "string" &&
    Array.isArray(value.value) &&
    (value.value_structId === undefined || typeof value.value_structId === "string")
  );
}
