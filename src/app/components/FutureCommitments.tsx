import { useMemo } from "react";
import { format } from "date-fns";
import { useState } from "react";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CreditCard,
  Pencil,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AddExpenseModal } from "./AddExpenseModal";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { Expense, formatBRL, useFinance } from "../context/FinanceContext";
import {
  defaultCycleEnd,
  getExpenseCycleDate,
  isDateWithinCycle,
  isLocalDateString,
  nextLocalDate,
  parseLocalDate,
} from "../utils/financialCycles";
import {
  recurringExpenseAppliesToCycle,
  selectCurrentRecurringExpenses,
} from "../utils/recurringExpenses";
import { plannedFinancialCycleEnd, projectedFinancialCycle } from "../utils/financialRoutine";
import { summarizeCycleBudget } from "../utils/cycleBudget";

export function FutureCommitments() {
  const {
    fixedExpenses,
    fixedExpenseMonthlyValues,
    financialCommitments: commitments,
    incomeEntries,
    expenses,
    settings,
    activeCycle,
    household,
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
  const activeCycleEndDate = household
    ? plannedFinancialCycleEnd(activeCycle.startDate, household)
    : defaultCycleEnd(activeCycle.startDate);
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
    let cycleStartDate = firstFutureCycleStartDate;

    for (let index = 0; index < 6; index++) {
      const futureCycleNumber = index + 1;
      const cycleEndDate = household
        ? projectedFinancialCycle(cycleStartDate, household).endDate
        : defaultCycleEnd(cycleStartDate);
      const monthDate = parseLocalDate(cycleStartDate);
      const monthCommitments = commitments
        .filter(
          (commitment) =>
            commitment.status !== "finished" &&
            commitment.totalInstallments - commitment.currentInstallment >= futureCycleNumber,
        )
        .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
      const monthFixed = fixedExpenses.reduce((sum, expense) => {
        const monthlyValue = fixedExpenseMonthlyValues.find(
          (value) =>
            value.fixedExpenseId === expense.id &&
            value.month === monthDate.getMonth() + 1 &&
            value.year === monthDate.getFullYear(),
        );
        const amount =
          monthlyValue?.status === "confirmed" && monthlyValue.actualAmount !== null
            ? monthlyValue.actualAmount
            : (monthlyValue?.estimatedAmount ?? expense.amount);
        return sum + amount;
      }, 0);
      const monthSubscriptions = activeSubscriptions
        .filter(
          (expense) =>
            recurringExpenseAppliesToCycle(expense, cycleEndDate) &&
            !isDateWithinCycle(getExpenseCycleDate(expense), cycleStartDate, cycleEndDate),
        )
        .reduce((sum, expense) => sum + expense.amount, 0);
      const monthRecurringPurchases = activeRecurringPurchases
        .filter(
          (expense) =>
            recurringExpenseAppliesToCycle(expense, cycleEndDate) &&
            !isDateWithinCycle(getExpenseCycleDate(expense), cycleStartDate, cycleEndDate),
        )
        .reduce((sum, expense) => sum + expense.amount, 0);
      const monthRecordedPurchases = expenses
        .filter((expense) =>
          isDateWithinCycle(getExpenseCycleDate(expense), cycleStartDate, cycleEndDate),
        )
        .reduce((sum, expense) => sum + expense.amount, 0);
      const recurringReservations = monthSubscriptions + monthRecurringPurchases;
      const extraIncome = incomeEntries
        .filter((entry) => isDateWithinCycle(entry.date, cycleStartDate, cycleEndDate))
        .reduce((sum, entry) => sum + entry.amount, 0);
      const budget = summarizeCycleBudget({
        baseIncome: settings.monthlyIncome,
        extraIncome,
        fixedExpenses: monthFixed,
        commitments: monthCommitments,
        recordedExpenses: monthRecordedPurchases,
        recurringReservations,
      });
      const reserved = budget.projectedTotal - monthRecordedPurchases;
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
        recurringReservations,
        recordedPurchases: monthRecordedPurchases,
        reserved,
        extraIncome,
        income: budget.income,
        total: budget.projectedTotal,
        dashboardFree: budget.availableNow,
        free: budget.availableAfterReservations,
      });
      cycleStartDate = nextLocalDate(cycleEndDate);
    }
    return months;
  }, [
    activeRecurringPurchases,
    activeSubscriptions,
    commitments,
    fixedExpenses,
    fixedExpenseMonthlyValues,
    expenses,
    firstFutureCycleStartDate,
    household,
    incomeEntries,
    settings.monthlyIncome,
  ]);
  const nextCyclePreview = futureMonths[0] ?? null;
  const hasNextCycleIncome = Boolean(nextCyclePreview && nextCyclePreview.income > 0);
  const nextCycleUsage =
    nextCyclePreview && hasNextCycleIncome
      ? (nextCyclePreview.total / nextCyclePreview.income) * 100
      : 0;

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

        {nextCyclePreview && (
          <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
            <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-cyan-50 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-700">Prévia do próximo ciclo</p>
                  <h2 className="mt-1 font-semibold capitalize text-stone-900">
                    {nextCyclePreview.label}
                  </h2>
                  <p className="mt-1 text-xs text-stone-600">
                    Compras de cartões que já fecharam entram aqui automaticamente, sem fechar o
                    ciclo atual.
                  </p>
                </div>
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                    !hasNextCycleIncome
                      ? "bg-amber-100 text-amber-800"
                      : nextCyclePreview.free >= 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {hasNextCycleIncome && nextCyclePreview.free >= 0 ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {!hasNextCycleIncome
                    ? "Renda ainda não prevista"
                    : nextCyclePreview.free >= 0
                      ? "Dentro do planejado"
                      : "Acima do planejado"}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-sky-50 p-4">
                  <p className="text-xs text-sky-700">Já gasto no próximo ciclo</p>
                  <p className="mt-1 break-words text-lg font-semibold text-sky-950">
                    {formatBRL(nextCyclePreview.recordedPurchases)}
                  </p>
                  <p className="mt-1 text-xs text-sky-700">
                    Compras já lançadas, inclusive nas novas faturas
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">Já reservado</p>
                  <p className="mt-1 break-words text-lg font-semibold text-amber-950">
                    {formatBRL(nextCyclePreview.reserved)}
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Fixas, parcelas, assinaturas e recorrências
                  </p>
                </div>
                <div className="rounded-xl bg-violet-50 p-4">
                  <p className="text-xs text-violet-700">Total comprometido</p>
                  <p className="mt-1 break-words text-lg font-semibold text-violet-950">
                    {formatBRL(nextCyclePreview.total)}
                  </p>
                  <p className="mt-1 text-xs text-violet-700">
                    De {formatBRL(nextCyclePreview.income)} previstos
                  </p>
                </div>
                <div
                  className={`rounded-xl p-4 ${
                    !hasNextCycleIncome
                      ? "bg-stone-50"
                      : nextCyclePreview.free >= 0
                        ? "bg-emerald-50"
                        : "bg-rose-50"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      !hasNextCycleIncome
                        ? "text-stone-600"
                        : nextCyclePreview.free >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                    }`}
                  >
                    {!hasNextCycleIncome
                      ? "Disponibilidade a calcular"
                      : nextCyclePreview.free >= 0
                        ? "Ainda pode gastar"
                        : "Orçamento excedido em"}
                  </p>
                  <p
                    className={`mt-1 break-words text-lg font-semibold ${
                      !hasNextCycleIncome
                        ? "text-stone-900"
                        : nextCyclePreview.free >= 0
                          ? "text-emerald-950"
                          : "text-rose-950"
                    }`}
                  >
                    {hasNextCycleIncome ? formatBRL(Math.abs(nextCyclePreview.free)) : "—"}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      !hasNextCycleIncome
                        ? "text-stone-500"
                        : nextCyclePreview.free >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                    }`}
                  >
                    {hasNextCycleIncome
                      ? "Disponibilidade do orçamento, não do limite do cartão"
                      : "Cadastre uma renda prevista para calcular"}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs text-stone-600">
                  <span>Orçamento comprometido</span>
                  <span>
                    {hasNextCycleIncome ? `${nextCycleUsage.toFixed(0)}%` : "Renda não informada"}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-[width] ${
                      nextCycleUsage > 100
                        ? "bg-rose-500"
                        : nextCycleUsage > 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(Math.max(nextCycleUsage, 0), 100)}%` }}
                  />
                </div>
                {nextCyclePreview.extraIncome > 0 && (
                  <p className="mt-2 text-xs text-stone-500">
                    A renda prevista inclui {formatBRL(nextCyclePreview.extraIncome)} em entradas
                    extras já cadastradas.
                  </p>
                )}
                <p className="mt-2 text-xs text-stone-500">
                  {nextCyclePreview.recurringReservations > 0
                    ? `Ao abrir este ciclo agora, o Dashboard mostraria ${formatBRL(nextCyclePreview.dashboardFree)} livres. A prévia também reserva ${formatBRL(nextCyclePreview.recurringReservations)} em recorrências ainda não lançadas.`
                    : `O disponível usa a mesma fórmula do Dashboard e será ${formatBRL(nextCyclePreview.dashboardFree)} ao abrir este ciclo agora.`}
                </p>
              </div>
            </div>
          </section>
        )}

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
                      <p className="mb-1 text-xs text-violet-700">Compras lançadas</p>
                      <p className="break-words font-semibold text-violet-900">
                        {formatBRL(month.recordedPurchases)}
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
