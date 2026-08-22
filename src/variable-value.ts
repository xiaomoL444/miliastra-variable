import type { VariableWorkspace } from "./workspace.js";
import { getPresence, setPresence } from "./normalization.js";
import type {
  ParamType,
  QxqyDictNode,
  QxqyParamNode,
  QxqyStructListNode,
  QxqyStructNode,
  VariableClipboardData,
  VariableDictEntryValue,
  VariableObjectValue,
  VariableIssue,
  VariableValueData,
} from "./types.js";
import { clone, isParamNode, isRecord } from "./utils.js";

/** @internal */
export interface ValueDefinition {
  type?: ParamType;
  structId?: string;
  name?: string;
  defaultNode?: QxqyParamNode;
}

export class VariableValue {
  constructor(
    readonly workspace: VariableWorkspace,
    private readonly node: QxqyParamNode,
    private readonly definition: ValueDefinition = {},
    readonly path = "$",
    private readonly root = false,
  ) {}

  get type(): ParamType {
    return this.node.param_type;
  }

  get defineType(): ParamType | undefined {
    return this.definition.type;
  }

  /** Field name for members, or the struct type name for struct roots/elements. */
  get name(): string | undefined {
    if (this.definition.name) return this.definition.name;
    return this.workspace.definitionRef(this.structId)?.name;
  }

  get structId(): string | undefined {
    return this.workspace.structIdOf(this.node);
  }

  get defineStructId(): string | undefined {
    return this.definition.structId;
  }

  get presence() {
    return getPresence(this.node);
  }

  get isMissing(): boolean {
    return this.presence === "missing";
  }

  get isExtra(): boolean {
    return this.presence === "extra";
  }

  get isTypeMatch(): boolean {
    if (this.presence !== "present") return false;
    if (this.defineType !== undefined && this.type !== this.defineType) return false;
    if (
      (this.type === "Struct" || this.type === "StructList") &&
      this.defineStructId !== undefined
    ) {
      return this.structId === this.defineStructId;
    }
    if (this.type === "Dict" && this.defineStructId !== undefined) {
      return this.structId === this.defineStructId;
    }
    return true;
  }

  // Definitions are runtime JSON, so field names cannot be inferred statically.
  // `any` intentionally keeps `value.xxx.value` ergonomic for dynamic schemas.
  get value(): any {
    const valueType = this.isMissing ? this.defineType : this.type;
    if (valueType === "Struct") return this.#structValue();
    if (valueType === "StructList") return this.#structListValue();
    if (valueType === "Dict") return this.#dictValue();
    return this.node.value;
  }

  /** Replaces only the raw value while keeping the node's current type. */
  setValue(value: unknown): this {
    this.node.value = clone(value);
    return this;
  }

  /** Returns an isolated, JSON-safe clipboard payload. */
  copy(): VariableClipboardData {
    return {
      format: "miliastra-variable/clipboard@1",
      node: clone(this.node),
    };
  }

  canPaste(data: VariableClipboardData): boolean {
    if (data?.format !== "miliastra-variable/clipboard@1" || !isParamNode(data.node)) {
      return false;
    }
    const target = this.isMissing ? this.definition.defaultNode : this.node;
    return target ? this.#sameType(target, data.node) : false;
  }

  /** Pastes an isolated copy and returns false without mutation when types differ. */
  paste(data: VariableClipboardData): boolean {
    if (!this.canPaste(data)) return false;
    const next = clone(data.node);
    this.node.param_type = next.param_type;
    this.node.value = next.value;
    if (this.isMissing) setPresence(this.node, "present");
    return true;
  }

  /** Restores the definition's exported default. Returns false if none is available. */
  reset(): boolean {
    if (!this.definition.defaultNode) return false;
    const next = clone(this.definition.defaultNode);
    this.node.param_type = next.param_type;
    this.node.value = next.value;
    setPresence(this.node, "present");
    return true;
  }

  /** The original Qianxing parameter-node representation. */
  toParamNode(): QxqyParamNode {
    return clone(this.node);
  }

  /** The importable Qianxing value; for a parsed root this is the Struct node. */
  toQxqyValue(): unknown {
    return clone(this.node.value);
  }

  serialize(space?: number): string {
    return JSON.stringify(this.toQxqyValue(), null, space);
  }

  toJSON(): unknown {
    return this.root ? this.toQxqyValue() : this.toParamNode();
  }

  get issues(): readonly VariableIssue[] {
    const issues: VariableIssue[] = [];
    this.#collectIssues(issues);
    return issues;
  }

  get warnings(): readonly VariableIssue[] {
    return this.issues;
  }

  #structValue(): VariableObjectValue {
    const raw = this.node.value as Partial<QxqyStructNode>;
    if (!isRecord(raw) || !Array.isArray(raw.value)) return Object.create(null);
    const structDefinition = this.workspace.definitionRef(
      typeof raw.structId === "string" ? raw.structId : this.defineStructId,
    );
    const result: VariableObjectValue = Object.create(null) as VariableObjectValue;
    raw.value.forEach((child, index) => {
      if (!isParamNode(child)) return;
      const field = structDefinition?.value[index];
      const key = field?.key ?? `$extra[${index}]`;
      const expected: ValueDefinition = {
        type: field?.param_type,
        structId: field ? this.#definedStructId(field.value) : undefined,
        name: field?.key,
        defaultNode: field ? clone(field.value) : undefined,
      };
      result[key] = new VariableValue(
        this.workspace,
        child,
        expected,
        `${this.path}.value.${key}`,
      );
    });
    return result;
  }

  #structListValue(): VariableValue[] {
    const raw = this.node.value as Partial<QxqyStructListNode>;
    if (!isRecord(raw) || !Array.isArray(raw.value)) return [];
    const structId = typeof raw.structId === "string" ? raw.structId : undefined;
    const definition = this.workspace.definitionRef(structId);
    return raw.value.flatMap((child, index) => {
      if (!isParamNode(child)) return [];
      let defaultNode: QxqyParamNode | undefined;
      if (structId && definition) {
        defaultNode = this.workspace.createDefaultParam("Struct", structId);
      }
      return [
        new VariableValue(
          this.workspace,
          child,
          { type: "Struct", structId, name: definition?.name, defaultNode },
          `${this.path}.value[${index}]`,
        ),
      ];
    });
  }

  #dictValue(): VariableDictEntryValue[] {
    const raw = this.node.value as Partial<QxqyDictNode>;
    if (!isRecord(raw) || !Array.isArray(raw.value)) return [];
    const defaultDict = this.definition.defaultNode?.value;
    const expectedDict = isRecord(defaultDict) ? defaultDict : undefined;
    const keyType =
      typeof expectedDict?.key_type === "string" ? expectedDict.key_type : raw.key_type;
    const valueType =
      typeof expectedDict?.value_type === "string" ? expectedDict.value_type : raw.value_type;
    const valueStructId =
      typeof expectedDict?.value_structId === "string"
        ? expectedDict.value_structId
        : undefined;

    return raw.value.flatMap((entry, index) => {
      if (!isRecord(entry) || !isParamNode(entry.key) || !isParamNode(entry.value)) {
        return [];
      }
      return [{
        key: new VariableValue(
          this.workspace,
          entry.key,
          {
            type: keyType,
            name: "key",
            defaultNode: this.#defaultParam(keyType),
          },
          `${this.path}.value[${index}].key`,
        ),
        value: new VariableValue(
          this.workspace,
          entry.value,
          {
            type: valueType,
            structId: valueStructId,
            name: "value",
            defaultNode: this.#defaultParam(valueType, valueStructId),
          },
          `${this.path}.value[${index}].value`,
        ),
      }];
    });
  }

  #definedStructId(node: QxqyParamNode): string | undefined {
    return this.workspace.structIdOf(node);
  }

  #defaultParam(type: ParamType | undefined, structId?: string): QxqyParamNode | undefined {
    if (!type) return undefined;
    if (type === "Struct" && (!structId || !this.workspace.definitionRef(structId))) {
      return undefined;
    }
    return this.workspace.createDefaultParam(type, structId);
  }

  #sameType(left: QxqyParamNode, right: QxqyParamNode): boolean {
    if (left.param_type !== right.param_type) return false;
    if (left.param_type === "Struct" || left.param_type === "StructList") {
      return this.workspace.structIdOf(left) === this.workspace.structIdOf(right);
    }
    if (left.param_type === "Dict") {
      const a = left.value;
      const b = right.value;
      if (!isRecord(a) || !isRecord(b)) return false;
      return (
        a.key_type === b.key_type &&
        a.value_type === b.value_type &&
        a.value_structId === b.value_structId
      );
    }
    return true;
  }

  #collectIssues(output: VariableIssue[]): void {
    if (!this.isTypeMatch) {
      const kind = this.#issueKind();
      const issue: VariableIssue = {
        kind,
        message: this.#issueMessage(kind),
        path: this.path,
        type: this.type,
      };
      if (this.defineType !== undefined) issue.defineType = this.defineType;
      if (this.structId !== undefined) issue.structId = this.structId;
      if (this.defineStructId !== undefined) issue.defineStructId = this.defineStructId;
      output.push(issue);
    }
    const valueType = this.isMissing ? this.defineType : this.type;
    if (valueType === "Struct") {
      for (const child of Object.values(this.#structValue())) child.#collectIssues(output);
    } else if (valueType === "StructList") {
      for (const child of this.#structListValue()) child.#collectIssues(output);
    } else if (valueType === "Dict") {
      for (const entry of this.#dictValue()) {
        entry.key.#collectIssues(output);
        entry.value.#collectIssues(output);
      }
    }
  }

  #issueKind(): VariableIssue["kind"] {
    if (this.isMissing) return "missing-field";
    if (this.isExtra) return "extra-field";
    if (this.type === this.defineType && this.defineStructId !== undefined && this.structId !== this.defineStructId) {
      return "struct-id-mismatch";
    }
    return "type-mismatch";
  }

  #issueMessage(kind: VariableIssue["kind"]): string {
    if (kind === "missing-field") {
      return `变量缺少字段，已用定义默认值补充；实际类型留空，定义类型为 ${this.defineType ?? "未知"}。`;
    }
    if (kind === "extra-field") return "变量包含定义之外的多余字段，已原样保留。";
    if (kind === "struct-id-mismatch") {
      return `结构体 ID 不一致：变量为 ${this.structId ?? "空"}，定义为 ${this.defineStructId ?? "空"}。`;
    }
    return `字段类型不一致：变量为 ${this.type || "空"}，定义为 ${this.defineType ?? "未知"}。`;
  }
}
