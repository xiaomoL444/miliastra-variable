import type { VariableWorkspace } from "./workspace.js";
import type { QxqyParamNode, VariableValuePresence } from "./types.js";
export declare function getPresence(node: QxqyParamNode): VariableValuePresence;
export declare function setPresence(node: QxqyParamNode, value: VariableValuePresence): void;
/**
 * Completes definition fields without mutating the caller's source object.
 * Fields are positional in Qianxing JSON, so only tail additions/removals are
 * unambiguous. Lists and dictionary entry counts are variable by definition.
 */
export declare function normalizeNode(workspace: VariableWorkspace, node: QxqyParamNode, expected?: QxqyParamNode): void;
//# sourceMappingURL=normalization.d.ts.map