import { VariableValue, type ValueDefinition } from "./variable-value.js";
import { normalizeNode } from "./normalization.js";
import type {
  ParamType,
  QxqyDictNode,
  QxqyParamNode,
  QxqyStructNode,
  RegisteredStructDefinition,
  StructDefinition,
} from "./types.js";
import { clone, isParamNode, isRecord, isStructNode } from "./utils.js";

export type DefinitionCollection =
  | Record<string, StructDefinition>
  | readonly RegisteredStructDefinition[];

export interface ParseOptions {
  /** Overrides the definition used for the root, useful when the variable id is damaged. */
  definitionId?: string;
}

export class VariableWorkspace {
  readonly #definitions = new Map<string, StructDefinition>();

  constructor(definitions?: DefinitionCollection) {
    if (definitions) this.importDefinitions(definitions);
  }

  importDefinition(
    structId: string,
    definition: StructDefinition | string,
  ): this {
    const parsed = typeof definition === "string" ? JSON.parse(definition) : definition;
    this.#assertDefinition(structId, parsed);
    this.#definitions.set(String(structId), clone(parsed));
    return this;
  }

  importDefinitions(definitions: DefinitionCollection): this {
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

  removeDefinition(structId: string): boolean {
    return this.#definitions.delete(String(structId));
  }

  hasDefinition(structId: string): boolean {
    return this.#definitions.has(String(structId));
  }

  getDefinition(structId: string): StructDefinition | undefined {
    const definition = this.#definitions.get(String(structId));
    return definition && clone(definition);
  }

  get structIds(): readonly string[] {
    return [...this.#definitions.keys()];
  }

  parse(
    variable: QxqyStructNode | QxqyParamNode | string,
    options: ParseOptions = {},
  ): VariableValue {
    const parsed: unknown = typeof variable === "string" ? JSON.parse(variable) : variable;
    let node: QxqyParamNode;
    if (isParamNode(parsed)) {
      node = clone(parsed);
    } else if (isStructNode(parsed)) {
      node = { param_type: "Struct", value: clone(parsed) };
    } else {
      throw new TypeError("Expected a Qianxing Struct node or Param node.");
    }

    const actualId = this.structIdOf(node);
    const definitionId = options.definitionId ?? actualId;
    const definition = definitionId ? this.#definitions.get(definitionId) : undefined;
    const expected: ValueDefinition = {
      type: definition ? "Struct" : undefined,
      structId: definitionId,
      name: definition?.name,
      defaultNode:
        definitionId && definition
          ? this.createDefaultParam("Struct", definitionId)
          : undefined,
    };
    normalizeNode(this, node, expected.defaultNode);
    return new VariableValue(this, node, expected, "$", true);
  }

  createDefault(structId: string): VariableValue {
    const definition = this.#definitions.get(String(structId));
    if (!definition) throw new Error(`Unknown struct definition: ${structId}`);
    return this.parse(this.createDefaultParam("Struct", String(structId)), {
      definitionId: String(structId),
    });
  }

  /** @internal */
  definitionRef(structId: string | undefined): StructDefinition | undefined {
    return structId ? this.#definitions.get(String(structId)) : undefined;
  }

  /** @internal */
  structIdOf(node: QxqyParamNode): string | undefined {
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
  createDefaultParam(type: ParamType, structId?: string): QxqyParamNode {
    if (type === "Struct") {
      if (!structId) throw new Error("A struct id is required for Struct defaults.");
      const definition = this.#definitions.get(String(structId));
      if (!definition) throw new Error(`Unknown struct definition: ${structId}`);
      const value: QxqyStructNode = {
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
      const value: QxqyDictNode = {
        type: "Dict",
        key_type: "String",
        value_type: "String",
        value: [],
      };
      return { param_type: "Dict", value };
    }
    if (type.endsWith("List")) return { param_type: type, value: [] };
    if (type === "Float") return { param_type: type, value: "0.00" };
    if (type === "Bool") return { param_type: type, value: "False" };
    if (type === "Vector3") return { param_type: type, value: "0,0,0" };
    if (type === "String") return { param_type: type, value: "" };
    return { param_type: type, value: "0" };
  }

  #assertDefinition(structId: string, value: unknown): asserts value is StructDefinition {
    if (
      !isRecord(value) ||
      typeof value.name !== "string" ||
      !Array.isArray(value.value)
    ) {
      throw new TypeError(`Invalid struct definition: ${structId}`);
    }
    for (const field of value.value) {
      if (
        !isRecord(field) ||
        typeof field.key !== "string" ||
        typeof field.param_type !== "string" ||
        !isParamNode(field.value)
      ) {
        throw new TypeError(`Invalid field in struct definition: ${structId}`);
      }
    }
  }
}
