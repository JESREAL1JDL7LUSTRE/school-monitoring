import { describe, expect, it } from "vitest";
import { recordId, recordSlug, withRouteQuery } from "../../src/lib/record-slug";

const id = "bafba5e6-ec98-4136-94e3-7016c07ae218";

describe("record links", () => {
  it("keeps the label readable and resolves the same record after a rename", () => {
    const original = recordSlug("ÉMP / 003", id);
    expect(original).toMatch(/^emp-003--[\w-]{22}$/);
    expect(original).not.toContain(id);
    expect(recordId(original)).toBe(id);
    expect(recordId(recordSlug("New code", id))).toBe(id);
    expect(recordId(id.toUpperCase())).toBe(id);
  });

  it("rejects malformed references and preserves the query on redirects", () => {
    expect(recordId("employees/invalid")).toBeUndefined();
    expect(recordId("employee--aa")).toBeUndefined();
    expect(recordId(["employee"])).toBeUndefined();
    expect(withRouteQuery("/employees/emp-003", { filter: ["a", "b"], ignored: undefined }))
      .toBe("/employees/emp-003?filter=a&filter=b");
  });
});
