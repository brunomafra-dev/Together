import type { FinancialRoutine } from "../../services/financeService";
import {
  defaultCycleEnd,
  formatLocalDate,
  nextLocalDate,
  openCycleReferenceEnd,
  parseLocalDate,
  previousLocalDate,
} from "./financialCycles";

export const INCOME_MODE_LABELS: Record<FinancialRoutine["incomeMode"], string> = {
  fixed: "Salário ou renda fixa",
  variable: "Renda variável/autônoma",
  mixed: "Renda fixa + extras",
};

export const CYCLE_MODE_LABELS: Record<FinancialRoutine["cycleMode"], string> = {
  payment_day: "Virada pelo dia do pagamento",
  custom_day: "Virada em outro dia",
  manual: "Eu decido quando fechar",
};

export function routineCloseDay(routine: FinancialRoutine): number | null {
  if (routine.cycleMode === "manual") return null;
  return routine.cycleMode === "payment_day" ? routine.primaryIncomeDay : routine.cycleCloseDay;
}

const closeDateInMonth = (year: number, monthIndex: number, day: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
};

export function suggestedFinancialCycle(
  referenceDate: string,
  routine: FinancialRoutine,
): { startDate: string; endDate: string; labelDate: string } | null {
  const closeDay = routineCloseDay(routine);
  if (closeDay === null) return null;

  const reference = parseLocalDate(referenceDate);
  let end = closeDateInMonth(reference.getFullYear(), reference.getMonth(), closeDay);
  if (reference > end) {
    end = closeDateInMonth(reference.getFullYear(), reference.getMonth() + 1, closeDay);
  }
  const previousMonth = new Date(end.getFullYear(), end.getMonth() - 1, 1);
  const previousEnd = closeDateInMonth(
    previousMonth.getFullYear(),
    previousMonth.getMonth(),
    closeDay,
  );
  const startDate = nextLocalDate(formatLocalDate(previousEnd));

  return {
    startDate,
    endDate: formatLocalDate(end),
    labelDate: formatLocalDate(parseLocalDate(startDate)),
  };
}

export function nextSuggestedCycleStart(
  referenceDate: string,
  routine: FinancialRoutine,
): string | null {
  const cycle = suggestedFinancialCycle(referenceDate, routine);
  return cycle ? nextLocalDate(cycle.endDate) : null;
}

export function previousSuggestedCycleEnd(
  referenceDate: string,
  routine: FinancialRoutine,
): string | null {
  const cycle = suggestedFinancialCycle(referenceDate, routine);
  return cycle ? previousLocalDate(cycle.startDate) : null;
}

export function isRoutineCycleStart(startDate: string, routine: FinancialRoutine): boolean {
  const cycle = suggestedFinancialCycle(startDate, routine);
  return cycle?.startDate === startDate;
}

export function plannedFinancialCycleEnd(startDate: string, routine: FinancialRoutine): string {
  if (routine.cycleMode === "manual") return defaultCycleEnd(startDate);
  const cycle = suggestedFinancialCycle(startDate, routine);
  return cycle?.startDate === startDate ? cycle.endDate : defaultCycleEnd(startDate);
}

export function openFinancialCycleReferenceEnd(
  startDate: string,
  today: string,
  routine: FinancialRoutine,
): string {
  if (routine.cycleMode === "manual") return openCycleReferenceEnd(startDate, today);
  const plannedEnd = plannedFinancialCycleEnd(startDate, routine);
  return today > plannedEnd ? today : plannedEnd;
}

export function projectedFinancialCycle(
  startDate: string,
  routine: FinancialRoutine,
): { startDate: string; endDate: string } {
  if (routine.cycleMode === "manual") {
    return { startDate, endDate: defaultCycleEnd(startDate) };
  }
  const scheduled = suggestedFinancialCycle(startDate, routine);
  return {
    startDate,
    endDate: scheduled?.endDate ?? defaultCycleEnd(startDate),
  };
}

export function suggestedNextCycleStartForClosing(
  activeStartDate: string,
  today: string,
  routine: FinancialRoutine,
): string | null {
  if (!isRoutineCycleStart(activeStartDate, routine)) return null;
  const nextStart = nextLocalDate(plannedFinancialCycleEnd(activeStartDate, routine));
  return nextStart <= today ? nextStart : null;
}
