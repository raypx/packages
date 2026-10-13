import {
  DrizzleDiagnosticError,
  type PlanNode,
  type ExplainOptions,
  type PlanSummary,
} from "./types.js";

const nodeTypes = new Set([
  "Aggregate",
  "Append",
  "BitmapAnd",
  "BitmapOr",
  "Bitmap Heap Scan",
  "Bitmap Index Scan",
  "CTE Scan",
  "Custom Scan",
  "Foreign Scan",
  "Function Scan",
  "Gather",
  "Gather Merge",
  "Group",
  "Hash",
  "Hash Join",
  "Incremental Sort",
  "Index Only Scan",
  "Index Scan",
  "Limit",
  "LockRows",
  "Materialize",
  "Memoize",
  "Merge Append",
  "Merge Join",
  "Named Tuplestore Scan",
  "Nested Loop",
  "ProjectSet",
  "Recursive Union",
  "Result",
  "Sample Scan",
  "Seq Scan",
  "SetOp",
  "Sort",
  "Subquery Scan",
  "Table Function Scan",
  "Tid Range Scan",
  "Tid Scan",
  "Unique",
  "Values Scan",
  "WindowAgg",
  "WorkTable Scan",
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DrizzleDiagnosticError("INVALID_PLAN");
  return value as Record<string, unknown>;
}

function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new DrizzleDiagnosticError("INVALID_PLAN");
  return value;
}

function identifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_$]{0,127}$/.test(value)
    ? value
    : undefined;
}

/** Copy an allowlist, never serialize the driver plan or its predicate strings. */
export function summarizePlan(raw: unknown, request: ExplainOptions = {}): PlanSummary {
  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request) ||
    Object.keys(request).some((key) => key !== "analyze" && key !== "buffers") ||
    [request.analyze, request.buffers].some(
      (value) => value !== undefined && typeof value !== "boolean",
    ) ||
    (request.buffers && !request.analyze)
  )
    throw new DrizzleDiagnosticError("INVALID_OPTIONS");
  if (!Array.isArray(raw) || raw.length !== 1) throw new DrizzleDiagnosticError("INVALID_PLAN");
  const document = record(raw[0]);
  const root = record(document.Plan);
  const analyze = request.analyze ?? false;
  const nodes: PlanNode[] = [];
  const pending = [{ plan: root, depth: 0 }];
  const seen = new Set<Record<string, unknown>>();
  while (pending.length) {
    const { plan, depth } = pending.pop()!;
    if (seen.has(plan) || nodes.length >= 1_000) throw new DrizzleDiagnosticError("INVALID_PLAN");
    seen.add(plan);
    const relation = identifier(plan["Relation Name"]);
    const index = identifier(plan["Index Name"]);
    const nodeType = plan["Node Type"];
    const node: PlanNode = {
      depth,
      nodeType: typeof nodeType === "string" && nodeTypes.has(nodeType) ? nodeType : "Other",
      planCost: number(plan["Total Cost"]),
      planRows: number(plan["Plan Rows"]),
      ...(relation ? { relation } : {}),
      ...(index ? { index } : {}),
    };
    if (analyze) {
      node.actualRows = number(plan["Actual Rows"]);
      node.actualTotalTimeMs = number(plan["Actual Total Time"]);
      node.actualLoops = number(plan["Actual Loops"]);
      if (request.buffers) {
        if (plan["Shared Hit Blocks"] !== undefined)
          node.sharedHitBlocks = number(plan["Shared Hit Blocks"]);
        if (plan["Shared Read Blocks"] !== undefined)
          node.sharedReadBlocks = number(plan["Shared Read Blocks"]);
      }
    }
    nodes.push(node);
    if (plan.Plans !== undefined) {
      if (!Array.isArray(plan.Plans)) throw new DrizzleDiagnosticError("INVALID_PLAN");
      for (const child of [...plan.Plans].reverse())
        pending.push({ plan: record(child), depth: depth + 1 });
    }
  }
  return {
    analyze,
    planCost: number(root["Total Cost"]),
    planRows: number(root["Plan Rows"]),
    nodes,
    ...(analyze && document["Planning Time"] !== undefined
      ? { planningTimeMs: number(document["Planning Time"]) }
      : {}),
    ...(analyze && document["Execution Time"] !== undefined
      ? { executionTimeMs: number(document["Execution Time"]) }
      : {}),
  };
}
