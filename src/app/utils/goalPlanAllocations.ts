export type GoalPlanAllocationMode = "percentage" | "fixed";

const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

export const roundCurrency = (value: number) => Math.round(nonNegative(value) * 100) / 100;

export function formatAllocationPercent(percent: number): string {
  const normalized = nonNegative(percent);
  const text = Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

export function resolveStoredAllocation(
  mode: GoalPlanAllocationMode,
  share: string,
  storedAmount: number,
  income: number,
): { mode: GoalPlanAllocationMode; percent: number; amount: number } {
  if (mode === "fixed") {
    const amount = roundCurrency(storedAmount);
    return {
      mode,
      amount,
      percent: income > 0 ? (amount / income) * 100 : 0,
    };
  }

  const percent = nonNegative(Number(share.replace("%", "")) || 0);
  return {
    mode,
    percent,
    amount: roundCurrency(income * (percent / 100)),
  };
}

export function allocationFromInput(
  mode: GoalPlanAllocationMode,
  value: number,
  income: number,
): { mode: GoalPlanAllocationMode; percent: number; amount: number } {
  const normalized = nonNegative(value);
  if (mode === "fixed") {
    const amount = roundCurrency(normalized);
    return { mode, amount, percent: income > 0 ? (amount / income) * 100 : 0 };
  }

  return {
    mode,
    percent: normalized,
    amount: roundCurrency(income * (normalized / 100)),
  };
}

export function allocationStorage(
  mode: GoalPlanAllocationMode,
  percent: number,
  amount: number,
): { allocationMode: GoalPlanAllocationMode; share: string; amount: number } {
  return mode === "fixed"
    ? { allocationMode: mode, share: "Valor fixo", amount: roundCurrency(amount) }
    : {
        allocationMode: mode,
        share: formatAllocationPercent(percent),
        amount: roundCurrency(amount),
      };
}
