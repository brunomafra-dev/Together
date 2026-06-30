import { useMemo } from "react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, TrendingDown, TrendingUp } from "lucide-react";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";

export function FutureCommitments() {
  const {
    fixedExpenses,
    financialCommitments: commitments,
    expenses,
    settings,
    activeCycle,
    categories,
    paymentMethods,
  } = useFinance();
  const subscriptionCategoryIds = useMemo(
    () =>
      new Set(
        categories
          .filter((category) => category.name.trim().toLowerCase() === "assinaturas")
          .map((category) => category.id),
      ),
    [categories],
  );

  const activeSubscriptions = useMemo(
    () => expenses.filter((expense) => subscriptionCategoryIds.has(expense.category)),
    [expenses, subscriptionCategoryIds],
  );
  const activeRecurringPurchases = useMemo(
    () =>
      expenses.filter(
        (expense) => expense.recurringMonthly && !subscriptionCategoryIds.has(expense.category),
      ),
    [expenses, subscriptionCategoryIds],
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

  const futureMonths = useMemo(() => {
    const months = [];
    const baseMonth = new Date(activeCycle.year, activeCycle.month - 1, 1);

    for (let i = 1; i <= 6; i++) {
      const monthDate = addMonths(baseMonth, i);
      const monthKey = monthDate.getFullYear() * 12 + monthDate.getMonth();
      const monthCommitments = commitments
        .filter(
          (commitment) =>
            commitment.status !== "finished" &&
            commitment.totalInstallments - commitment.currentInstallment >= i,
        )
        .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
      const monthFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
      const monthSubscriptions = activeSubscriptions
        .filter((expense) => {
          const startDate = new Date(`${expense.date}T00:00:00`);
          const startKey = startDate.getFullYear() * 12 + startDate.getMonth();
          return startKey <= monthKey;
        })
        .reduce((sum, expense) => sum + expense.amount, 0);
      const monthRecurringPurchases = activeRecurringPurchases
        .filter((expense) => {
          const startDate = new Date(`${expense.date}T00:00:00`);
          const startKey = startDate.getFullYear() * 12 + startDate.getMonth();
          return startKey <= monthKey;
        })
        .reduce((sum, expense) => sum + expense.amount, 0);
      const total = monthCommitments + monthFixed + monthSubscriptions + monthRecurringPurchases;
      months.push({
        date: monthDate,
        label: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        commitments: monthCommitments,
        fixed: monthFixed,
        subscriptions: monthSubscriptions,
        recurringPurchases: monthRecurringPurchases,
        total,
        free: settings.monthlyIncome - total,
      });
    }
    return months;
  }, [
    activeCycle.month,
    activeCycle.year,
    activeRecurringPurchases,
    activeSubscriptions,
    commitments,
    fixedExpenses,
    settings.monthlyIncome,
  ]);

  const prevMonth = futureMonths[0]?.total || 0;

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
              const change = index === 0 ? 0 : month.total - prevMonth;
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

                  <div className="grid gap-3 sm:grid-cols-5">
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
    </Layout>
  );
}
