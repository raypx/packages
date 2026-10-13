import { describe, expect, it } from "vite-plus/test";
import { summarizePlan } from "./summary.js";
import { DrizzleDiagnosticError } from "./types.js";

const plan = () => [
  {
    Plan: {
      "Node Type": "Limit",
      "Total Cost": 18.7,
      "Plan Rows": 2,
      "Actual Rows": 1,
      "Actual Total Time": 0.42,
      "Actual Loops": 1,
      "Shared Hit Blocks": 3,
      "Shared Read Blocks": 1,
      Output: ["private-account-secret"],
      Plans: [
        {
          "Node Type": "Index Scan",
          "Relation Name": "cloud_runs",
          "Index Name": "cloud_runs_status_created_idx",
          "Total Cost": 18.7,
          "Plan Rows": 2,
          "Actual Rows": 1,
          "Actual Total Time": 0.4,
          "Actual Loops": 1,
          "Index Cond": "owner_account_id = 'private-account-secret'::text",
          Filter: "secret = 'private-account-secret'",
        },
      ],
    },
    "Planning Time": 0.12,
    "Execution Time": 0.5,
    "Query Identifier": "private-account-secret",
  },
];

describe("database plan summaries", () => {
  it("returns only node structure and estimates for planning mode", () => {
    const summary = summarizePlan(plan(), {});
    expect(summary).toEqual({
      analyze: false,
      planCost: 18.7,
      planRows: 2,
      nodes: [
        { depth: 0, nodeType: "Limit", planCost: 18.7, planRows: 2 },
        {
          depth: 1,
          nodeType: "Index Scan",
          planCost: 18.7,
          planRows: 2,
          relation: "cloud_runs",
          index: "cloud_runs_status_created_idx",
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("private-account-secret");
  });

  it("adds actual execution and optional buffer metrics only after explicit analyze", () => {
    const analyzed = summarizePlan(plan(), { analyze: true });
    expect(analyzed).toMatchObject({ planningTimeMs: 0.12, executionTimeMs: 0.5 });
    expect(analyzed.nodes[0]).toMatchObject({
      actualRows: 1,
      actualTotalTimeMs: 0.42,
      actualLoops: 1,
    });
    expect(analyzed.nodes[0]).not.toHaveProperty("sharedHitBlocks");
    const buffered = summarizePlan(plan(), { analyze: true, buffers: true });
    expect(buffered.nodes[0]).toMatchObject({ sharedHitBlocks: 3, sharedReadBlocks: 1 });
    expect(JSON.stringify(buffered)).not.toContain("private-account-secret");
  });

  it("filters unknown node text and malformed relation/index names", () => {
    expect(
      summarizePlan(
        [
          {
            Plan: {
              "Node Type": "secret = 'private-account-secret'",
              "Relation Name": "cloud_runs WHERE secret = 'private-account-secret'",
              "Index Name": "idx\nprivate-account-secret",
              "Total Cost": 0,
              "Plan Rows": 0,
            },
          },
        ],
        {},
      ).nodes,
    ).toEqual([{ depth: 0, nodeType: "Other", planCost: 0, planRows: 0 }]);
  });

  it.each([
    null,
    [],
    [{ Plan: null }],
    [{ Plan: { "Total Cost": "1", "Plan Rows": 1 } }],
    [{ Plan: { "Total Cost": Infinity, "Plan Rows": 1 } }],
    [{ Plan: { "Total Cost": 1, "Plan Rows": -1 } }],
    [{ Plan: { "Total Cost": 1, "Plan Rows": 1, Plans: "private-account-secret" } }],
  ])("rejects malformed plans without returning driver content: %j", (raw) => {
    expect(() => summarizePlan(raw, {})).toThrow(new DrizzleDiagnosticError("INVALID_PLAN"));
  });
});
