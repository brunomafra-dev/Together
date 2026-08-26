import { describe, expect, it } from "vitest";
import { summarizeCategorySpending } from "./categoryBudgetLinks";

describe("summarizeCategorySpending", () => {
  it("soma categorias diferentes na mesma divisão do planejamento", () => {
    const result = summarizeCategorySpending(
      [
        { id: "gasolina", name: "Gasolina", goalPlanItemId: "carro" },
        { id: "manutencao", name: "Manutenção", goalPlanItemId: "carro" },
      ],
      [
        { categoryId: "gasolina", amount: 250 },
        { categoryId: "manutencao", amount: 400 },
      ],
    );

    expect(result.planItemTotals.get("carro")).toBe(650);
    expect(result.categoryTotals).toEqual([
      { name: "Manutenção", amount: 400 },
      { name: "Gasolina", amount: 250 },
    ]);
  });

  it("resolve contas fixas antigas pelo nome da categoria", () => {
    const result = summarizeCategorySpending(
      [{ id: "moradia", name: "Moradia", goalPlanItemId: "casa" }],
      [{ fallbackName: " moradia ", amount: 1800 }],
    );

    expect(result.planItemTotals.get("casa")).toBe(1800);
    expect(result.categoryTotals).toEqual([{ name: "Moradia", amount: 1800 }]);
  });

  it("mantém gastos sem vínculo visíveis por categoria", () => {
    const result = summarizeCategorySpending(
      [{ id: "saude", name: "Saúde", goalPlanItemId: null }],
      [{ categoryId: "saude", amount: 90 }],
    );

    expect(result.planItemTotals.size).toBe(0);
    expect(result.categoryTotals).toEqual([{ name: "Saúde", amount: 90 }]);
  });
});
