import { describe, expect, it } from "vitest";
import {
  openFinancialCycleReferenceEnd,
  plannedFinancialCycleEnd,
  projectedFinancialCycle,
  suggestedFinancialCycle,
  suggestedNextCycleStartForClosing,
} from "./financialRoutine";

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

  it("uses the configured closing day for an aligned active cycle", () => {
    const routine = {
      incomeMode: "fixed" as const,
      primaryIncomeDay: 5,
      cycleMode: "payment_day" as const,
      cycleCloseDay: null,
    };

    expect(plannedFinancialCycleEnd("2026-08-06", routine)).toBe("2026-09-05");
    expect(openFinancialCycleReferenceEnd("2026-08-06", "2026-08-28", routine)).toBe("2026-09-05");
    expect(suggestedNextCycleStartForClosing("2026-08-06", "2026-09-06", routine)).toBe(
      "2026-09-06",
    );
  });

  it("preserves legacy unaligned cycles until the user closes them", () => {
    const routine = {
      incomeMode: "fixed" as const,
      primaryIncomeDay: 5,
      cycleMode: "payment_day" as const,
      cycleCloseDay: null,
    };

    expect(plannedFinancialCycleEnd("2026-08-01", routine)).toBe("2026-08-31");
    expect(suggestedNextCycleStartForClosing("2026-08-01", "2026-09-06", routine)).toBeNull();
  });

  it("projects a partial future range up to the next configured closing day", () => {
    expect(
      projectedFinancialCycle("2026-09-11", {
        incomeMode: "fixed",
        primaryIncomeDay: 5,
        cycleMode: "payment_day",
        cycleCloseDay: null,
      }),
    ).toEqual({ startDate: "2026-09-11", endDate: "2026-10-05" });
  });
});
