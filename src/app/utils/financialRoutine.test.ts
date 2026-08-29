import { describe, expect, it } from "vitest";
import {
  openFinancialCycleReferenceEnd,
  plannedFinancialCycleEnd,
  projectedFinancialCycle,
  suggestedFinancialCycle,
  suggestedNextCycleStartForClosing,
} from "./financialRoutine";
import { getExpenseCycleDate, isDateWithinCycle } from "./financialCycles";

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

  it("transitions a legacy calendar cycle at the next configured close", () => {
    const routine = {
      incomeMode: "fixed" as const,
      primaryIncomeDay: 5,
      cycleMode: "payment_day" as const,
      cycleCloseDay: null,
    };

    expect(plannedFinancialCycleEnd("2026-08-01", routine)).toBe("2026-09-05");
    expect(suggestedNextCycleStartForClosing("2026-08-01", "2026-09-06", routine)).toBe(
      "2026-09-06",
    );
  });

  it("projects an unaligned future cycle with the same horizon used after opening it", () => {
    const projectedCycle = projectedFinancialCycle("2026-09-01", {
      incomeMode: "fixed",
      primaryIncomeDay: 5,
      cycleMode: "payment_day",
      cycleCloseDay: null,
    });

    expect(projectedCycle).toEqual({ startDate: "2026-09-01", endDate: "2026-10-05" });
    expect(
      isDateWithinCycle(
        getExpenseCycleDate({
          date: "2026-08-29",
          invoiceClosingDate: "2026-09-26",
        }),
        projectedCycle.startDate,
        projectedCycle.endDate,
      ),
    ).toBe(true);
  });

  it("keeps the configured closing day when the projected cycle is aligned", () => {
    expect(
      projectedFinancialCycle("2026-09-06", {
        incomeMode: "fixed",
        primaryIncomeDay: 5,
        cycleMode: "payment_day",
        cycleCloseDay: null,
      }),
    ).toEqual({ startDate: "2026-09-06", endDate: "2026-10-05" });
  });

  it.each([
    ["2026-01-01", "2026-01-31"],
    ["2026-02-01", "2026-02-28"],
    ["2028-02-01", "2028-02-29"],
    ["2026-04-01", "2026-04-30"],
  ])("clamps a day-31 routine to the real end of the month", (startDate, endDate) => {
    expect(
      projectedFinancialCycle(startDate, {
        incomeMode: "fixed",
        primaryIncomeDay: null,
        cycleMode: "custom_day",
        cycleCloseDay: 31,
      }),
    ).toEqual({ startDate, endDate });
  });
});
