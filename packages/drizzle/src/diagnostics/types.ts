export interface ExplainOptions {
  analyze?: boolean;
  buffers?: boolean;
}

export interface PlanNode {
  depth: number;
  nodeType: string;
  planCost: number;
  planRows: number;
  relation?: string;
  index?: string;
  actualRows?: number;
  actualTotalTimeMs?: number;
  actualLoops?: number;
  sharedHitBlocks?: number;
  sharedReadBlocks?: number;
}

/** No SQL, parameters, predicates, query inputs or raw plans cross this boundary. */
export interface PlanSummary {
  analyze: boolean;
  planCost: number;
  planRows: number;
  nodes: PlanNode[];
  planningTimeMs?: number;
  executionTimeMs?: number;
}

export class DrizzleDiagnosticError extends Error {
  constructor(readonly code: "INVALID_OPTIONS" | "INVALID_PLAN") {
    super(
      code === "INVALID_OPTIONS"
        ? "Invalid PostgreSQL EXPLAIN options."
        : "Invalid PostgreSQL diagnostic plan.",
    );
    this.name = "DrizzleDiagnosticError";
  }
}
