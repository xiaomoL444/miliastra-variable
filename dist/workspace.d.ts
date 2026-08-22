import { StructValue } from "./struct-value.js";
import type { ParamType, QxqyParamNode, QxqyStructNode, RegisteredStructDefinition, StructDefinition } from "./types.js";
export type DefinitionCollection = Record<string, StructDefinition> | readonly RegisteredStructDefinition[];
export interface ParseOptions {
    /** Overrides the definition used for the root, useful when the variable id is damaged. */
    definitionId?: string;
}
export declare class StructWorkspace {
    #private;
    constructor(definitions?: DefinitionCollection);
    importDefinition(structId: string, definition: StructDefinition | string): this;
    importDefinitions(definitions: DefinitionCollection): this;
    removeDefinition(structId: string): boolean;
    hasDefinition(structId: string): boolean;
    getDefinition(structId: string): StructDefinition | undefined;
    get structIds(): readonly string[];
    parse(variable: QxqyStructNode | QxqyParamNode | string, options?: ParseOptions): StructValue;
    createDefault(structId: string): StructValue;
    /** @internal */
    definitionRef(structId: string | undefined): StructDefinition | undefined;
    /** @internal */
    structIdOf(node: QxqyParamNode): string | undefined;
    /** @internal */
    createDefaultParam(type: ParamType, structId?: string): QxqyParamNode;
}
//# sourceMappingURL=workspace.d.ts.map