import { useMemo } from "react";
import { format } from "date-fns";
import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { Calendar, CreditCard, Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AddExpenseModal } from "./AddExpenseModal";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { Expense, formatBRL, useFinance } from "../context/FinanceContext";
import {
  addLocalMonths,
  defaultCycleEnd,
  formatLocalDate,
  getExpenseCycleDate,
  isDateWithinCycle,
  isLocalDateString,
  nextLocalDate,
  openCycleReferenceEnd,
  parseLocalDate,
} from "../utils/financialCycles";
import {
  recurringExpenseAppliesToCycle,
  selectCurrentRecurringExpenses,
} from "../utils/recurringExpenses";

export function FutureCommitments() {
  const {
    fixedExpenses,
    financialCommitments: commitments,
    expenses,
    settings,
    activeCycle,
    categories,
    paymentMethods,
    deleteExpense,
  } = useFinance();
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const subscriptionCategoryIds = useMemo(
    () =>
      new Set(
        categories
          .filter((category) => category.name.trim().toLowerCase() === "assinaturas")
          .map((category) => category.id),
      ),
    [categories],
  );

  const recurringTemplates = useMemo(() => selectCurrentRecurringExpenses(expenses), [expenses]);
  const activeSubscriptions = useMemo(
    () => recurringTemplates.filter((expense) => subscriptionCategoryIds.has(expense.category)),
    [recurringTemplates, subscriptionCategoryIds],
  );
  const activeRecurringPurchases = useMemo(
    () => recurringTemplates.filter((expense) => !subscriptionCategoryIds.has(expense.category)),
    [recurringTemplates, subscriptionCategoryIds],
  );
  const subscriptionTotal = useMemo(
    () => activeSubscriptions.reduce((sum, expense) => sum + expense.amount, 0),
    [activeSubscriptions],
  );
  const recurringPurchaseTotal = useMemo(
    () => activeRecurringPurchases.reduce((sum, expense) => sum + expense.amount, 0),
    [activeRecurringPurchases],
  );
  const fixedRecurringExpenses = useMemo(
    () => fixedExpenses.filter((expense) => expense.amountType !== "variable"),
    [fixedExpenses],
  );
  const variableRecurringExpenses = useMemo(
    () => fixedExpenses.filter((expense) => expense.amountType === "variable"),
    [fixedExpenses],
  );
  const activeCycleEndDate = openCycleReferenceEnd(
    activeCycle.startDate,
    formatLocalDate(new Date()),
  );
  const firstFutureCycleStartDate = nextLocalDate(activeCycleEndDate);

  const futureCardInvoices = useMemo(() => {
    const paymentMethodsById = new Map(paymentMethods.map((method) => [method.id, method]));
    const invoices = new Map<
      string,
      {
        cardId: string;
        cardName: string;
        closingDate: string;
        dueDate: string | null;
        amount: number;
        purchaseCount: number;
        purchases: Expense[];
      }
    >();

    for (const expense of expenses) {
      const method = expense.card ? paymentMethodsById.get(expense.card) : null;
      if (method?.type !== "credit_card" || !isLocalDateString(expense.invoiceClosingDate)) {
        continue;
      }
      if (expense.invoiceClosingDate <= activeCycleEndDate) continue;

      const dueDate = isLocalDateString(expense.invoiceDueDate) ? expense.invoiceDueDate : null;
      const key = `${method.id}:${expense.invoiceClosingDate}:${dueDate ?? ""}`;
      const current = invoices.get(key);
      invoices.set(key, {
        cardId: method.id,
        cardName: method.name,
        closingDate: expense.invoiceClosingDate,
        dueDate,
        amount: (current?.amount ?? 0) + expense.amount,
        purchaseCount: (current?.purchaseCount ?? 0) + 1,
        purchases: [...(current?.purchases ?? []), expense],
      });
    }

    return Array.from(invoices.values())
      .map((invoice) => ({
        ...invoice,
        purchases: invoice.purchases.sort(
          (left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id),
        ),
      }))
      .sort(
        (left, right) =>
          left.closingDate.localeCompare(right.closingDate) ||
          left.cardName.localeCompare(right.cardName, "pt-BR"),
      );
  }, [activeCycleEndDate, expenses, paymentMethods]);
  const futureCardInvoiceTotal = futureCardInvoices.reduce(
    (sum, invoice) => sum + invoice.amount,
    0,
  );

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`Apagar ${expense.description || "esta compra"}?`)) return;
    setDeletingExpenseId(expense.id);
    try {
      await deleteExpense(expense.id);
      toast.success("Compra apagada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível apagar a compra.");
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const futureMonths = useMemo(() => {
    const months = [];
    const paymentMethodsById = new Map(paymentMethods.map((method) => [method.id, method]));

    for (let index = 0; index < 6; index++) {
      const futureCycleNumber = index + 1;
      const cycleStartDate = addLocalMonths(firstFutureCycleStartDate, index);
      const cycleEndDate = defaultCycleEnd(cycleStartDate);
      const monthDate = parseLocalDate(cycleStartDate);
      const monthCommitments = commitments
        .filter(
          (commitment) =>
            commitment.status !== "finished" &&
            commitment.totalInstallments - commitment.currentInstallment >= futureCycleNumber,
        )
        .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
      const monthFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
      const monthSubscriptions = activeSubscriptions
        .filter((expense) => recurringExpenseAppliesToCycle(expense, cycleEndDate))
        .reduce((sum, expense) => sum + expense.amount, 0);
      const monthRecurringPurchases = activeRecurringPurchases
        .filter((expense) => recurringExpenseAppliesToCycle(expense, cycleEndDate))
        .reduce((sum, expense) => sum + expense.amount, 0);
      const monthCardPurchases = expenses
        .filter((expense) => {
          if (expense.recurringMonthly) return false;
          const method = expense.card ? paymentMethodsById.get(expense.card) : null;
          if (method?.type !== "credit_card") return false;
          const effectiveDate = getExpenseCycleDate(expense);
          return isDateWithinCycle(effectiveDate, cycleStartDate, cycleEndDate);
        })
        .reduce((sum, expense) => sum + expense.amount, 0);
      const total =
        monthCommitments +
        monthFixed +
        monthSubscriptions +
        monthRecurringPurchases +
        monthCardPurchases;
      months.push({
        date: monthDate,
        label: `${format(monthDate, "MMMM 'de' yyyy", { locale: ptBR })} · ${format(
          monthDate,
          "dd/MM",
        )} a ${format(parseLocalDate(cycleEndDate), "dd/MM")}`,
        commitments: monthCommitments,
        fixed: monthFixed,
        subscriptions: monthSubscriptions,
        recurringPurchases: monthRecurringPurchases,
        cardPurchases: monthCardPurchases,
        total,
        free: settings.monthlyIncome - total,
      });
    }
    return months;
  }, [
    activeRecurringPurchases,
    activeSubscriptions,
    commitments,
    fixedExpenses,
    expenses,
    firstFutureCycleStartDate,
    paymentMethods,
    settings.monthlyIncome,
  ]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Impacto futuro</h1>
          <p className="text-sm text-stone-600 mt-1">
            O que já está comprometido nos próximos meses
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
          <p className="text-sm text-emerald-900 mb-1">Esse compromisso vai diminuir</p>
          <p className="text-stone-700 text-sm">
            Conforme os compromissos terminam, vocês recuperam dinheiro livre todo mês. Acompanhe
            abaixo como cada mês vai ficar mais leve.
          </p>
        </div>

        <ExpandableSection
          title="Próximas faturas dos cartões"
          summary={
            futureCardInvoices.length > 0
              ? `${futureCardInvoices.length} faturas · ${formatBRL(futureCardInvoiceTotal)} já lançado`
              : "Nenhuma compra lançada em faturas futuras"
          }
          defaultOpen={futureCardInvoices.length > 0}
        >
          <div className="space-y-2">
            {futureCardInvoices.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                Compras feitas depois do fechamento do cartão aparecerão aqui até o ciclo delas
                começar.
              </p>
            ) : (
              futureCardInvoices.map((invoice) => (
                <div
                  key={`${invoice.cardId}:${invoice.closingDate}:${invoice.dueDate ?? ""}`}
                  className="rounded-xl border border-violet-100 bg-violet-50/60 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-stone-900">
                          {invoice.cardName}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-600">
                          Fecha em {format(parseLocalDate(invoice.closingDate), "dd/MM/yyyy")}
                          {invoice.dueDate
                            ? ` · vence em ${format(parseLocalDate(invoice.dueDate), "dd/MM/yyyy")}`
                            : ""}
                          {` · ${invoice.purchaseCount} ${invoice.purchaseCount === 1 ? "compra" : "compras"}`}
                        </p>
                      </div>
                    </div>
                    <p className="break-words text-sm font-semibold text-violet-900 sm:text-right">
                      {formatBRL(invoice.amount)}
                    </p>
                  </div>

                  <div className="mt-4 divide-y divide-violet-100 border-t border-violet-100">
                    {invoice.purchases.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex flex-col gap-2 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-stone-900">
                            {expense.description ||
                              categoryNames.get(expense.category) ||
                              "Sem descrição"}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            Compra em {format(parseLocalDate(expense.date), "dd/MM/yyyy")} ·{" "}
                            {categoryNames.get(expense.category) || "Sem categoria"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-end">
                          <p className="mr-1 text-sm font-semibold text-stone-900">
                            {formatBRL(expense.amount)}
                          </p>
                          <button
                            type="button"
                            onClick={() => setEditingExpense(expense)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-colors hover:border-emerald-200 hover:text-emerald-700"
                            aria-label="Editar compra"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingExpenseId === expense.id}
                            onClick={() => void handleDeleteExpense(expense)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                            aria-label="Apagar compra"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Próximos meses"
          summary={
            futureMonths[0]
              ? `${futureMonths.length} meses · ${formatBRL(futureMonths[0].total)} no próximo ciclo`
              : "Sem projeção futura"
          }
          defaultOpen
        >
          <div className="grid gap-3">
            {futureMonths.map((month, index) => {
              const isRelief = index > 0 && month.total < futureMonths[index - 1].total;

              return (
                <div key={index} className="bg-white rounded-2xl p-5 border border-stone-200">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <Calendar className="w-4 h-4 text-stone-500" />
                      <h3 className="min-w-0 break-words font-medium capitalize text-stone-900">
                        {month.label}
                      </h3>
                    </div>
                    {isRelief && (
                      <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        Mais leve
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-xs text-stone-500 mb-1">Contas fixas</p>
                      <p className="break-words font-semibold text-stone-900">
                        {formatBRL(month.fixed)}
                      </p>
                    </div>
                    <div className="bg-indigo-50 rounded-xl p-3">
                      <p className="text-xs text-indigo-700 mb-1">Compromissos</p>
                      <p className="break-words font-semibold text-indigo-900">
                        {formatBRL(month.commitments)}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-amber-700 mb-1">Assinaturas</p>
                      <p className="break-words font-semibold text-amber-900">
                        {formatBRL(month.subscriptions)}
                      </p>
                    </div>
                    <div className="bg-cyan-50 rounded-xl p-3">
                      <p className="text-xs text-cyan-700 mb-1">Recorrências</p>
                      <p className="break-words font-semibold text-cyan-900">
                        {formatBRL(month.recurringPurchases)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-violet-50 p-3">
                      <p className="mb-1 text-xs text-violet-700">Faturas futuras</p>
                      <p className="break-words font-semibold text-violet-900">
                        {formatBRL(month.cardPurchases)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-700 mb-1">Sobra estimada</p>
                      <p className="break-words font-semibold text-emerald-900">
                        {formatBRL(month.free)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Contas fixas ativas"
          summary={`${fixedExpenses.length} contas · ${formatBRL(fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0))}/mês`}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-stone-600" />
            <h3 className="font-medium text-stone-900">Contas fixas ativas</h3>
          </div>
          <div className="space-y-2">
            {fixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-stone-900">{expense.name}</p>
                  <p className="text-xs text-stone-500">
                    {expense.category} · vence dia {expense.dueDate}
                  </p>
                </div>
                <p className="break-words text-sm font-medium text-stone-900 sm:text-right">
                  {formatBRL(expense.amount)}
                </p>
              </div>
            ))}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Resumo das recorrentes"
          summary={`${formatBRL(fixedRecurringExpenses.reduce((sum, expense) => sum + expense.amount, 0))} fixas · ${formatBRL(variableRecurringExpenses.reduce((sum, expense) => sum + expense.amount, 0))} variáveis`}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-stone-600" />
              <h3 className="font-medium text-stone-900">Resumo das recorrentes</h3>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs text-emerald-700">Fixas reais</p>
              <p className="mt-1 font-semibold text-emerald-900">
                {formatBRL(
                  fixedRecurringExpenses.reduce((sum, expense) => sum + expense.amount, 0),
                )}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700">Variaveis estimadas</p>
              <p className="mt-1 font-semibold text-amber-900">
                {formatBRL(
                  variableRecurringExpenses.reduce((sum, expense) => sum + expense.amount, 0),
                )}
              </p>
            </div>
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Compras recorrentes"
          summary={`${activeRecurringPurchases.length} recorrências · ${formatBRL(recurringPurchaseTotal)}/mês`}
          defaultOpen={activeRecurringPurchases.length > 0}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-600" />
              <h3 className="font-medium text-stone-900">Compras recorrentes</h3>
            </div>
            <p className="text-sm font-semibold text-stone-900">
              {formatBRL(recurringPurchaseTotal)}
            </p>
          </div>
          <div className="space-y-2">
            {activeRecurringPurchases.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                Nenhuma compra recorrente cadastrada.
              </p>
            ) : (
              activeRecurringPurchases.map((expense) => {
                const categoryName =
                  categories.find((category) => category.id === expense.category)?.name ??
                  "Sem categoria";
                const paymentName =
                  paymentMethods.find((method) => method.id === expense.card)?.name ?? "Sem forma";

                return (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-stone-900">
                        {expense.description || categoryName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {categoryName} · {paymentName} · desde{" "}
                        {format(new Date(`${expense.date}T00:00:00`), "MMM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <p className="break-words text-sm font-medium text-stone-900 sm:text-right">
                      {formatBRL(expense.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Assinaturas ativas"
          summary={`${activeSubscriptions.length} assinaturas · ${formatBRL(subscriptionTotal)}/mês`}
          defaultOpen={activeSubscriptions.length > 0}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <h3 className="font-medium text-stone-900">Assinaturas ativas</h3>
            </div>
            <p className="text-sm font-semibold text-stone-900">{formatBRL(subscriptionTotal)}</p>
          </div>
          <div className="space-y-2">
            {activeSubscriptions.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm text-stone-500">
                Nenhuma assinatura mensal cadastrada.
              </p>
            ) : (
              activeSubscriptions.map((expense) => {
                const categoryName =
                  categories.find((category) => category.id === expense.category)?.name ??
                  "Assinatura";
                const paymentName =
                  paymentMethods.find((method) => method.id === expense.card)?.name ?? "Sem forma";

                return (
                  <div
                    key={expense.id}
                    className="flex flex-col gap-2 border-b border-stone-100 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-stone-900">
                        {expense.description || categoryName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {categoryName} · {paymentName} · desde{" "}
                        {format(new Date(`${expense.date}T00:00:00`), "MMM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <p className="break-words text-sm font-medium text-stone-900 sm:text-right">
                      {formatBRL(expense.amount)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </ExpandableSection>
      </div>
      {editingExpense && (
        <AddExpenseModal expense={editingExpense} onClose={() => setEditingExpense(null)} />
      )}
    </Layout>
  );
}
