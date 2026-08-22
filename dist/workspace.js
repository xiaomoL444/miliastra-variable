var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _StructWorkspace_instances, _StructWorkspace_definitions, _StructWorkspace_assertDefinition;
import { StructValue } from "./struct-value.js";
import { normalizeNode } from "./normalization.js";
import { clone, isParamNode, isRecord, isStructNode } from "./utils.js";
export class StructWorkspace {
    constructor(definitions) {
        _StructWorkspace_instances.add(this);
        _StructWorkspace_definitions.set(this, new Map());
        if (definitions)
            this.importDefinitions(definitions);
    }
    importDefinition(structId, definition) {
        const parsed = typeof definition === "string" ? JSON.parse(definition) : definition;
        __classPrivateFieldGet(this, _StructWorkspace_instances, "m", _StructWorkspace_assertDefinition).call(this, structId, parsed);
        __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").set(String(structId), clone(parsed));
        return this;
    }
    importDefinitions(definitions) {
        if (Array.isArray(definitions)) {
            for (const item of definitions) {
                this.importDefinition(item.structId, item.structDefinition);
            }
            return this;
        }
        for (const [structId, definition] of Object.entries(definitions)) {
            this.importDefinition(structId, definition);
        }
        return this;
    }
    removeDefinition(structId) {
        return __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").delete(String(structId));
    }
    hasDefinition(structId) {
        return __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").has(String(structId));
    }
    getDefinition(structId) {
        const definition = __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").get(String(structId));
        return definition && clone(definition);
    }
    get structIds() {
        return [...__classPrivateFieldGet(this, _StructWorkspace_definitions, "f").keys()];
    }
    parse(variable, options = {}) {
        const parsed = typeof variable === "string" ? JSON.parse(variable) : variable;
        let node;
        if (isParamNode(parsed)) {
            node = clone(parsed);
        }
        else if (isStructNode(parsed)) {
            node = { param_type: "Struct", value: clone(parsed) };
        }
        else {
            throw new TypeError("Expected a Qianxing Struct node or Param node.");
        }
        const actualId = this.structIdOf(node);
        const definitionId = options.definitionId ?? actualId;
        const definition = definitionId ? __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").get(definitionId) : undefined;
        const expected = {
            type: definition ? "Struct" : undefined,
            structId: definitionId,
            name: definition?.name,
            defaultNode: definitionId && definition
                ? this.createDefaultParam("Struct", definitionId)
                : undefined,
        };
        normalizeNode(this, node, expected.defaultNode);
        return new StructValue(this, node, expected, "$", true);
    }
    createDefault(structId) {
        const definition = __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").get(String(structId));
        if (!definition)
            throw new Error(`Unknown struct definition: ${structId}`);
        return this.parse(this.createDefaultParam("Struct", String(structId)), {
            definitionId: String(structId),
        });
    }
    /** @internal */
    definitionRef(structId) {
        return structId ? __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").get(String(structId)) : undefined;
    }
    /** @internal */
    structIdOf(node) {
        if ((node.param_type === "Struct" || node.param_type === "StructList") && isRecord(node.value)) {
            return typeof node.value.structId === "string" ? node.value.structId : undefined;
        }
        if (node.param_type === "Dict" && isRecord(node.value)) {
            return typeof node.value.value_structId === "string"
                ? node.value.value_structId
                : undefined;
        }
        return undefined;
    }
    /** @internal */
    createDefaultParam(type, structId) {
        if (type === "Struct") {
            if (!structId)
                throw new Error("A struct id is required for Struct defaults.");
            const definition = __classPrivateFieldGet(this, _StructWorkspace_definitions, "f").get(String(structId));
            if (!definition)
                throw new Error(`Unknown struct definition: ${structId}`);
            const value = {
                structId: String(structId),
                type: "Struct",
                value: definition.value.map((field) => clone(field.value)),
            };
            return { param_type: "Struct", value };
        }
        if (type === "StructList") {
            return {
                param_type: "StructList",
                value: { structId: String(structId ?? ""), value: [] },
            };
        }
        if (type === "Dict") {
            const value = {
                type: "Dict",
                key_type: "String",
                value_type: "String",
                value: [],
            };
            return { param_type: "Dict", value };
        }
        if (type.endsWith("List"))
            return { param_type: type, value: [] };
        if (type === "Float")
            return { param_type: type, value: "0.00" };
        if (type === "Bool")
            return { param_type: type, value: "False" };
        if (type === "Vector3")
            return { param_type: type, value: "0,0,0" };
        if (type === "String")
            return { param_type: type, value: "" };
        return { param_type: type, value: "0" };
    }
}
_StructWorkspace_definitions = new WeakMap(), _StructWorkspace_instances = new WeakSet(), _StructWorkspace_assertDefinition = function _StructWorkspace_assertDefinition(structId, value) {
    if (!isRecord(value) ||
        typeof value.name !== "string" ||
        !Array.isArray(value.value)) {
        throw new TypeError(`Invalid struct definition: ${structId}`);
    }
    for (const field of value.value) {
        if (!isRecord(field) ||
            typeof field.key !== "string" ||
            typeof field.param_type !== "string" ||
            !isParamNode(field.value)) {
            throw new TypeError(`Invalid field in struct definition: ${structId}`);
        }
    }
};
//# sourceMappingURL=workspace.js.map