import { describe, expect, it } from "vitest";
import {
  commitmentAmountInCycle,
  commitmentDueDate,
  commitmentDueDatesInCycle,
  commitmentFirstDueDate,
  commitmentLastDueDate,
  isOutstandingCommitment,
  normalizedCommitmentStatus,
  remainingInstallmentCount,
} from "./financialCommitments";

const afterClosingPurchase = {
  status: "active",
  currentInstallment: 0,
  totalInstallments: 2,
  startedAt: "2026-08-28",
  paymentMethodId: "card-1",
  installmentValue: 150,
};

const card = {
  id: "card-1",
  type: "credit_card",
  closingDay: 23,
  dueDay: 5,
};

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

  it("starts a card commitment on the invoice after a purchase made past closing", () => {
    expect(commitmentFirstDueDate(afterClosingPurchase, card)).toBe("2026-10-05");
    expect(commitmentDueDate(afterClosingPurchase, 1, card)).toBe("2026-10-05");
    expect(commitmentLastDueDate(afterClosingPurchase, card)).toBe("2026-11-05");
  });

  it("does not charge the post-closing purchase in August or September", () => {
    expect(commitmentAmountInCycle(afterClosingPurchase, "2026-08-01", "2026-09-30", card)).toBe(0);
    expect(
      commitmentDueDatesInCycle(afterClosingPurchase, "2026-10-01", "2026-11-30", card),
    ).toEqual(["2026-10-05", "2026-11-05"]);
    expect(commitmentAmountInCycle(afterClosingPurchase, "2026-10-01", "2026-10-31", card)).toBe(
      150,
    );
  });

  it("starts the remaining schedule after the number of paid installments", () => {
    expect(
      commitmentDueDatesInCycle(
        { ...afterClosingPurchase, currentInstallment: 1 },
        "2026-10-01",
        "2026-11-30",
        card,
      ),
    ).toEqual(["2026-11-05"]);
  });

  it("uses the entered date as the first due date outside a card", () => {
    const agreement = {
      ...afterClosingPurchase,
      paymentMethodId: null,
      startedAt: "2026-01-31",
    };
    expect(commitmentFirstDueDate(agreement)).toBe("2026-01-31");
    expect(commitmentDueDate(agreement, 2)).toBe("2026-02-28");
  });
});
