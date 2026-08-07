import { isLocalDateString } from "./financialCycles";

export interface RecurringExpenseLike {
  id: string;
  category: string;
  description: string;
  date: string;
  createdAt?: string;
  card?: string | null;
  invoiceDueDate?: string | null;
  paidBy?: string;
  recurringMonthly?: boolean;
}

const normalizeRecurrencePart = (value: string) =>
  value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

/**
 * Named recurrences are matched by category and description so changes to
 * amount, card or responsible person replace the previous template. Blank
 * legacy descriptions stay independent because merging them would risk
 * treating unrelated expenses as the same recurrence.
 */
export function recurringExpenseKey(expense: RecurringExpenseLike): string {
  const description = normalizeRecurrencePart(expense.description);
  if (!description) return `legacy:${expense.id}`;

  return `named:${normalizeRecurrencePart(expense.category)}:${description}`;
}

function compareRecurringExpenseVersions(
  left: RecurringExpenseLike,
  right: RecurringExpenseLike,
): number {
  const dateComparison = left.date.localeCompare(right.date);
  if (dateComparison !== 0) return dateComparison;

  const createdAtComparison = (left.createdAt ?? "").localeCompare(right.createdAt ?? "");
  if (createdAtComparison !== 0) return createdAtComparison;

  return left.id.localeCompare(right.id);
}

/**
 * Returns the most recent state of each logical recurrence, provided that its
 * latest state is still marked as recurring. Versions are ordered by purchase
 * date, creation timestamp and id; input order only wins a fully exact tie.
 */
export function selectCurrentRecurringExpenses<T extends RecurringExpenseLike>(
  expenses: readonly T[],
): T[] {
  const latestByKey = new Map<string, { expense: T; inputIndex: number }>();

  expenses.forEach((expense, inputIndex) => {
    const key = recurringExpenseKey(expense);
    const current = latestByKey.get(key);

    if (!current || compareRecurringExpenseVersions(expense, current.expense) > 0) {
      latestByKey.set(key, { expense, inputIndex });
    }
  });

  return Array.from(latestByKey.values())
    .filter(({ expense }) => Boolean(expense.recurringMonthly))
    .sort(
      (left, right) =>
        compareRecurringExpenseVersions(right.expense, left.expense) ||
        left.inputIndex - right.inputIndex,
    )
    .map(({ expense }) => expense);
}

/**
 * A recurring template starts in the first cycle whose end reaches its
 * effective date. Credit-card expenses use their frozen invoice due date.
 */
export function recurringExpenseAppliesToCycle(
  expense: Pick<RecurringExpenseLike, "date" | "invoiceDueDate">,
  cycleEndDate: string,
): boolean {
  const effectiveDate = isLocalDateString(expense.invoiceDueDate)
    ? expense.invoiceDueDate
    : expense.date;
  return effectiveDate <= cycleEndDate;
}
