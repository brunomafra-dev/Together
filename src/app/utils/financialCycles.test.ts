import { describe, expect, it } from "vitest";
import {
  addLocalMonths,
  daysBetweenLocalDates,
  defaultCycleEnd,
  getCreditCardBillingDates,
  getExpenseCycleDate,
  getExpenseEffectiveDate,
  isDateWithinCycle,
  nextLocalDate,
  openCycleReferenceEnd,
  parseLocalDate,
  previousLocalDate,
} from "./financialCycles";

describe("local financial dates", () => {
  it.each(["2024-02-29", "2025-01-31", "2000-02-29"])("parses %s", (date) => {
    expect(() => parseLocalDate(date)).not.toThrow();
  });

  it.each(["2023-02-29", "2025-13-01", "2025-01-00", "01/01/2025"])(
    "rejects invalid date %s",
    (date) => {
      expect(() => parseLocalDate(date)).toThrow(RangeError);
    },
  );

  it("crosses month and year boundaries without UTC conversion", () => {
    expect(nextLocalDate("2025-12-31")).toBe("2026-01-01");
    expect(previousLocalDate("2026-01-01")).toBe("2025-12-31");
  });

  it("adds calendar months and clamps shorter months", () => {
    expect(addLocalMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addLocalMonths("2025-01-31", 1)).toBe("2025-02-28");
    expect(addLocalMonths("2025-03-31", -1)).toBe("2025-02-28");
    expect(addLocalMonths("2025-05-31", 1)).toBe("2025-06-30");
  });

  it("counts whole calendar days", () => {
    expect(daysBetweenLocalDates("2025-10-01", "2025-11-01")).toBe(31);
  });
});

describe("manual financial cycles", () => {
  it("uses inclusive cycle bounds", () => {
    expect(isDateWithinCycle("2025-08-05", "2025-08-05", "2025-09-04")).toBe(true);
    expect(isDateWithinCycle("2025-09-04", "2025-08-05", "2025-09-04")).toBe(true);
    expect(isDateWithinCycle("2025-09-05", "2025-08-05", "2025-09-04")).toBe(false);
  });

  it("supports an open-ended cycle", () => {
    expect(isDateWithinCycle("2030-01-01", "2025-08-05", null)).toBe(true);
    expect(isDateWithinCycle("2025-08-04", "2025-08-05", null)).toBe(false);
  });

  it("rejects an inverted cycle", () => {
    expect(() => isDateWithinCycle("2025-08-05", "2025-09-05", "2025-09-04")).toThrow(RangeError);
  });

  it("keeps the normal monthly horizon while the cycle is on time", () => {
    expect(defaultCycleEnd("2025-08-05")).toBe("2025-09-04");
    expect(openCycleReferenceEnd("2025-08-05", "2025-08-20")).toBe("2025-09-04");
  });

  it("extends the horizon through today when manual closing is late", () => {
    expect(openCycleReferenceEnd("2025-08-05", "2025-09-10")).toBe("2025-09-10");
    expect(nextLocalDate(openCycleReferenceEnd("2025-08-05", "2025-09-10"))).toBe("2025-09-11");
  });
});

describe("credit-card invoices", () => {
  it.each([
    ["2026-08-28", 28, 5, "2026-08-28", "2026-09-05"],
    ["2026-08-29", 28, 5, "2026-09-28", "2026-10-05"],
    ["2026-08-10", 10, 18, "2026-08-10", "2026-08-18"],
    ["2026-08-11", 10, 18, "2026-09-10", "2026-09-18"],
    ["2028-02-29", 31, 5, "2028-02-29", "2028-03-05"],
    ["2026-08-20", 20, 2, "2026-08-20", "2026-09-02"],
    ["2026-08-20", 20, 25, "2026-08-20", "2026-08-25"],
  ])(
    "assigns purchase %s with closing day %i and due day %i",
    (purchaseDate, closingDay, dueDay, closingDate, dueDate) => {
      expect(getCreditCardBillingDates(purchaseDate, closingDay, dueDay)).toEqual({
        closingDate,
        dueDate,
      });
    },
  );

  it.each([0, 32, 2.5])("rejects invalid configured day %s", (day) => {
    expect(() => getCreditCardBillingDates("2026-08-01", day, 5)).toThrow(RangeError);
    expect(() => getCreditCardBillingDates("2026-08-01", 20, day)).toThrow(RangeError);
  });

  it("uses the statement closing date as the card purchase competence", () => {
    expect(
      getExpenseEffectiveDate("2026-08-29", {
        type: "credit_card",
        closingDay: 28,
        dueDay: 5,
      }),
    ).toBe("2026-09-28");
    expect(getExpenseEffectiveDate("2026-08-29", { type: "pix" })).toBe("2026-08-29");
    expect(
      getExpenseEffectiveDate("2026-08-29", {
        type: "credit_card",
        closingDay: 28,
        dueDay: null,
      }),
    ).toBe("2026-09-28");
    expect(
      getExpenseEffectiveDate("2026-08-29", {
        type: "credit_card",
        closingDay: null,
        dueDay: 5,
      }),
    ).toBe("2026-08-29");
  });

  it("uses a persisted closing date without replacing it with the due date", () => {
    expect(
      getExpenseCycleDate({
        date: "2026-08-28",
        invoiceClosingDate: "2026-09-26",
      }),
    ).toBe("2026-09-26");
    expect(getExpenseCycleDate({ date: "2026-08-28" })).toBe("2026-08-28");
  });

  it("moves a post-closing purchase only when its statement enters the active cycle", () => {
    const competenceDate = getExpenseCycleDate({
      date: "2026-08-28",
      invoiceClosingDate: "2026-09-26",
    });

    expect(isDateWithinCycle(competenceDate, "2026-08-01", "2026-08-31")).toBe(false);
    expect(isDateWithinCycle(competenceDate, "2026-08-28", "2026-09-27")).toBe(true);
  });
});
