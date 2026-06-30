import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Expense, formatBRL, useFinance } from "../context/FinanceContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Pencil, Trash2 } from "lucide-react";
import { AddExpenseModal } from "./AddExpenseModal";
import { dedupeCategories } from "../utils/categories";

interface RecentExpensesProps {
  expenses: Expense[];
  defaultMonth?: string;
}

const monthKey = (date: string) => date.slice(0, 7);

const csvCell = (value: string | number) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export function RecentExpenses({ expenses, defaultMonth }: RecentExpensesProps) {
  const { deleteExpense, household, settings, categories, paymentMethods } = useFinance();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    month:
      defaultMonth ??
      (expenses[0]?.date ? monthKey(expenses[0].date) : new Date().toISOString().slice(0, 7)),
    paidBy: "all",
    category: "all",
    method: "all",
  });

  useEffect(() => {
    if (defaultMonth) {
      setFilters((current) => ({ ...current, month: defaultMonth }));
    }
  }, [defaultMonth]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const categoryOptions = useMemo(() => dedupeCategories(categories), [categories]);
  const paymentMethodNames = useMemo(
    () => new Map(paymentMethods.map((method) => [method.id, method.name])),
    [paymentMethods],
  );
  const householdMembers = useMemo(() => {
    const names = [
      household?.partnerNames[0] || settings.partnerNames[0] || "",
      household?.partnerNames[1] || settings.partnerNames[1] || "",
    ];
    const ids = [household?.partnerIds[0] || "", household?.partnerIds[1] || ""];
    return names
      .map((name, index) => ({ id: ids[index] || name, value: name, name }))
      .filter((member) => member.name);
  }, [household?.partnerIds, household?.partnerNames, settings.partnerNames]);
  const resolvePersonName = (paidBy: string) =>
    householdMembers.find((member) => member.id === paidBy || member.value === paidBy)?.name ||
    paidBy;

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses],
  );

  const filtered = useMemo(
    () =>
      sorted.filter((expense) => {
        const matchesMonth = !filters.month || monthKey(expense.date) === filters.month;
        const matchesPaidBy =
          filters.paidBy === "all" ||
          expense.paidBy === filters.paidBy ||
          householdMembers.some(
            (member) => member.value === filters.paidBy && member.id === expense.paidBy,
          );
        const matchesCategory = filters.category === "all" || expense.category === filters.category;
        const matchesMethod = filters.method === "all" || expense.card === filters.method;
        return matchesMonth && matchesPaidBy && matchesCategory && matchesMethod;
      }),
    [filters, householdMembers, sorted],
  );

  const personTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of filtered) {
      const personName = resolvePersonName(expense.paidBy);
      totals.set(personName, (totals.get(personName) || 0) + expense.amount);
    }
    return Array.from(totals.entries())
      .map(([paidBy, amount]) => ({ name: paidBy, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, householdMembers]);

  const difference =
    personTotals.length >= 2
      ? Math.abs(personTotals[0].amount - personTotals[1].amount)
      : (personTotals[0]?.amount ?? 0);

  const handleDelete = async (expense: Expense) => {
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      toast.success("Gasto apagado.");
    } catch (err) {
      toast.error((err as Error)?.message || "Não foi possível apagar o gasto.");
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["data", "descrição", "categoria", "forma de pagamento", "quem pagou", "valor"],
      ...filtered.map((expense) => [
        expense.date,
        expense.description || "",
        categoryNames.get(expense.category) || expense.category || "Sem categoria",
        expense.card ? paymentMethodNames.get(expense.card) || expense.card : "",
        resolvePersonName(expense.paidBy),
        expense.amount.toFixed(2).replace(".", ","),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gastos-${filters.month || "filtrados"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-medium text-stone-900 mb-1">Últimos gastos</h2>
          <p className="text-xs text-stone-500">Filtre, edite e exporte os lancamentos</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="month"
          value={filters.month}
          onChange={(e) => setFilters((current) => ({ ...current, month: e.target.value }))}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <select
          value={filters.paidBy}
          onChange={(e) => setFilters((current) => ({ ...current, paidBy: e.target.value }))}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todas as pessoas</option>
          {householdMembers.map((member) => (
            <option key={member.id} value={member.value}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters((current) => ({ ...current, category: e.target.value }))}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todas as categorias</option>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={filters.method}
          onChange={(e) => setFilters((current) => ({ ...current, method: e.target.value }))}
          className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">Todas as formas</option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 rounded-xl border border-stone-100 bg-stone-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">
          Pago por pessoa
        </p>
        {personTotals.length === 0 ? (
          <p className="text-sm text-stone-500">Sem gastos para comparar neste filtro.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {personTotals.slice(0, 2).map((person) => (
              <div key={person.name} className="rounded-lg bg-white px-3 py-2">
                <p className="truncate text-xs text-stone-500">{person.name}</p>
                <p className="text-sm font-semibold text-stone-900">{formatBRL(person.amount)}</p>
              </div>
            ))}
            <div className="rounded-lg bg-white px-3 py-2 sm:col-span-2">
              <p className="text-xs text-stone-500">Diferenca entre os maiores totais</p>
              <p className="text-sm font-semibold text-stone-900">{formatBRL(difference)}</p>
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-sm">Nada por aqui neste filtro.</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((expense) => (
            <div
              key={expense.id}
              className="group flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-stone-900">
                    {expense.description || categoryNames.get(expense.category) || expense.category}
                  </p>
                  <span className="text-xs px-2 py-0.5 bg-stone-100 text-stone-600 rounded shrink-0">
                    {categoryNames.get(expense.category) || expense.category || "Sem categoria"}
                  </span>
                  {expense.recurringMonthly && (
                    <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded shrink-0">
                      recorrente
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {format(parseISO(expense.date), "d 'de' MMM", { locale: ptBR })} -{" "}
                  {resolvePersonName(expense.paidBy)}
                  {expense.card ? ` - ${paymentMethodNames.get(expense.card) || expense.card}` : ""}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:ml-2 sm:justify-end">
                <p className="break-words text-sm font-medium text-stone-900">
                  {formatBRL(expense.amount)}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingExpense(expense)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)] sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === expense.id}
                    onClick={() => handleDelete(expense)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_0_18px_rgba(244,63,94,0.16)] disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingExpense && (
        <AddExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />
      )}
    </div>
  );
}
