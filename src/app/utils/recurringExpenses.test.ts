import { describe, expect, it } from "vitest";
import {
  recurringExpenseAppliesToCycle,
  selectCurrentRecurringExpenses,
} from "./recurringExpenses";

type ExpenseFixture = {
  id: string;
  category: string;
  description: string;
  date: string;
  createdAt?: string;
  amount: number;
  card: string | null;
  invoiceDueDate?: string | null;
  paidBy: string;
  recurringMonthly: boolean;
};

const expense = (changes: Partial<ExpenseFixture> = {}): ExpenseFixture => ({
  id: "expense-1",
  category: "subscriptions",
  description: "Netflix",
  date: "2026-01-10",
  amount: 39.9,
  card: "card-1",
  paidBy: "Bruno",
  recurringMonthly: true,
  ...changes,
});

describe("selectCurrentRecurringExpenses", () => {
  it("keeps only the newest version of a logical recurrence", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "march", date: "2026-03-10", amount: 49.9, card: "card-2" }),
      expense({ id: "february", date: "2026-02-10", amount: 44.9 }),
      expense({ id: "january" }),
    ]);

    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ id: "march", amount: 49.9, card: "card-2" });
  });

  it("normalizes case and repeated whitespace in descriptions", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "new", date: "2026-02-10", description: "  NETFLIX premium " }),
      expense({ id: "old", description: "netflix   PREMIUM" }),
    ]);

    expect(current.map((item) => item.id)).toEqual(["new"]);
  });

  it("uses the newest non-recurring row to deactivate older templates", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "stopped", date: "2026-02-10", recurringMonthly: false }),
      expense({ id: "old-active" }),
    ]);

    expect(current).toEqual([]);
  });

  it("does not infer recurrence from the subscriptions category", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "one-off", recurringMonthly: false }),
    ]);

    expect(current).toEqual([]);
  });

  it("keeps distinct descriptions and categories as separate recurrences", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "netflix" }),
      expense({ id: "spotify", description: "Spotify" }),
      expense({ id: "other-category", category: "leisure" }),
    ]);

    expect(current.map((item) => item.id).sort()).toEqual(
      ["netflix", "spotify", "other-category"].sort(),
    );
  });

  it("keeps blank-description legacy rows independent", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "legacy-1", description: "" }),
      expense({ id: "legacy-2", description: "  ", amount: 19.9 }),
    ]);

    expect(current.map((item) => item.id).sort()).toEqual(["legacy-1", "legacy-2"]);
  });

  it("uses createdAt to break purchase-date ties", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "older", createdAt: "2026-01-10T10:00:00Z" }),
      expense({ id: "newer", createdAt: "2026-01-10T11:00:00Z" }),
    ]);

    expect(current.map((item) => item.id)).toEqual(["newer"]);
  });

  it("uses id to break ties when creation timestamps are equal or absent", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "expense-a" }),
      expense({ id: "expense-b" }),
    ]);

    expect(current.map((item) => item.id)).toEqual(["expense-b"]);
  });

  it("preserves input order only for a fully exact version tie", () => {
    const current = selectCurrentRecurringExpenses([
      expense({ id: "same", amount: 49.9 }),
      expense({ id: "same", amount: 39.9 }),
    ]);

    expect(current).toHaveLength(1);
    expect(current[0].amount).toBe(49.9);
  });
});

describe("recurringExpenseAppliesToCycle", () => {
  it("starts a card recurrence in the cycle containing its invoice due date", () => {
    const template = expense({ date: "2026-08-29", invoiceDueDate: "2026-10-05" });

    expect(recurringExpenseAppliesToCycle(template, "2026-10-04")).toBe(false);
    expect(recurringExpenseAppliesToCycle(template, "2026-10-05")).toBe(true);
    expect(recurringExpenseAppliesToCycle(template, "2026-11-04")).toBe(true);
  });

  it("falls back to purchase date when no valid invoice date exists", () => {
    const template = expense({ date: "2026-03-29", invoiceDueDate: null });

    expect(recurringExpenseAppliesToCycle(template, "2026-03-28")).toBe(false);
    expect(recurringExpenseAppliesToCycle(template, "2026-03-29")).toBe(true);
    expect(recurringExpenseAppliesToCycle(template, "2026-04-28")).toBe(true);
  });
});
