export function clone(value) {
    if (typeof structuredClone === "function")
        return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isParamNode(value) {
    return isRecord(value) && typeof value.param_type === "string" && "value" in value;
}
export function isStructNode(value) {
    return (isRecord(value) &&
        value.type === "Struct" &&
        typeof value.structId === "string" &&
        Array.isArray(value.value));
}
//# sourceMappingURL=utils.js.map