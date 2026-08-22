import type { VariableWorkspace } from "./workspace.js";
import type { ParamType, QxqyParamNode, VariableClipboardData, VariableIssue } from "./types.js";
/** @internal */
export interface ValueDefinition {
    type?: ParamType;
    structId?: string;
    name?: string;
    defaultNode?: QxqyParamNode;
}
export declare class VariableValue {
    #private;
    readonly workspace: VariableWorkspace;
    private readonly node;
    private readonly definition;
    readonly path: string;
    private readonly root;
    constructor(workspace: VariableWorkspace, node: QxqyParamNode, definition?: ValueDefinition, path?: string, root?: boolean);
    get type(): ParamType;
    get defineType(): ParamType | undefined;
    /** Field name for members, or the struct type name for struct roots/elements. */
    get name(): string | undefined;
    get structId(): string | undefined;
    get defineStructId(): string | undefined;
    get presence(): import("./types.js").VariableValuePresence;
    get isMissing(): boolean;
    get isExtra(): boolean;
    get isTypeMatch(): boolean;
    get value(): any;
    /** Replaces only the raw value while keeping the node's current type. */
    setValue(value: unknown): this;
    /** Returns an isolated, JSON-safe clipboard payload. */
    copy(): VariableClipboardData;
    canPaste(data: VariableClipboardData): boolean;
    /** Pastes an isolated copy and returns false without mutation when types differ. */
    paste(data: VariableClipboardData): boolean;
    /** Restores the definition's exported default. Returns false if none is available. */
    reset(): boolean;
    /** The original Qianxing parameter-node representation. */
    toParamNode(): QxqyParamNode;
    /** The importable Qianxing value; for a parsed root this is the Struct node. */
    toQxqyValue(): unknown;
    serialize(space?: number): string;
    toJSON(): unknown;
    get issues(): readonly VariableIssue[];
    get warnings(): readonly VariableIssue[];
}
//# sourceMappingURL=variable-value.d.ts.map