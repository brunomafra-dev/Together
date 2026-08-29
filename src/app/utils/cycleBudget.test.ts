import { describe, expect, it } from "vitest";
import { summarizeCycleBudget } from "./cycleBudget";

describe("cycle budget summary", () => {
  it("matches the Dashboard balance for the reported next-cycle values", () => {
    const summary = summarizeCycleBudget({
      baseIncome: 8070,
      extraIncome: 0,
      fixedExpenses: 3598.27,
      commitments: 0,
      recordedExpenses: 1369.99,
    });

    expect(summary.recordedTotal).toBeCloseTo(4968.26, 2);
    expect(summary.availableNow).toBeCloseTo(3101.74, 2);
  });

  it("keeps unposted recurrence estimates separate from the Dashboard balance", () => {
    const summary = summarizeCycleBudget({
      baseIncome: 5000,
      extraIncome: 500,
      fixedExpenses: 1800,
      commitments: 400,
      recordedExpenses: 900,
      recurringReservations: 250,
    });

    expect(summary.availableNow).toBe(2400);
    expect(summary.availableAfterReservations).toBe(2150);
  });
});
