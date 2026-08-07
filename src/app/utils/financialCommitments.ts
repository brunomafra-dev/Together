export interface FinancialCommitmentState {
  status: string;
  currentInstallment: number;
  totalInstallments: number;
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
