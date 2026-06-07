import { Expense, formatBRL, useFinance } from "../context/FinanceContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";

interface RecentExpensesProps {
  expenses: Expense[];
}

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const { deleteExpense, household, settings } = useFinance();
  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const householdMembers = new Map(
    (household?.partnerIds ?? ["", ""])
      .map((id, index) => [id, household?.partnerNames[index] || settings.partnerNames[index] || ""] as const)
      .filter(([id]) => Boolean(id)),
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200">
      <h2 className="font-medium text-stone-900 mb-1">Últimos gastos</h2>
      <p className="text-xs text-stone-500 mb-4">O que saiu recentemente</p>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">
          Nada por aqui ainda.
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.slice(0, 8).map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between py-2.5 border-b border-stone-100 last:border-0 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {expense.description || expense.category}
                  </p>
                  <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded shrink-0">
                    {expense.category}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {format(parseISO(expense.date), "d 'de' MMM", {
                    locale: ptBR,
                  })}{" "}
                  · {householdMembers.get(expense.paidBy) || expense.paidBy}
                  {expense.card ? ` · ${expense.card}` : ""}
                  {expense.installments && expense.installments > 1
                    ? ` · ${expense.installments}x`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-2">
                <p className="text-sm font-medium text-stone-900">
                  {formatBRL(expense.amount)}
                </p>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
