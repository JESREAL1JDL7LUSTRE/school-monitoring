import { describe, expect, it } from "vitest";
import {
  addMonths, filterPersonnel, manilaDate, personnelFilterLabel, personnelMetrics, readPersonnelFilter,
  type PersonnelContext, type PersonnelSummary,
} from "../../src/modules/personnel/rules";

const context: PersonnelContext = {
  asOf: "2026-11-21", reportingYear: 2026, stepIntervalMonths: 36, retirementAge: 65,
  loyaltyFirstYears: 10, loyaltyIntervalYears: 5, salaryEstimatePercent: 3,
};
const employee: PersonnelSummary = {
  id: "fixture", employee_no: "EMP-001", full_name: "Maya Rivera", position: "Teacher II",
  employment_status: "Permanent", classification: "Teaching", date_of_birth: "1962-06-01",
  date_hired: "2016-12-01", initial_step_date: "2023-11-20",
  checklist_review_date: null, checklist_remarks: "", created_at: "", updated_at: "", archived_at: null,
  checklist_done: 3, checklist_total: 4, license_expiry: "2026-12-21", current_salary: null,
  step_date: "2023-11-20", nosi_status: "Not filed", nosi_updated_at: null, nosi_id: null, custody_quantity: 0,
};

describe("personnel date rules", () => {
  it("uses a Manila date across the UTC midnight boundary", () => {
    expect(manilaDate(new Date("2026-11-20T16:01:00Z"))).toBe("2026-11-21");
  });

  it("clamps calendar months to the last valid day", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
  });

  it("uses completed years for age and service and school settings for award years", () => {
    expect(personnelMetrics(employee, context)).toMatchObject({
      age: 64, yearsOfService: 9, loyaltyYear: 2026, loyaltyDate: "2026-12-01", retirementDate: "2027-06-01",
    });
    expect(personnelMetrics(employee, { ...context, loyaltyFirstYears: 15 }).loyaltyYear).toBe(2031);
    expect(personnelFilterLabel("l1", context)).toBe("Loyalty 2027");
  });
});

describe("shared staff filters", () => {
  it("distinguishes overdue, due today, and adjusted step records", () => {
    const due = { ...employee, id: "due", step_date: "2023-11-21" };
    const adjusted = { ...employee, id: "adjusted", nosi_status: "Adjusted in payslip" } as const;
    const list = [employee, due, adjusted];
    expect(filterPersonnel(list, "over", context)).toEqual([employee]);
    expect(filterPersonnel(list, "n1", context)).toEqual([due]);
    expect(filterPersonnel(list, "upd", context)).toEqual([adjusted]);
  });

  it("separates expired licenses and archived staff from actionable lists", () => {
    const archived = { ...employee, id: "archived", archived_at: "2026-11-05" };
    const expired = { ...employee, id: "expired", license_expiry: "2026-11-20" };
    expect(filterPersonnel([employee, archived, expired], "c1", context)).toEqual([employee]);
    expect(filterPersonnel([employee, archived, expired], "exp", context)).toEqual([expired]);
    expect(filterPersonnel([employee, archived, expired], "archived", context)).toEqual([archived]);
    expect(readPersonnelFilter("constructor")).toBe("all");
  });

  it("identifies not-started and complete 201 checklists", () => {
    const complete = { ...employee, checklist_done: 4 };
    const notStarted = { ...employee, checklist_done: 0 };
    expect(personnelMetrics(notStarted, context).checklistStatus).toBe("Not started");
    expect(filterPersonnel([employee, complete, notStarted], "inc", context)).toEqual([employee, notStarted]);
    expect(filterPersonnel([employee, complete, notStarted], "complete", context)).toEqual([complete]);
  });
});
