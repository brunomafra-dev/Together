export interface CycleBudgetInput {
  baseIncome: number;
  extraIncome: number;
  fixedExpenses: number;
  commitments: number;
  recordedExpenses: number;
  recurringReservations?: number;
}

export interface CycleBudgetSummary {
  income: number;
  fixedAndCommitments: number;
  recordedTotal: number;
  projectedTotal: number;
  availableNow: number;
  availableAfterReservations: number;
}

/**
 * Single arithmetic contract shared by the active Dashboard and future-cycle
 * preview. Reservations are kept separate because they are estimates until a
 * recurring purchase is actually posted.
 */
export function summarizeCycleBudget(input: CycleBudgetInput): CycleBudgetSummary {
  const income = input.baseIncome + input.extraIncome;
  const fixedAndCommitments = input.fixedExpenses + input.commitments;
  const recordedTotal = fixedAndCommitments + input.recordedExpenses;
  const projectedTotal = recordedTotal + (input.recurringReservations ?? 0);

  return {
    income,
    fixedAndCommitments,
    recordedTotal,
    projectedTotal,
    availableNow: income - recordedTotal,
    availableAfterReservations: income - projectedTotal,
  };
}
