import type { StructWorkspace } from "./workspace.js";
import type { QxqyParamNode, StructValuePresence } from "./types.js";
export declare function getPresence(node: QxqyParamNode): StructValuePresence;
export declare function setPresence(node: QxqyParamNode, value: StructValuePresence): void;
/**
 * Completes definition fields without mutating the caller's source object.
 * Fields are positional in Qianxing JSON, so only tail additions/removals are
 * unambiguous. Lists and dictionary entry counts are variable by definition.
 */
export declare function normalizeNode(workspace: StructWorkspace, node: QxqyParamNode, expected?: QxqyParamNode): void;
//# sourceMappingURL=normalization.d.ts.map