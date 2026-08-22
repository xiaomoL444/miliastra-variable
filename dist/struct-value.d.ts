import type { StructWorkspace } from "./workspace.js";
import type { ParamType, QxqyParamNode, StructClipboardData, StructTypeIssue } from "./types.js";
/** @internal */
export interface ValueDefinition {
    type?: ParamType;
    structId?: string;
    name?: string;
    defaultNode?: QxqyParamNode;
}
export declare class StructValue {
    #private;
    readonly workspace: StructWorkspace;
    private readonly node;
    private readonly definition;
    readonly path: string;
    private readonly root;
    constructor(workspace: StructWorkspace, node: QxqyParamNode, definition?: ValueDefinition, path?: string, root?: boolean);
    get type(): ParamType;
    get defineType(): ParamType | undefined;
    /** Field name for members, or the struct type name for struct roots/elements. */
    get name(): string | undefined;
    get structId(): string | undefined;
    get defineStructId(): string | undefined;
    get presence(): import("./types.js").StructValuePresence;
    get isMissing(): boolean;
    get isExtra(): boolean;
    get isTypeMatch(): boolean;
    get value(): any;
    /** Replaces only the raw value while keeping the node's current type. */
    setValue(value: unknown): this;
    /** Returns an isolated, JSON-safe clipboard payload. */
    copy(): StructClipboardData;
    canPaste(data: StructClipboardData): boolean;
    /** Pastes an isolated copy and returns false without mutation when types differ. */
    paste(data: StructClipboardData): boolean;
    /** Restores the definition's exported default. Returns false if none is available. */
    reset(): boolean;
    /** The original Qianxing parameter-node representation. */
    toParamNode(): QxqyParamNode;
    /** The importable Qianxing value; for a parsed root this is the Struct node. */
    toQxqyValue(): unknown;
    serialize(space?: number): string;
    toJSON(): unknown;
    get issues(): readonly StructTypeIssue[];
    get warnings(): readonly StructTypeIssue[];
}
//# sourceMappingURL=struct-value.d.ts.map