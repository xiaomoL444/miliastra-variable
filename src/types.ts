export type KnownParamType =
  | "String"
  | "StringList"
  | "Int32"
  | "Int32List"
  | "Float"
  | "FloatList"
  | "Bool"
  | "BoolList"
  | "Vector3"
  | "Vector3List"
  | "Entity"
  | "EntityList"
  | "Guid"
  | "GuidList"
  | "ConfigReference"
  | "ConfigReferenceList"
  | "EntityReference"
  | "EntityReferenceList"
  | "Army"
  | "ArmyList"
  | "Struct"
  | "StructList"
  | "Dict";

/** Known types are suggested by editors while unknown future types remain accepted. */
export type ParamType = KnownParamType | (string & {});

export interface QxqyParamNode<T = unknown> {
  param_type: ParamType;
  value: T;
}

export interface QxqyStructNode {
  structId: string;
  type: "Struct";
  value: QxqyParamNode[];
}

export interface QxqyStructListNode {
  structId: string;
  value: QxqyParamNode<QxqyStructNode>[];
}

export interface QxqyDictEntry {
  key: QxqyParamNode;
  value: QxqyParamNode;
}

export interface QxqyDictNode {
  type: "Dict";
  key_type: ParamType;
  value_type: ParamType;
  value: QxqyDictEntry[];
  value_structId?: string;
}

export interface StructFieldDefinition {
  key: string;
  param_type: ParamType;
  value: QxqyParamNode;
}

export interface StructDefinition {
  type: "Struct" | string;
  /** The editor export currently spells this property `struct_ype`. */
  struct_ype?: string;
  name: string;
  value: StructFieldDefinition[];
}

export interface RegisteredStructDefinition {
  structId: string;
  structDefinition: StructDefinition;
}

export interface VariableClipboardData {
  format: "miliastra-variable/clipboard@1";
  node: QxqyParamNode;
}

export type VariableValuePresence = "present" | "missing" | "extra";

export type VariableIssueKind =
  | "type-mismatch"
  | "struct-id-mismatch"
  | "missing-field"
  | "extra-field";

export interface VariableIssue {
  kind: VariableIssueKind;
  message: string;
  path: string;
  type: ParamType;
  defineType?: ParamType;
  structId?: string;
  defineStructId?: string;
}

export type VariableObjectValue = Record<string, import("./variable-value.js").VariableValue>;

export interface VariableDictEntryValue {
  key: import("./variable-value.js").VariableValue;
  value: import("./variable-value.js").VariableValue;
}

export type VariableValueData =
  | unknown
  | VariableObjectValue
  | import("./variable-value.js").VariableValue[]
  | VariableDictEntryValue[];
