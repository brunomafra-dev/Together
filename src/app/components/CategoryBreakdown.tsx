import { useMemo } from "react";
import { Expense, formatBRL } from "../context/FinanceContext";

interface CategoryBreakdownProps {
  expenses: Array<Pick<Expense, "category" | "amount">>;
}

const COLORS = [
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
];

export function CategoryBreakdown({ expenses }: CategoryBreakdownProps) {
  const categoryData = useMemo(() => {
    const totals = expenses.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      },
      {} as Record<string, number>,
    );
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const total = categoryData.reduce((s, i) => s + i.value, 0);

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200">
      <h2 className="font-medium text-stone-900 mb-1">Onde está indo</h2>
      <p className="text-xs text-stone-500 mb-4">Gastos variáveis por categoria</p>

      {categoryData.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">Nenhum gasto ainda esse mês.</div>
      ) : (
        <div className="space-y-3">
          {categoryData.map((item, index) => {
            const pct = (item.value / total) * 100;
            const color = COLORS[index % COLORS.length];
            return (
              <div key={item.name}>
                <div className="mb-1.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="min-w-0 break-words text-sm text-stone-700">{item.name}</span>
                  </div>
                  <div className="text-sm sm:text-right">
                    <span className="break-words font-medium text-stone-900">
                      {formatBRL(item.value)}
                    </span>
                    <span className="text-xs text-stone-500 ml-2">{pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
