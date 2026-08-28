import { describe, expect, it } from "vitest";
import { suggestedFinancialCycle } from "./financialRoutine";

describe("suggested financial routine", () => {
  it("labels a day-5 cycle by the month in which it starts", () => {
    expect(
      suggestedFinancialCycle("2026-08-28", {
        incomeMode: "fixed",
        primaryIncomeDay: 5,
        cycleMode: "payment_day",
        cycleCloseDay: null,
      }),
    ).toEqual({
      startDate: "2026-08-06",
      endDate: "2026-09-05",
      labelDate: "2026-08-06",
    });
  });

  it("supports a custom closing day for autonomous households", () => {
    expect(
      suggestedFinancialCycle("2026-08-10", {
        incomeMode: "variable",
        primaryIncomeDay: null,
        cycleMode: "custom_day",
        cycleCloseDay: 15,
      })?.endDate,
    ).toBe("2026-08-15");
  });

  it("does not invent dates for manual cycles", () => {
    expect(
      suggestedFinancialCycle("2026-08-10", {
        incomeMode: "variable",
        primaryIncomeDay: null,
        cycleMode: "manual",
        cycleCloseDay: null,
      }),
    ).toBeNull();
  });
});
