import { describe, expect, it } from "vitest";
import { buildCycleClosingSummary } from "./cycleClosingSummary";

describe("cycle closing summary", () => {
  it("uses the selected manual range and the persisted card closing date", () => {
    const summary = buildCycleClosingSummary({
      cycleStartDate: "2026-08-05",
      cycleEndDate: "2026-09-04",
      baseIncome: 5_000,
      fixedTotal: 1_000,
      installmentsTotal: 300,
      expenses: [
        {
          amount: 100,
          category: "Mercado",
          paidBy: "Ana",
          date: "2026-08-29",
          invoiceClosingDate: "2026-09-04",
          invoiceDueDate: "2026-09-10",
        },
        {
          amount: 250,
          category: "Mercado",
          paidBy: "Ana",
          date: "2026-08-29",
          invoiceClosingDate: "2026-09-05",
          invoiceDueDate: "2026-09-10",
        },
      ],
      incomeEntries: [],
      nonVariableCategoryExpenses: [],
    });

    expect(summary.variableSpent).toBe(100);
    expect(summary.available).toBe(3_600);
  });

  it("recalculates extra income, categories and people for the chosen end date", () => {
    const summary = buildCycleClosingSummary({
      cycleStartDate: "2026-08-05",
      cycleEndDate: "2026-09-04",
      baseIncome: 4_000,
      fixedTotal: 800,
      installmentsTotal: 200,
      expenses: [
        { amount: 120, category: "Lazer", paidBy: "Bruno", date: "2026-08-10" },
        { amount: 80, category: "Lazer", paidBy: "Bruno", date: "2026-08-11" },
        { amount: 50, category: "Saúde", paidBy: "Clara", date: "2026-09-05" },
      ],
      incomeEntries: [
        { amount: 500, date: "2026-08-20" },
        { amount: 900, date: "2026-09-05" },
      ],
      nonVariableCategoryExpenses: [
        { category: "Moradia", amount: 800 },
        { category: "Parcelas", amount: 200 },
      ],
    });

    expect(summary.income).toBe(4_500);
    expect(summary.extraIncome).toBe(500);
    expect(summary.variableSpent).toBe(200);
    expect(summary.available).toBe(3_300);
    expect(summary.peopleTotals).toEqual([{ name: "Bruno", amount: 200 }]);
    expect(summary.categoryExpenses).toEqual([
      { category: "Lazer", amount: 120 },
      { category: "Lazer", amount: 80 },
      { category: "Moradia", amount: 800 },
      { category: "Parcelas", amount: 200 },
    ]);
  });
});
