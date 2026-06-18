import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRef } from "react";
import { endOfMonth, format, getDate, getDaysInMonth, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, BarChart3, CalendarCheck, Clock3, Plus, Sparkles, Target, Trash2, TrendingDown, Users, Wallet, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { AddExpenseModal } from "./AddExpenseModal";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { RecentExpenses } from "./RecentExpenses";
import { formatBRL, MonthlySnapshotModel, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

const nextCycle = (cycle: { month: number; year: number }) =>
  cycle.month === 12 ? { month: 1, year: cycle.year + 1 } : { month: cycle.month + 1, year: cycle.year };

export function Dashboard() {
  const navigate = useNavigate();
  const {
    household,
    expenses,
    fixedExpenses,
    fixedExpenseMonthlyValues,
    financialCommitments,
    categories,
    paymentMethods,
    incomeEntries,
    settings,
    loading,
    error,
    closeMonth,
    addIncomeEntry,
    deleteIncomeEntry,
    openNextMonth,
    activeCycle,
  } = useFinance();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showCloseMonth, setShowCloseMonth] = useState(false);
  const [closedSnapshot, setClosedSnapshot] = useState<MonthlySnapshotModel | null>(null);
  const [openDetail, setOpenDetail] = useState<"income" | "commitments" | "expenses" | "goal" | "people" | "categories" | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const [goalSummary, setGoalSummary] = useState<{
    title: string;
    label: string;
    currentAmount: number;
    targetAmount: number;
    planNames: string[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const householdId = household?.id;
      if (!householdId) return;

      const goals = await financeService.fetchGoals(householdId).catch(() => []);

      const currentGoal = goals[0];
      if (!currentGoal) {
        setGoalSummary(null);
        return;
      }

      const subGoals = await financeService.fetchGoalProgressRows(currentGoal.id).catch(() => []);
      setGoalSummary({
        title: currentGoal.title,
        label: currentGoal.label,
        currentAmount: currentGoal.currentAmount,
        targetAmount: currentGoal.targetAmount,
        planNames: subGoals.map((item) => item.name).filter(Boolean),
      });
    };

    void load();
  }, [household?.id]);

  const cycleMonthDate = new Date(activeCycle.year, activeCycle.month - 1, 1);
  const today = new Date();
  const isActiveCycleCurrentMonth =
    today.getFullYear() === activeCycle.year && today.getMonth() + 1 === activeCycle.month;
  const paceReferenceDate = isActiveCycleCurrentMonth
    ? today
    : new Date(activeCycle.year, activeCycle.month - 1, 1);
  const currentMonth = useMemo(
    () => ({ start: startOfMonth(cycleMonthDate), end: endOfMonth(cycleMonthDate) }),
    [cycleMonthDate],
  );

  const data = useMemo(() => {
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const paymentMethodNames = new Map(paymentMethods.map((method) => [method.id, method.name]));
    const householdNames = household?.partnerNames ?? settings.partnerNames.filter(Boolean);
    const householdMembers = new Map(
      (household?.partnerIds ?? ["", ""])
        .map((id, index) => [id, householdNames[index] || ""] as const)
        .filter(([id]) => Boolean(id)),
    );

    const resolvedExpenses = expenses.map((expense) => ({
      ...expense,
      category: categoryNames.get(expense.category) || expense.category || "Sem categoria",
      card: expense.card ? paymentMethodNames.get(expense.card) || expense.card : null,
      paidBy: householdMembers.get(expense.paidBy) || expense.paidBy || "Sem responsável",
    }));

    const monthExpenses = resolvedExpenses.filter((expense) =>
      isWithinInterval(parseISO(expense.date), currentMonth),
    );
    const monthIncomeEntries = incomeEntries.filter((entry) =>
      isWithinInterval(parseISO(entry.date), currentMonth),
    );
    const fixedExpenseAmount = (expense: typeof fixedExpenses[number]) => {
      const monthlyValue = fixedExpenseMonthlyValues.find(
        (value) =>
          value.fixedExpenseId === expense.id &&
          value.month === activeCycle.month &&
          value.year === activeCycle.year,
      );
      return monthlyValue?.status === "confirmed" && monthlyValue.actualAmount !== null
        ? monthlyValue.actualAmount
        : monthlyValue?.estimatedAmount ?? expense.amount;
    };

    const fixedCategoryExpenses = fixedExpenses.map((expense) => ({
      category: expense.category || "Sem categoria",
      amount: fixedExpenseAmount(expense),
    }));
    const categoryExpenses = [
      ...monthExpenses.map((expense) => ({ category: expense.category, amount: expense.amount })),
      ...fixedCategoryExpenses,
      ...financialCommitments
        .filter((commitment) => commitment.status !== "finished")
        .map((commitment) => ({
          category: categoryNames.get(commitment.categoryId) || commitment.categoryId || "Parcelas",
          amount: commitment.installmentValue,
        })),
    ];

    const variableSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const fixedTotal = fixedExpenses.reduce((sum, expense) => sum + fixedExpenseAmount(expense), 0);
    const categorySpent = categoryExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const commitmentsTotal = financialCommitments
      .filter((commitment) => commitment.status !== "finished")
      .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
    const committed = fixedTotal + commitmentsTotal;
    const totalSpent = committed + variableSpent;
    const baseIncome = settings.monthlyIncome;
    const extraIncome = monthIncomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const income = baseIncome + extraIncome;
    const available = income - totalSpent;

    const spendByPerson = monthExpenses.reduce((acc, expense) => {
      acc[expense.paidBy] = (acc[expense.paidBy] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const peopleTotals = Object.entries(spendByPerson)
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);
    const categoryTotals = Array.from(
      categoryExpenses.reduce((acc, item) => {
        acc.set(item.category, (acc.get(item.category) || 0) + item.amount);
        return acc;
      }, new Map<string, number>()),
    )
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);

    const dayOfMonth = getDate(paceReferenceDate);
    const daysInMonth = getDaysInMonth(cycleMonthDate);
    const daysLeft = daysInMonth - dayOfMonth;
    const dailyPace = dayOfMonth > 0 ? variableSpent / dayOfMonth : 0;
    const projectedVariable = dailyPace * daysInMonth;
    const projectedLeftover = income - committed - projectedVariable;

    return {
      income,
      baseIncome,
      extraIncome,
      monthIncomeEntries,
      fixedTotal,
      installmentsTotal: commitmentsTotal,
      variableSpent,
      committed,
      totalSpent,
      available,
      monthExpenses,
      categoryExpenses,
      categoryTotals,
      categorySpent,
      peopleTotals,
      daysLeft,
      projectedLeftover,
      dailyPace,
    };
  }, [activeCycle.month, activeCycle.year, categories, currentMonth, cycleMonthDate, expenses, fixedExpenseMonthlyValues, fixedExpenses, financialCommitments, household?.partnerNames, incomeEntries, paceReferenceDate, paymentMethods, settings.monthlyIncome, settings.partnerNames]);

  const monthLabel = format(cycleMonthDate, "MMMM 'de' yyyy", { locale: ptBR });
  const activeMonthKey = `${activeCycle.year}-${String(activeCycle.month).padStart(2, "0")}`;
  const availableColor =
    data.available > 1000
      ? "text-emerald-700"
      : data.available > 0
        ? "text-amber-700"
        : "text-rose-700";

  const projectionTone =
    data.projectedLeftover > 500
      ? "bg-emerald-50 border-emerald-100 text-emerald-900"
      : data.projectedLeftover > 0
        ? "bg-amber-50 border-amber-100 text-amber-900"
        : "bg-rose-50 border-rose-100 text-rose-900";

  const projectionMessage =
    data.projectedLeftover > 0
      ? `Nesse ritmo, a previsão é fechar o mês com ${formatBRL(data.projectedLeftover)} livres.`
      : `Atenção: nesse ritmo, vocês podem ultrapassar em ${formatBRL(Math.abs(data.projectedLeftover))} até o fim do mês.`;

  const hasVisibleData = Boolean(household) || expenses.length > 0 || categories.length > 0 || paymentMethods.length > 0;
  const goalPercent = goalSummary?.targetAmount
    ? Math.min(Math.round((goalSummary.currentAmount / goalSummary.targetAmount) * 100), 100)
    : 0;
  const goalRemaining = goalSummary ? Math.max(goalSummary.targetAmount - goalSummary.currentAmount, 0) : 0;
  const budgetUsage = data.income > 0 ? Math.round((data.totalSpent / data.income) * 100) : 0;
  const topCategory = data.categoryTotals[0];
  const peopleSummary =
    data.peopleTotals.length >= 2
      ? `${data.peopleTotals[0].name} ${formatBRL(data.peopleTotals[0].amount)} · ${data.peopleTotals[1].name} ${formatBRL(data.peopleTotals[1].amount)}`
      : data.peopleTotals[0]
        ? `${data.peopleTotals[0].name} ${formatBRL(data.peopleTotals[0].amount)}`
        : "Nenhum gasto real";
  const toggleDetail = (detail: NonNullable<typeof openDetail>) => {
    setOpenDetail((current) => (current === detail ? null : detail));
  };

  useEffect(() => {
    if (!openDetail) return;

    window.requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [openDetail]);

  return (
    <Layout>
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}
      {loading && !hasVisibleData && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          Preparando seus dados...
        </div>
      )}

      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-stone-500">{monthLabel}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold text-stone-900">Hoje no Together</h1>
          </div>
          <div className="hidden">
            <button
              onClick={() => setShowAddExpense(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Novo gasto
            </button>
            <button
              onClick={() => setShowAddIncome(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Adicionar renda
            </button>
            <button
              onClick={() => setShowCloseMonth(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-700 shadow-sm transition-colors hover:bg-stone-50 sm:w-auto"
            >
              <CalendarCheck className="h-4 w-4" />
              Fechar mês
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <QuickActionCard icon={Plus} label="Novo gasto" helper="Registre um novo gasto" onClick={() => setShowAddExpense(true)} tone="emerald" />
          <QuickActionCard icon={Plus} label="Adicionar renda" helper="Adicione uma nova renda" onClick={() => setShowAddIncome(true)} tone="emerald" />
          <QuickActionCard icon={CalendarCheck} label="Fechar mês" helper="Finalize e veja o resumo do mês" onClick={() => setShowCloseMonth(true)} tone="stone" />
        </div>

        <div className="rounded-[1.75rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 shadow-sm sm:rounded-3xl sm:p-8">
          <div className="flex items-start justify-between gap-3 sm:block">
            <div className="min-w-0">
              <p className="mb-1 text-xs text-stone-600 sm:mb-2 sm:text-sm">Livre para gastar</p>
              <h2 className={`break-words text-3xl font-semibold leading-tight sm:text-5xl lg:text-6xl ${availableColor}`}>{formatBRL(data.available)}</h2>
            </div>
            <span className="shrink-0 rounded-full border border-white/80 bg-white/80 px-3 py-1 text-sm font-medium text-stone-700 shadow-sm sm:hidden">
              {budgetUsage}%
            </span>
          </div>
          <p className="mt-3 hidden text-sm leading-6 text-stone-500 sm:block">
            Calculado com renda planejada, rendas extras do mês, contas fixas, compromissos e gastos reais.
          </p>

          <div className="mt-3 sm:mt-6">
            <div className="mb-2 hidden flex-wrap justify-between gap-2 text-xs text-stone-500 sm:flex">
              <span>Uso do orcamento</span>
              <span>{budgetUsage}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-stone-100 sm:h-2.5">
              <div className="bg-stone-400" style={{ width: `${data.income > 0 ? (data.fixedTotal / data.income) * 100 : 0}%` }} />
              <div className="bg-indigo-400" style={{ width: `${data.income > 0 ? (data.installmentsTotal / data.income) * 100 : 0}%` }} />
              <div className="bg-emerald-400" style={{ width: `${data.income > 0 ? (data.variableSpent / data.income) * 100 : 0}%` }} />
            </div>
            <div className="mt-3 hidden flex-wrap gap-4 text-xs text-stone-600 sm:flex">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-stone-400" /> Fixas</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Compromissos</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Variaveis</span>
            </div>
          </div>

          <div className={`mt-4 rounded-2xl border p-4 ${projectionTone}`}>
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{projectionMessage}</p>
                <p className="mt-1 text-xs opacity-75">
                  Faltam {data.daysLeft} dias. Ritmo atual: {formatBRL(data.dailyPace)} por dia.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryShortcutCard
            icon={Wallet}
            title="Renda do mês"
            value={formatBRL(data.income)}
            detail={`${formatBRL(data.baseIncome)} planejada + ${formatBRL(data.extraIncome)} extras`}
            tone="emerald"
            active={openDetail === "income"}
            onClick={() => toggleDetail("income")}
          />
          <SummaryShortcutCard
            icon={TrendingDown}
            title="Comprometimento"
            value={formatBRL(data.committed)}
            detail={`${formatBRL(data.fixedTotal)} fixas · ${formatBRL(data.installmentsTotal)} compromissos`}
            tone="indigo"
            active={openDetail === "commitments"}
            onClick={() => toggleDetail("commitments")}
          />
          <SummaryShortcutCard
            icon={Plus}
            title="Gastos do mês"
            value={formatBRL(data.categorySpent)}
            detail={`${data.monthExpenses.length} lançamentos`}
            tone="amber"
            active={openDetail === "expenses"}
            onClick={() => toggleDetail("expenses")}
          />
          <SummaryShortcutCard
            icon={Wallet}
            title="Rendas do mês"
            value={formatBRL(data.extraIncome)}
            detail={`${data.monthIncomeEntries.length} rendas extras`}
            tone="blue"
            active={openDetail === "income"}
            onClick={() => toggleDetail("income")}
          />
          <SummaryShortcutCard
            icon={Target}
            title="Meta principal"
            value={goalSummary?.title || "Sem meta"}
            detail={goalSummary ? `Faltam ${formatBRL(goalRemaining)}` : "Criar meta"}
            badge={`${goalPercent}%`}
            tone="rose"
            active={openDetail === "goal"}
            onClick={() => toggleDetail("goal")}
          />
          <SummaryShortcutCard
            icon={Users}
            title="Quem gastou"
            value={peopleSummary}
            detail="Por pessoa no mês"
            tone="yellow"
            active={openDetail === "people"}
            onClick={() => toggleDetail("people")}
          />
          <SummaryShortcutCard
            icon={BarChart3}
            title="Onde está indo"
            value={topCategory?.name || "Sem categoria"}
            detail={topCategory ? formatBRL(topCategory.amount) : "Sem dados"}
            tone="teal"
            active={openDetail === "categories"}
            onClick={() => toggleDetail("categories")}
          />
          <SummaryShortcutCard
            icon={Clock3}
            title="Últimos gastos"
            value={formatBRL(data.variableSpent)}
            detail={`${data.monthExpenses.length} lançamentos`}
            tone="pink"
            active={openDetail === "expenses"}
            onClick={() => toggleDetail("expenses")}
          />
        </div>

        {openDetail ? (
          <div ref={detailPanelRef} className="scroll-mt-24 rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            {openDetail === "income" ? (
              <DetailPanel title="Rendas do mês" icon={Wallet} tone="blue" actionLabel="Adicionar renda" onAction={() => setShowAddIncome(true)}>
                {data.monthIncomeEntries.length === 0 ? (
                  <p className="text-sm text-stone-500">Nenhuma renda extra lançada neste mês.</p>
                ) : (
                  <div className="space-y-2">
                    {data.monthIncomeEntries.map((entry) => (
                      <div key={entry.id} className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium text-stone-900">{entry.description || "Renda"}</p>
                          <p className="break-words text-xs text-stone-500">
                            {format(parseISO(entry.date), "dd 'de' MMM", { locale: ptBR })} · {entry.sourceType} {entry.receivedBy ? `· ${entry.receivedBy}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:justify-end">
                          <span className="font-semibold text-emerald-700">{formatBRL(entry.amount)}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteIncomeEntry(entry.id);
                                toast.success("Renda removida.");
                              } catch (err) {
                                toast.error((err as Error)?.message || "Não foi possível remover a renda.");
                              }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                            aria-label="Excluir renda"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailPanel>
            ) : null}

            {openDetail === "commitments" ? (
              <DetailPanel title="Comprometimento" icon={TrendingDown} tone="indigo" actionLabel="Ver parcelas" onAction={() => navigate("/installments")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniMetric title="Contas fixas" value={formatBRL(data.fixedTotal)} />
                  <MiniMetric title="Compromissos" value={formatBRL(data.installmentsTotal)} />
                </div>
              </DetailPanel>
            ) : null}

            {openDetail === "goal" ? (
              <DetailPanel title="Meta principal" icon={Target} tone="rose" actionLabel="Abrir metas" onAction={() => navigate("/goals")}>
                {goalSummary ? (
                  <div className="space-y-4">
                    <div>
                      <p className="break-words text-base font-semibold text-stone-900">{goalSummary.title}</p>
                      <p className="mt-1 text-xs text-stone-500">{goalSummary.label}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-stone-900">
                          {formatBRL(goalSummary.currentAmount)} de {formatBRL(goalSummary.targetAmount)}
                        </span>
                        <span className="text-xs text-stone-500">Faltam {formatBRL(goalRemaining)}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-stone-100">
                        <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${goalPercent}%` }} />
                      </div>
                    </div>
                    <Link
                      to="/goals"
                      state={{ openContribution: "main" }}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar valor
                    </Link>
                  </div>
                ) : (
                  <Link
                    to="/goals"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                  >
                    <Plus className="h-4 w-4" />
                    Criar meta
                  </Link>
                )}
              </DetailPanel>
            ) : null}

            {openDetail === "people" ? (
              <DetailPanel title="Quem gastou" icon={Users} tone="yellow">
                {data.peopleTotals.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.peopleTotals.slice(0, 2).map((person, index) => (
                      <PartnerCard key={person.name} name={person.name} amount={person.amount} total={data.variableSpent} tone={index % 2 === 0 ? "emerald" : "indigo"} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">Nenhum gasto real encontrado para mostrar este card.</p>
                )}
              </DetailPanel>
            ) : null}

            {openDetail === "categories" ? (
              <DetailPanel title="Onde está indo" icon={BarChart3} tone="teal">
                <CategoryBreakdown expenses={data.categoryExpenses} />
              </DetailPanel>
            ) : null}

            {openDetail === "expenses" ? (
              <DetailPanel title="Últimos gastos" icon={Clock3} tone="pink">
                <RecentExpenses expenses={expenses} defaultMonth={activeMonthKey} />
              </DetailPanel>
            ) : null}
          </div>
        ) : null}
      </div>

      {showAddIncome && (
        <AddIncomeEntryModal
          partnerNames={household?.partnerNames ?? settings.partnerNames}
          onClose={() => setShowAddIncome(false)}
          onSave={async (entry) => {
            await addIncomeEntry(entry);
            toast.success("Renda adicionada.");
          }}
        />
      )}
      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}
      {showCloseMonth && (
        <CloseMonthModal
          monthLabel={monthLabel}
          data={data}
          onClose={() => {
            setShowCloseMonth(false);
            setClosedSnapshot(null);
          }}
          onConfirm={async () => {
            const snapshot = await closeMonth();
            setClosedSnapshot(snapshot);
            toast.success("Mês fechado com sucesso.");
          }}
          onOpenNextMonth={async () => {
            await openNextMonth();
            toast.success("Próximo mês aberto.");
            setShowCloseMonth(false);
            setClosedSnapshot(null);
          }}
          closedSnapshot={closedSnapshot}
        />
      )}
    </Layout>
  );
}

function PartnerCard({
  name,
  amount,
  total,
  tone,
}: {
  name: string;
  amount: number;
  total: number;
  tone: "emerald" | "indigo";
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  const toneMap = {
    emerald: { bar: "bg-emerald-400", bg: "bg-emerald-50" },
    indigo: { bar: "bg-indigo-400", bg: "bg-indigo-50" },
  } as const;

  return (
    <div className={`${toneMap[tone].bg} rounded-xl p-4`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-medium text-stone-800">{name}</p>
        <p className="text-xs text-stone-500">{pct.toFixed(0)}%</p>
      </div>
      <p className="mb-3 break-words text-xl font-semibold text-stone-900 sm:text-2xl">{formatBRL(amount)}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
        <div className={`h-full rounded-full transition-all ${toneMap[tone].bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  helper,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  helper: string;
  tone: "emerald" | "blue" | "stone";
  onClick: () => void;
}) {
  const toneMap = {
    emerald: {
      card: "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 text-emerald-700",
      icon: "text-emerald-700",
      helper: "text-stone-600",
    },
    blue: {
      card: "border-sky-100 bg-gradient-to-br from-sky-50 via-white to-sky-50 text-sky-700",
      icon: "text-sky-700",
      helper: "text-stone-600",
    },
    stone: {
      card: "border-stone-200 bg-white text-stone-900",
      icon: "text-stone-700",
      helper: "text-stone-600",
    },
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[11.5rem] flex-col items-center justify-start rounded-[1.65rem] border px-2.5 pb-4 pt-5 text-center shadow-sm transition-transform active:scale-[0.98] ${toneMap[tone].card}`}
    >
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-stone-100 bg-white shadow-[0_10px_24px_rgba(28,25,23,0.08)]">
        <Icon className={`h-8 w-8 ${toneMap[tone].icon}`} strokeWidth={1.8} />
      </span>
      <span className="block min-h-[2.5rem] text-[1.05rem] font-semibold leading-tight">{label}</span>
      <span className={`mt-2 block text-[0.95rem] leading-snug ${toneMap[tone].helper}`}>{helper}</span>
    </button>
  );
}

function SummaryShortcutCard({
  icon: Icon,
  title,
  value,
  detail,
  badge,
  tone,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  detail: string;
  badge?: string;
  tone: "emerald" | "indigo" | "amber" | "blue" | "rose" | "yellow" | "teal" | "pink";
  active?: boolean;
  onClick: () => void;
}) {
  const toneMap = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    yellow: "border-yellow-100 bg-yellow-50 text-yellow-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
    pink: "border-pink-100 bg-pink-50 text-pink-700",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-[10rem] flex-col justify-between rounded-[1.5rem] border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] ${toneMap[tone]} ${active ? "ring-2 ring-stone-900/10" : ""}`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-5 w-5 shrink-0" />
          <span className="break-words text-sm font-medium leading-tight">{title}</span>
        </span>
        {badge ? (
          <span className="shrink-0 rounded-full bg-white/75 px-2 py-0.5 text-xs font-semibold text-stone-700 shadow-sm">{badge}</span>
        ) : null}
      </span>
      <span>
        <span className="line-clamp-2 block break-words text-xl font-semibold leading-tight text-stone-950">{value}</span>
        <span className="mt-2 line-clamp-2 block break-words text-xs leading-snug text-stone-600">{detail}</span>
      </span>
      <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
        Ver detalhes
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function DetailPanel({
  icon: Icon,
  title,
  tone,
  actionLabel,
  onAction,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone: "emerald" | "indigo" | "amber" | "blue" | "rose" | "yellow" | "teal" | "pink";
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const toneMap = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue: "border-sky-100 bg-sky-50 text-sky-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    yellow: "border-yellow-100 bg-yellow-50 text-yellow-700",
    teal: "border-teal-100 bg-teal-50 text-teal-700",
    pink: "border-pink-100 bg-pink-50 text-pink-700",
  } as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="break-words text-lg font-semibold text-stone-950">{title}</h2>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
      <p className="text-xs text-stone-500">{title}</p>
      <p className="mt-1 break-words text-xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function AddIncomeEntryModal({
  partnerNames,
  onClose,
  onSave,
}: {
  partnerNames: [string, string] | string[];
  onClose: () => void;
  onSave: (entry: {
    amount: number;
    date: string;
    description: string;
    sourceType: string;
    receivedBy: string;
    recurringMonthly: boolean;
  }) => Promise<void>;
}) {
  const people = partnerNames.filter(Boolean);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("extra");
  const [receivedBy, setReceivedBy] = useState(people[0] || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedAmount = Number(amount.replace(",", "."));
    if (!normalizedAmount || normalizedAmount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        amount: normalizedAmount,
        date,
        description: description.trim() || "Renda",
        sourceType,
        receivedBy,
        recurringMonthly: false,
      });
      onClose();
    } catch (err) {
      toast.error((err as Error)?.message || "Não foi possível adicionar a renda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Adicionar renda</h2>
            <p className="mt-1 text-sm text-stone-500">Registre renda variável, extra, comissão, freela ou reembolso.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="text-stone-400 transition-colors hover:text-stone-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Valor</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: Corridas Uber, freela, bônus"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Tipo</label>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="extra">Extra</option>
                <option value="trabalho">Trabalho variável</option>
                <option value="freela">Freela</option>
                <option value="comissao">Comissão</option>
                <option value="venda">Venda</option>
                <option value="reembolso">Reembolso</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Data</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Quem recebeu</label>
            <select
              value={receivedBy}
              onChange={(event) => setReceivedBy(event.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {people.length === 0 && <option value="">Casa</option>}
              {people.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Salvando..." : "Adicionar renda"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CloseMonthModal({
  monthLabel,
  data,
  onClose,
  onConfirm,
  onOpenNextMonth,
  closedSnapshot,
}: {
  monthLabel: string;
  data: {
    income: number;
    baseIncome: number;
    extraIncome: number;
    variableSpent: number;
    fixedTotal: number;
    installmentsTotal: number;
    available: number;
    categoryExpenses: Array<{ category: string; amount: number }>;
    peopleTotals: Array<{ name: string; amount: number }>;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onOpenNextMonth: () => Promise<void>;
  closedSnapshot: MonthlySnapshotModel | null;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const categoryTotals = Array.from(
    data.categoryExpenses.reduce((acc, item) => {
      acc.set(item.category, (acc.get(item.category) || 0) + item.amount);
      return acc;
    }, new Map<string, number>()),
  ).sort((a, b) => b[1] - a[1]);

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm();
    } catch (err) {
      toast.error((err as Error)?.message || "Não foi possível fechar o mês.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenNextMonth = async () => {
    setIsSaving(true);
    try {
      await onOpenNextMonth();
    } catch (err) {
      toast.error((err as Error)?.message || "Não foi possível abrir o próximo mês.");
    } finally {
      setIsSaving(false);
    }
  };

  const nextMonthLabel = closedSnapshot
    ? format(new Date(nextCycle({ month: closedSnapshot.month, year: closedSnapshot.year }).year, nextCycle({ month: closedSnapshot.month, year: closedSnapshot.year }).month - 1, 1), "MMMM 'de' yyyy", { locale: ptBR })
    : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => {
        if (!isSaving) onClose();
      }}
    >
      <div className="max-h-[100dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">{closedSnapshot ? `${monthLabel} fechado` : `Fechar ${monthLabel}`}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {closedSnapshot ? "Histórico salvo. Agora você pode abrir o próximo mês." : "Confira o resumo antes de salvar o fechamento."}
            </p>
          </div>
          <button disabled={isSaving} onClick={onClose} className="text-stone-400 transition-colors hover:text-stone-600 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {closedSnapshot ? (
          <>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
              {monthLabel} foi fechado com snapshot. Os gastos continuam preservados no histórico.
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button disabled={isSaving} onClick={onClose} className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50">
                Ver depois
              </button>
              <button disabled={isSaving} onClick={handleOpenNextMonth} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                {isSaving ? "Abrindo..." : `Abrir ${nextMonthLabel}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SummaryLine label="Renda real" value={data.income} />
              <SummaryLine label="Rendas extras" value={data.extraIncome} />
              <SummaryLine label="Gastos variáveis" value={data.variableSpent} />
              <SummaryLine label="Contas fixas" value={data.fixedTotal} />
              <SummaryLine label="Parcelas/compromissos" value={data.installmentsTotal} />
              <SummaryLine label="Saldo restante" value={data.available} strong />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SummaryList title="Gastos por categoria" rows={categoryTotals.map(([name, amount]) => ({ name, amount }))} />
              <SummaryList title="Gastos por pessoa" rows={data.peopleTotals} />
            </div>

            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              Ao confirmar, este mês será salvo no histórico. Você poderá reabrir o mês pelo histórico se tiver fechado sem querer.
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button disabled={isSaving} onClick={onClose} className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50">
                Cancelar
              </button>
              <button disabled={isSaving} onClick={handleConfirm} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                {isSaving ? "Fechando..." : "Confirmar fechamento"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`mt-1 break-words text-sm ${strong ? "font-semibold text-stone-950" : "font-medium text-stone-900"}`}>{formatBRL(value)}</p>
    </div>
  );
}

function SummaryList({ title, rows }: { title: string; rows: Array<{ name: string; amount: number }> }) {
  return (
    <div className="rounded-xl border border-stone-100 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-stone-500">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-500">Sem dados neste mês.</p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 break-words text-stone-700">{row.name}</span>
              <span className="shrink-0 font-medium text-stone-900">{formatBRL(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


