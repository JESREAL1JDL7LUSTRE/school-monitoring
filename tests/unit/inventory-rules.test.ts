import { describe, expect, it } from "vitest";
import { classifyItem } from "../../src/modules/inventory/rules";

describe("inventory forms", () => {
  const rules = { ppe_threshold: 50000, semi_expendable_threshold: 5000 };
  it("uses RIS for consumables and PAR for buildings", () => {
    expect(classifyItem({ unit_cost: 60000 }, "supplies", rules).form).toBe("RIS");
    expect(classifyItem({ unit_cost: 50 }, "building", rules).form).toBe("PAR");
  });

  it("selects the form and label at configurable thresholds", () => {
    expect(classifyItem({ unit_cost: 50000 }, "equipment", rules).form).toBe("PAR");
    expect(classifyItem({ unit_cost: 49999 }, "equipment", rules)).toEqual({ form: "ICS", label: "High-value semi-expendable" });
    expect(classifyItem({ unit_cost: 5000 }, "equipment", rules)).toEqual({ form: "ICS", label: "Low-value semi-expendable" });
    expect(classifyItem({ unit_cost: 1000 }, "equipment", { ...rules, ppe_threshold: 1000 }).form).toBe("PAR");
  });
});
