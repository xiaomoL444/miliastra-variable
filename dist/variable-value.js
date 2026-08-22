var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _VariableValue_instances, _a, _VariableValue_structValue, _VariableValue_structListValue, _VariableValue_dictValue, _VariableValue_definedStructId, _VariableValue_defaultParam, _VariableValue_sameType, _VariableValue_collectIssues, _VariableValue_issueKind, _VariableValue_issueMessage;
import { getPresence, setPresence } from "./normalization.js";
import { clone, isParamNode, isRecord } from "./utils.js";
export class VariableValue {
    constructor(workspace, node, definition = {}, path = "$", root = false) {
        _VariableValue_instances.add(this);
        this.workspace = workspace;
        this.node = node;
        this.definition = definition;
        this.path = path;
        this.root = root;
    }
    get type() {
        return this.node.param_type;
    }
    get defineType() {
        return this.definition.type;
    }
    /** Field name for members, or the struct type name for struct roots/elements. */
    get name() {
        if (this.definition.name)
            return this.definition.name;
        return this.workspace.definitionRef(this.structId)?.name;
    }
    get structId() {
        return this.workspace.structIdOf(this.node);
    }
    get defineStructId() {
        return this.definition.structId;
    }
    get presence() {
        return getPresence(this.node);
    }
    get isMissing() {
        return this.presence === "missing";
    }
    get isExtra() {
        return this.presence === "extra";
    }
    get isTypeMatch() {
        if (this.presence !== "present")
            return false;
        if (this.defineType !== undefined && this.type !== this.defineType)
            return false;
        if ((this.type === "Struct" || this.type === "StructList") &&
            this.defineStructId !== undefined) {
            return this.structId === this.defineStructId;
        }
        if (this.type === "Dict" && this.defineStructId !== undefined) {
            return this.structId === this.defineStructId;
        }
        return true;
    }
    // Definitions are runtime JSON, so field names cannot be inferred statically.
    // `any` intentionally keeps `value.xxx.value` ergonomic for dynamic schemas.
    get value() {
        const valueType = this.isMissing ? this.defineType : this.type;
        if (valueType === "Struct")
            return __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_structValue).call(this);
        if (valueType === "StructList")
            return __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_structListValue).call(this);
        if (valueType === "Dict")
            return __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_dictValue).call(this);
        return this.node.value;
    }
    /** Replaces only the raw value while keeping the node's current type. */
    setValue(value) {
        this.node.value = clone(value);
        return this;
    }
    /** Returns an isolated, JSON-safe clipboard payload. */
    copy() {
        return {
            format: "miliastra-variable/clipboard@1",
            node: clone(this.node),
        };
    }
    canPaste(data) {
        if (data?.format !== "miliastra-variable/clipboard@1" || !isParamNode(data.node)) {
            return false;
        }
        const target = this.isMissing ? this.definition.defaultNode : this.node;
        return target ? __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_sameType).call(this, target, data.node) : false;
    }
    /** Pastes an isolated copy and returns false without mutation when types differ. */
    paste(data) {
        if (!this.canPaste(data))
            return false;
        const next = clone(data.node);
        this.node.param_type = next.param_type;
        this.node.value = next.value;
        if (this.isMissing)
            setPresence(this.node, "present");
        return true;
    }
    /** Restores the definition's exported default. Returns false if none is available. */
    reset() {
        if (!this.definition.defaultNode)
            return false;
        const next = clone(this.definition.defaultNode);
        this.node.param_type = next.param_type;
        this.node.value = next.value;
        setPresence(this.node, "present");
        return true;
    }
    /** The original Qianxing parameter-node representation. */
    toParamNode() {
        return clone(this.node);
    }
    /** The importable Qianxing value; for a parsed root this is the Struct node. */
    toQxqyValue() {
        return clone(this.node.value);
    }
    serialize(space) {
        return JSON.stringify(this.toQxqyValue(), null, space);
    }
    toJSON() {
        return this.root ? this.toQxqyValue() : this.toParamNode();
    }
    get issues() {
        const issues = [];
        __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_collectIssues).call(this, issues);
        return issues;
    }
    get warnings() {
        return this.issues;
    }
}
_a = VariableValue, _VariableValue_instances = new WeakSet(), _VariableValue_structValue = function _VariableValue_structValue() {
    const raw = this.node.value;
    if (!isRecord(raw) || !Array.isArray(raw.value))
        return Object.create(null);
    const structDefinition = this.workspace.definitionRef(typeof raw.structId === "string" ? raw.structId : this.defineStructId);
    const result = Object.create(null);
    raw.value.forEach((child, index) => {
        if (!isParamNode(child))
            return;
        const field = structDefinition?.value[index];
        const key = field?.key ?? `$extra[${index}]`;
        const expected = {
            type: field?.param_type,
            structId: field ? __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_definedStructId).call(this, field.value) : undefined,
            name: field?.key,
            defaultNode: field ? clone(field.value) : undefined,
        };
        result[key] = new _a(this.workspace, child, expected, `${this.path}.value.${key}`);
    });
    return result;
}, _VariableValue_structListValue = function _VariableValue_structListValue() {
    const raw = this.node.value;
    if (!isRecord(raw) || !Array.isArray(raw.value))
        return [];
    const structId = typeof raw.structId === "string" ? raw.structId : undefined;
    const definition = this.workspace.definitionRef(structId);
    return raw.value.flatMap((child, index) => {
        if (!isParamNode(child))
            return [];
        let defaultNode;
        if (structId && definition) {
            defaultNode = this.workspace.createDefaultParam("Struct", structId);
        }
        return [
            new _a(this.workspace, child, { type: "Struct", structId, name: definition?.name, defaultNode }, `${this.path}.value[${index}]`),
        ];
    });
}, _VariableValue_dictValue = function _VariableValue_dictValue() {
    const raw = this.node.value;
    if (!isRecord(raw) || !Array.isArray(raw.value))
        return [];
    const defaultDict = this.definition.defaultNode?.value;
    const expectedDict = isRecord(defaultDict) ? defaultDict : undefined;
    const keyType = typeof expectedDict?.key_type === "string" ? expectedDict.key_type : raw.key_type;
    const valueType = typeof expectedDict?.value_type === "string" ? expectedDict.value_type : raw.value_type;
    const valueStructId = typeof expectedDict?.value_structId === "string"
        ? expectedDict.value_structId
        : undefined;
    return raw.value.flatMap((entry, index) => {
        if (!isRecord(entry) || !isParamNode(entry.key) || !isParamNode(entry.value)) {
            return [];
        }
        return [{
                key: new _a(this.workspace, entry.key, {
                    type: keyType,
                    name: "key",
                    defaultNode: __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_defaultParam).call(this, keyType),
                }, `${this.path}.value[${index}].key`),
                value: new _a(this.workspace, entry.value, {
                    type: valueType,
                    structId: valueStructId,
                    name: "value",
                    defaultNode: __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_defaultParam).call(this, valueType, valueStructId),
                }, `${this.path}.value[${index}].value`),
            }];
    });
}, _VariableValue_definedStructId = function _VariableValue_definedStructId(node) {
    return this.workspace.structIdOf(node);
}, _VariableValue_defaultParam = function _VariableValue_defaultParam(type, structId) {
    if (!type)
        return undefined;
    if (type === "Struct" && (!structId || !this.workspace.definitionRef(structId))) {
        return undefined;
    }
    return this.workspace.createDefaultParam(type, structId);
}, _VariableValue_sameType = function _VariableValue_sameType(left, right) {
    if (left.param_type !== right.param_type)
        return false;
    if (left.param_type === "Struct" || left.param_type === "StructList") {
        return this.workspace.structIdOf(left) === this.workspace.structIdOf(right);
    }
    if (left.param_type === "Dict") {
        const a = left.value;
        const b = right.value;
        if (!isRecord(a) || !isRecord(b))
            return false;
        return (a.key_type === b.key_type &&
            a.value_type === b.value_type &&
            a.value_structId === b.value_structId);
    }
    return true;
}, _VariableValue_collectIssues = function _VariableValue_collectIssues(output) {
    var _b, _c;
    if (!this.isTypeMatch) {
        const kind = __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_issueKind).call(this);
        const issue = {
            kind,
            message: __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_issueMessage).call(this, kind),
            path: this.path,
            type: this.type,
        };
        if (this.defineType !== undefined)
            issue.defineType = this.defineType;
        if (this.structId !== undefined)
            issue.structId = this.structId;
        if (this.defineStructId !== undefined)
            issue.defineStructId = this.defineStructId;
        output.push(issue);
    }
    const valueType = this.isMissing ? this.defineType : this.type;
    if (valueType === "Struct") {
        for (const child of Object.values(__classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_structValue).call(this)))
            __classPrivateFieldGet(child, _VariableValue_instances, "m", _VariableValue_collectIssues).call(child, output);
    }
    else if (valueType === "StructList") {
        for (const child of __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_structListValue).call(this))
            __classPrivateFieldGet(child, _VariableValue_instances, "m", _VariableValue_collectIssues).call(child, output);
    }
    else if (valueType === "Dict") {
        for (const entry of __classPrivateFieldGet(this, _VariableValue_instances, "m", _VariableValue_dictValue).call(this)) {
            __classPrivateFieldGet((_b = entry.key), _VariableValue_instances, "m", _VariableValue_collectIssues).call(_b, output);
            __classPrivateFieldGet((_c = entry.value), _VariableValue_instances, "m", _VariableValue_collectIssues).call(_c, output);
        }
    }
}, _VariableValue_issueKind = function _VariableValue_issueKind() {
    if (this.isMissing)
        return "missing-field";
    if (this.isExtra)
        return "extra-field";
    if (this.type === this.defineType && this.defineStructId !== undefined && this.structId !== this.defineStructId) {
        return "struct-id-mismatch";
    }
    return "type-mismatch";
}, _VariableValue_issueMessage = function _VariableValue_issueMessage(kind) {
    if (kind === "missing-field") {
        return `变量缺少字段，已用定义默认值补充；实际类型留空，定义类型为 ${this.defineType ?? "未知"}。`;
    }
    if (kind === "extra-field")
        return "变量包含定义之外的多余字段，已原样保留。";
    if (kind === "struct-id-mismatch") {
        return `结构体 ID 不一致：变量为 ${this.structId ?? "空"}，定义为 ${this.defineStructId ?? "空"}。`;
    }
    return `字段类型不一致：变量为 ${this.type || "空"}，定义为 ${this.defineType ?? "未知"}。`;
};
//# sourceMappingURL=variable-value.js.map