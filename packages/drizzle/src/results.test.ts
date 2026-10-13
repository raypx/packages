import { describe, expect, it } from "vite-plus/test";
import { first, inserted } from "./results.js";

describe("query result unwrapping", () => {
  it("keeps an absent nullable result distinct from a required write result", async () => {
    expect(await first(Promise.resolve([]))).toBeNull();
    await expect(inserted(Promise.resolve([]), "Insert record")).rejects.toThrow(
      "Insert record did not return a row.",
    );
  });
  it("returns the first actual row and propagates query failures unchanged", async () => {
    const row = { id: "first" };
    expect(await inserted(Promise.resolve([row, { id: "second" }]), "Insert")).toBe(row);
    const error = new Error("Database operation failed");
    await expect(first(Promise.reject(error))).rejects.toBe(error);
  });
});
