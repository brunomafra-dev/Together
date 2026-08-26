export interface BudgetCategoryLink {
  id: string;
  name: string;
  goalPlanItemId?: string | null;
}

export interface CategorizedAmount {
  categoryId?: string | null;
  fallbackName?: string | null;
  amount: number;
}

export function summarizeCategorySpending(
  categories: BudgetCategoryLink[],
  amounts: CategorizedAmount[],
) {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByName = new Map(
    categories.map((category) => [category.name.trim().toLowerCase(), category]),
  );
  const categoryTotals = new Map<string, number>();
  const planItemTotals = new Map<string, number>();

  for (const row of amounts) {
    const fallbackName = row.fallbackName?.trim() || "Sem categoria";
    const category =
      (row.categoryId ? categoriesById.get(row.categoryId) : undefined) ??
      categoriesByName.get(fallbackName.toLowerCase());
    const categoryName = category?.name || fallbackName;

    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + row.amount);
    if (category?.goalPlanItemId) {
      planItemTotals.set(
        category.goalPlanItemId,
        (planItemTotals.get(category.goalPlanItemId) || 0) + row.amount,
      );
    }
  }

  return {
    categoryTotals: Array.from(categoryTotals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount),
    planItemTotals,
  };
}
