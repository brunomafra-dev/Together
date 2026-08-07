import { describe, expect, it } from "vitest";
import {
  isOutstandingCommitment,
  normalizedCommitmentStatus,
  remainingInstallmentCount,
} from "./financialCommitments";

describe("financial commitments", () => {
  it("keeps active and late commitments with remaining installments", () => {
    expect(
      isOutstandingCommitment({ status: "active", currentInstallment: 3, totalInstallments: 12 }),
    ).toBe(true);
    expect(
      isOutstandingCommitment({ status: "late", currentInstallment: 3, totalInstallments: 12 }),
    ).toBe(true);
  });

  it("never counts a fully paid commitment even if its old status is active", () => {
    const commitment = { status: "active", currentInstallment: 12, totalInstallments: 12 };
    expect(remainingInstallmentCount(commitment)).toBe(0);
    expect(isOutstandingCommitment(commitment)).toBe(false);
    expect(normalizedCommitmentStatus(commitment)).toBe("finished");
  });

  it("keeps an explicitly finished commitment excluded", () => {
    const commitment = { status: "finished", currentInstallment: 2, totalInstallments: 12 };
    expect(remainingInstallmentCount(commitment)).toBe(0);
    expect(isOutstandingCommitment(commitment)).toBe(false);
  });

  it("does not silently reopen an explicitly finished commitment", () => {
    expect(
      normalizedCommitmentStatus({
        status: "finished",
        currentInstallment: 2,
        totalInstallments: 12,
      }),
    ).toBe("finished");
  });

  it("preserves late status while installments remain", () => {
    expect(
      normalizedCommitmentStatus({ status: "late", currentInstallment: 2, totalInstallments: 12 }),
    ).toBe("late");
  });
});
