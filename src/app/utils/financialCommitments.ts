import {
  addLocalMonths,
  getCreditCardBillingDates,
  isDateWithinCycle,
  isLocalDateString,
  type LocalDateString,
  type PaymentMethodBillingConfig,
} from "./financialCycles";

export interface FinancialCommitmentState {
  status: string;
  currentInstallment: number;
  totalInstallments: number;
}

export interface ScheduledFinancialCommitment extends FinancialCommitmentState {
  startedAt: string;
  paymentMethodId?: string | null;
  installmentValue: number;
}

export interface CommitmentPaymentMethod extends PaymentMethodBillingConfig {
  id: string;
}

function paidInstallmentCount(commitment: FinancialCommitmentState): number {
  return Math.min(
    Math.max(Math.trunc(commitment.currentInstallment || 0), 0),
    Math.max(Math.trunc(commitment.totalInstallments || 0), 0),
  );
}

function matchesConfiguredCreditCard(
  commitment: ScheduledFinancialCommitment,
  paymentMethod?: CommitmentPaymentMethod | null,
) {
  return (
    Boolean(commitment.paymentMethodId) &&
    paymentMethod?.id === commitment.paymentMethodId &&
    paymentMethod?.type === "credit_card" &&
    paymentMethod?.closingDay != null &&
    paymentMethod?.dueDay != null
  );
}

export function remainingInstallmentCount(commitment: FinancialCommitmentState): number {
  if (commitment.status === "finished") return 0;
  return Math.max(commitment.totalInstallments - commitment.currentInstallment, 0);
}

export function isOutstandingCommitment(commitment: FinancialCommitmentState): boolean {
  return remainingInstallmentCount(commitment) > 0;
}

export function normalizedCommitmentStatus(
  commitment: FinancialCommitmentState,
): "active" | "finished" | "late" {
  if (commitment.currentInstallment >= commitment.totalInstallments) return "finished";
  if (commitment.status === "finished") return "finished";
  return commitment.status === "late" ? "late" : "active";
}

/**
 * The stored start date is the purchase/contract date for credit cards and the
 * first due date for commitments outside a card.
 */
export function commitmentFirstDueDate(
  commitment: ScheduledFinancialCommitment,
  paymentMethod?: CommitmentPaymentMethod | null,
): LocalDateString {
  if (!isLocalDateString(commitment.startedAt)) {
    throw new RangeError(`Invalid commitment start date "${commitment.startedAt}".`);
  }

  if (matchesConfiguredCreditCard(commitment, paymentMethod)) {
    return getCreditCardBillingDates(
      commitment.startedAt,
      paymentMethod!.closingDay!,
      paymentMethod!.dueDay!,
    ).dueDate;
  }

  return commitment.startedAt;
}

export function commitmentDueDate(
  commitment: ScheduledFinancialCommitment,
  installmentNumber: number,
  paymentMethod?: CommitmentPaymentMethod | null,
): LocalDateString {
  const total = Math.max(Math.trunc(commitment.totalInstallments || 0), 0);
  if (!Number.isInteger(installmentNumber) || installmentNumber < 1 || installmentNumber > total) {
    throw new RangeError("Installment number is outside the commitment schedule.");
  }

  return addLocalMonths(commitmentFirstDueDate(commitment, paymentMethod), installmentNumber - 1);
}

export function commitmentLastDueDate(
  commitment: ScheduledFinancialCommitment,
  paymentMethod?: CommitmentPaymentMethod | null,
): LocalDateString | null {
  if (!isOutstandingCommitment(commitment)) return null;
  return commitmentDueDate(commitment, commitment.totalInstallments, paymentMethod);
}

export function commitmentDueDatesInCycle(
  commitment: ScheduledFinancialCommitment,
  cycleStartDate: LocalDateString,
  cycleEndDate: LocalDateString,
  paymentMethod?: CommitmentPaymentMethod | null,
): LocalDateString[] {
  if (!isOutstandingCommitment(commitment)) return [];

  const paid = paidInstallmentCount(commitment);
  const total = Math.max(Math.trunc(commitment.totalInstallments || 0), 0);
  const dates: LocalDateString[] = [];

  for (let installmentIndex = paid; installmentIndex < total; installmentIndex += 1) {
    const dueDate = commitmentDueDate(commitment, installmentIndex + 1, paymentMethod);
    if (isDateWithinCycle(dueDate, cycleStartDate, cycleEndDate)) dates.push(dueDate);
  }

  return dates;
}

export function commitmentAmountInCycle(
  commitment: ScheduledFinancialCommitment,
  cycleStartDate: LocalDateString,
  cycleEndDate: LocalDateString,
  paymentMethod?: CommitmentPaymentMethod | null,
): number {
  return (
    commitment.installmentValue *
    commitmentDueDatesInCycle(commitment, cycleStartDate, cycleEndDate, paymentMethod).length
  );
}
