import { isDateWithinCycle, isLocalDateString } from "./financialCycles";

export interface CycleClosingExpense {
  amount: number;
  category: string;
  paidBy: string;
  date: string;
  invoiceDueDate?: string | null;
}

export interface CycleClosingIncome {
  amount: number;
  date: string;
}

export interface CycleClosingSummaryInput {
  cycleStartDate: string;
  cycleEndDate: string;
  baseIncome: number;
  fixedTotal: number;
  installmentsTotal: number;
  expenses: CycleClosingExpense[];
  incomeEntries: CycleClosingIncome[];
  nonVariableCategoryExpenses: Array<{ category: string; amount: number }>;
}

export function buildCycleClosingSummary(input: CycleClosingSummaryInput) {
  const selectedExpenses = input.expenses.filter((expense) => {
    const effectiveDate = isLocalDateString(expense.invoiceDueDate)
      ? expense.invoiceDueDate
      : expense.date;
    return isDateWithinCycle(effectiveDate, input.cycleStartDate, input.cycleEndDate);
  });
  const selectedIncomeEntries = input.incomeEntries.filter((entry) =>
    isDateWithinCycle(entry.date, input.cycleStartDate, input.cycleEndDate),
  );
  const variableSpent = selectedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const extraIncome = selectedIncomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const income = input.baseIncome + extraIncome;
  const categoryExpenses = [
    ...selectedExpenses.map((expense) => ({
      category: expense.category,
      amount: expense.amount,
    })),
    ...input.nonVariableCategoryExpenses,
  ];
  const peopleTotals = Array.from(
    selectedExpenses.reduce((totals, expense) => {
      totals.set(expense.paidBy, (totals.get(expense.paidBy) || 0) + expense.amount);
      return totals;
    }, new Map<string, number>()),
  )
    .map(([name, amount]) => ({ name, amount }))
    .sort((left, right) => right.amount - left.amount);

  return {
    income,
    extraIncome,
    variableSpent,
    available: income - input.fixedTotal - input.installmentsTotal - variableSpent,
    categoryExpenses,
    peopleTotals,
  };
}
