import type { VariableWorkspace } from "./workspace.js";
import { getPresence, normalizeNode, setPresence } from "./normalization.js";
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
  // `any` intentionally keeps `value["xxx"].value` ergonomic for dynamic schemas.
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



  /** Number of entries in a normal list, StructList, or Dict. */
  get itemCount(): number {
    return this.#collectionItems().length;
  }

  /** Appends an item and returns its index. Omit the item to use a type default. */
  appendItem(item?: unknown): number {
    const items = this.#collectionItems();
    const index = items.length;
    items.push(this.#createCollectionItem(item));
    return index;
  }

  /** Inserts before index and returns the inserted index. */
  insertItem(index: number, item?: unknown): number {
    const items = this.#collectionItems();
    this.#assertIndex(index, items.length, true);
    items.splice(index, 0, this.#createCollectionItem(item));
    return index;
  }

  /** Swaps two items in place. */
  swapItems(firstIndex: number, secondIndex: number): this {
    const items = this.#collectionItems();
    this.#assertIndex(firstIndex, items.length);
    this.#assertIndex(secondIndex, items.length);
    [items[firstIndex], items[secondIndex]] = [items[secondIndex], items[firstIndex]];
    return this;
  }

  /**
   * Removes and returns an item. StructList items return clipboard data; Dict
   * entries return `{ key: clipboard, value: clipboard }` for easy reinsertion.
   */
  removeItem(index: number): unknown {
    const items = this.#collectionItems();
    this.#assertIndex(index, items.length);
    const [removed] = items.splice(index, 1);
    const type = this.#collectionType();
    if (type === "StructList" && isParamNode(removed)) {
      return this.#clipboard(removed);
    }
    if (
      type === "Dict" &&
      isRecord(removed) &&
      isParamNode(removed.key) &&
      isParamNode(removed.value)
    ) {
      return {
        key: this.#clipboard(removed.key),
        value: this.#clipboard(removed.value),
      };
    }
    return clone(removed);
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
        `${this.path}.value[${JSON.stringify(key)}]`,
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
        : typeof raw.value_structId === "string"
          ? raw.value_structId
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



  #collectionType(): ParamType {
    const type = this.isMissing ? this.defineType : this.type;
    if (type === "Dict" || type === "StructList" || type?.endsWith("List")) {
      return type;
    }
    throw new TypeError(`${this.path} is not a list, StructList, or Dict.`);
  }

  #collectionItems(): unknown[] {
    const type = this.#collectionType();
    if (type === "Dict" || type === "StructList") {
      if (!isRecord(this.node.value) || !Array.isArray(this.node.value.value)) {
        throw new TypeError(`${this.path} has an invalid ${type} value.`);
      }
      return this.node.value.value;
    }
    if (!Array.isArray(this.node.value)) {
      throw new TypeError(`${this.path} has an invalid ${type} value.`);
    }
    return this.node.value;
  }

  #createCollectionItem(item: unknown): unknown {
    const type = this.#collectionType();
    if (type === "StructList") return this.#createStructListItem(item);
    if (type === "Dict") return this.#createDictItem(item);

    const elementType = type.slice(0, -"List".length) as ParamType;
    if (item === undefined) return clone(this.workspace.createDefaultParam(elementType).value);
    const node = this.#inputNode(item);
    if (node) {
      if (node.param_type !== elementType) {
        throw new TypeError(`Expected ${elementType}, received ${node.param_type}.`);
      }
      this.#validateValue(elementType, node.value);
      return clone(node.value);
    }
    this.#validateValue(elementType, item);
    return clone(item);
  }

  #createStructListItem(item: unknown): QxqyParamNode {
    const raw = this.node.value;
    if (!isRecord(raw) || typeof raw.structId !== "string") {
      throw new TypeError(`${this.path} has no StructList structId.`);
    }
    const structId = raw.structId;
    let node = this.#inputNode(item);
    if (!node && isRecord(item) && item.type === "Struct") {
      node = { param_type: "Struct", value: clone(item) };
    }
    if (!node) {
      if (!this.workspace.definitionRef(structId)) {
        throw new Error(`Cannot create a default StructList item: unknown struct ${structId}.`);
      }
      node = this.workspace.createDefaultParam("Struct", structId);
    }
    if (node.param_type !== "Struct" || this.workspace.structIdOf(node) !== structId) {
      throw new TypeError(`Expected Struct ${structId}.`);
    }
    const defaultNode = this.workspace.definitionRef(structId)
      ? this.workspace.createDefaultParam("Struct", structId)
      : undefined;
    normalizeNode(this.workspace, node, defaultNode);
    return node;
  }

  #createDictItem(item: unknown): { key: QxqyParamNode; value: QxqyParamNode } {
    const raw = this.node.value;
    if (!isRecord(raw)) throw new TypeError(`${this.path} has an invalid Dict value.`);
    const expected = this.definition.defaultNode?.value;
    const expectedDict = isRecord(expected) ? expected : undefined;
    const keyType = this.#headerType(expectedDict?.key_type, raw.key_type, "key_type");
    const valueType = this.#headerType(expectedDict?.value_type, raw.value_type, "value_type");
    const valueStructId =
      typeof expectedDict?.value_structId === "string"
        ? expectedDict.value_structId
        : typeof raw.value_structId === "string"
          ? raw.value_structId
          : undefined;
    const input = isRecord(item) ? item : {};
    const key = this.#createDictPart(input.key, keyType);
    const value = this.#createDictPart(input.value, valueType, valueStructId);
    return { key, value };
  }

  #createDictPart(input: unknown, type: ParamType, structId?: string): QxqyParamNode {
    let node = this.#inputNode(input);
    if (!node) {
      if (input !== undefined) node = { param_type: type, value: clone(input) };
      else {
        if (type === "Struct" && (!structId || !this.workspace.definitionRef(structId))) {
          throw new Error(
            `Cannot create a default Dict value: unknown struct ${structId ?? ""}.`,
          );
        }
        node = this.workspace.createDefaultParam(type, structId);
      }
    }
    if (node.param_type !== type) {
      throw new TypeError(`Expected Dict ${type}, received ${node.param_type}.`);
    }
    if (
      (type === "Struct" || type === "StructList") &&
      structId !== undefined &&
      this.workspace.structIdOf(node) !== structId
    ) {
      throw new TypeError(`Expected Dict ${type} ${structId}.`);
    }
    if (type !== "Struct" && type !== "StructList" && type !== "Dict") {
      this.#validateValue(type, node.value);
    }
    normalizeNode(this.workspace, node, this.#defaultParam(type, structId));
    return node;
  }

  #inputNode(input: unknown): QxqyParamNode | undefined {
    if (input instanceof VariableValue) return input.toParamNode();
    if (
      isRecord(input) &&
      input.format === "miliastra-variable/clipboard@1" &&
      isParamNode(input.node)
    ) {
      return clone(input.node);
    }
    return isParamNode(input) ? clone(input) : undefined;
  }

  #headerType(
    expected: unknown,
    actual: unknown,
    name: "key_type" | "value_type",
  ): ParamType {
    const type = typeof expected === "string" ? expected : actual;
    if (typeof type !== "string") throw new TypeError(`${this.path} Dict has no ${name}.`);
    return type;
  }



  #validateValue(type: ParamType, value: unknown): void {
    if (type.endsWith("List") && type !== "StructList") {
      if (!Array.isArray(value)) this.#invalidValue(type, value);
      const elementType = type.slice(0, -"List".length) as ParamType;
      for (const element of value) this.#validateValue(elementType, element);
      return;
    }

    if (typeof value !== "string") this.#invalidValue(type, value);
    const text = value as string;
    const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const integerPattern = /^[+-]?\d+$/;

    if (type === "String") return;
    if (type === "Bool") {
      if (text !== "True" && text !== "False") this.#invalidValue(type, value);
      return;
    }
    if (type === "Int32") {
      if (!integerPattern.test(text)) this.#invalidValue(type, value);
      const number = Number(text);
      if (!Number.isInteger(number) || number < -2147483648 || number > 2147483647) {
        this.#invalidValue(type, value);
      }
      return;
    }
    if (type === "Float") {
      if (!numberPattern.test(text) || !Number.isFinite(Number(text))) {
        this.#invalidValue(type, value);
      }
      return;
    }
    if (type === "Vector3") {
      const components = text.split(",");
      if (
        components.length !== 3 ||
        components.some(
          (component) =>
            !numberPattern.test(component.trim()) ||
            !Number.isFinite(Number(component.trim())),
        )
      ) {
        this.#invalidValue(type, value);
      }
      return;
    }

    if (
      [
        "Entity",
        "Guid",
        "ConfigReference",
        "EntityReference",
        "Army",
      ].includes(type) &&
      !integerPattern.test(text)
    ) {
      this.#invalidValue(type, value);
    }
  }

  #invalidValue(type: ParamType, value: unknown): never {
    throw new TypeError(
      `Invalid ${type} value at ${this.path}: ${JSON.stringify(value)}.`,
    );
  }

  #clipboard(node: QxqyParamNode): VariableClipboardData {
    return { format: "miliastra-variable/clipboard@1", node: clone(node) };
  }

  #assertIndex(index: number, length: number, allowEnd = false): void {
    const max = allowEnd ? length : length - 1;
    if (!Number.isInteger(index) || index < 0 || index > max) {
      throw new RangeError(`Index ${index} is outside 0..${max}.`);
    }
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
