import { describe, expect, it } from "vitest";
import {
  allocationFromInput,
  allocationStorage,
  resolveStoredAllocation,
} from "./goalPlanAllocations";

describe("goal plan allocations", () => {
  it("keeps legacy percentage allocations tied to income", () => {
    expect(resolveStoredAllocation("percentage", "35%", 0, 4200)).toEqual({
      mode: "percentage",
      percent: 35,
      amount: 1470,
    });
  });

  it("keeps an exact amount independent from income", () => {
    expect(resolveStoredAllocation("fixed", "Valor fixo", 1500, 4200)).toEqual({
      mode: "fixed",
      percent: (1500 / 4200) * 100,
      amount: 1500,
    });
    expect(resolveStoredAllocation("fixed", "Valor fixo", 1500, 5000).amount).toBe(1500);
  });

  it("serializes fixed and percentage modes explicitly", () => {
    const fixed = allocationFromInput("fixed", 1500, 4200);
    const percentage = allocationFromInput("percentage", 35, 4200);

    expect(allocationStorage(fixed.mode, fixed.percent, fixed.amount)).toEqual({
      allocationMode: "fixed",
      share: "Valor fixo",
      amount: 1500,
    });
    expect(allocationStorage(percentage.mode, percentage.percent, percentage.amount)).toEqual({
      allocationMode: "percentage",
      share: "35%",
      amount: 1470,
    });
  });
});
