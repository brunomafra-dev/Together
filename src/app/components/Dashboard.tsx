import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { endOfMonth, format, getDate, getDaysInMonth, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, Plus, Sparkles, Trash2, TrendingDown, Users, Wallet, X } from "lucide-react";
import { Link } from "react-router";
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-stone-500">{monthLabel}</p>
            <h1 className="mt-1 break-words text-2xl font-semibold text-stone-900">Resumo do mês</h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
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

        <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-white to-stone-50 p-4 sm:rounded-3xl sm:p-8">
          <p className="mb-1.5 text-xs text-stone-600 sm:mb-2 sm:text-sm">Livre para gastar</p>
          <h2 className={`break-words text-3xl font-semibold leading-tight sm:text-5xl lg:text-6xl ${availableColor}`}>{formatBRL(data.available)}</h2>
          <p className="mt-2 text-xs leading-5 text-stone-500 sm:mt-3 sm:text-sm sm:leading-6">
            Calculado com renda planejada, rendas extras do mês, contas fixas, compromissos e gastos reais.
          </p>

          <div className="mt-4 sm:mt-6">
            <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-stone-500">
              <span>Uso do orcamento</span>
              <span>{data.income > 0 ? `${((data.totalSpent / data.income) * 100).toFixed(0)}%` : "0%"}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-stone-100 sm:h-2.5">
              <div className="bg-stone-400" style={{ width: `${data.income > 0 ? (data.fixedTotal / data.income) * 100 : 0}%` }} />
              <div className="bg-indigo-400" style={{ width: `${data.income > 0 ? (data.installmentsTotal / data.income) * 100 : 0}%` }} />
              <div className="bg-emerald-400" style={{ width: `${data.income > 0 ? (data.variableSpent / data.income) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-stone-600 sm:mt-3 sm:gap-4 sm:text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-stone-400" /> Fixas</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Compromissos</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Variaveis</span>
            </div>
          </div>
        </div>

        <div className={`rounded-2xl border p-5 ${projectionTone}`}>
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{projectionMessage}</p>
              <p className="mt-1 text-xs opacity-75">
                Faltam {data.daysLeft} dias. Ritmo atual: {formatBRL(data.dailyPace)} por dia.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Wallet className="h-4 w-4" />
              Renda do mês
            </div>
            <p className="break-words text-lg font-semibold text-stone-900 sm:text-xl">{formatBRL(data.income)}</p>
            <p className="mt-1 text-xs text-stone-500">
              {formatBRL(data.baseIncome)} planejada + {formatBRL(data.extraIncome)} rendas extras
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <TrendingDown className="h-4 w-4" />
              Comprometimento
            </div>
            <p className="break-words text-lg font-semibold text-stone-900 sm:text-xl">{formatBRL(data.committed)}</p>
            <p className="mt-1 text-xs text-stone-500">
              {formatBRL(data.fixedTotal)} fixas - {formatBRL(data.installmentsTotal)} compromissos
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Plus className="h-4 w-4" />
              Gastos do mês
            </div>
            <p className="break-words text-lg font-semibold text-stone-900 sm:text-xl">{formatBRL(data.categorySpent)}</p>
          </div>
        </div>

        <ExpandableSection
          title="Rendas do mês"
          summary={`${data.monthIncomeEntries.length} rendas · ${formatBRL(data.extraIncome)}`}
          defaultOpen={data.monthIncomeEntries.length > 0}
        >
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
        </ExpandableSection>

        <ExpandableSection
          title="Meta principal"
          summary={
            goalSummary
              ? `${goalSummary.title} · ${goalPercent}% · faltam ${formatBRL(goalRemaining)}`
              : "Sem meta cadastrada"
          }
          defaultOpen
          actions={
            goalSummary ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {goalPercent}%
              </span>
            ) : null
          }
        >
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-stone-500">
                  {goalSummary.planNames.length} {goalSummary.planNames.length === 1 ? "meta futura cadastrada" : "metas futuras cadastradas"}
                </p>
                <Link
                  to="/goals"
                  state={{ openContribution: "main" }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar valor
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-stone-500">Sem meta cadastrada</p>
              <Link
                to="/goals"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Plus className="h-4 w-4" />
                Criar meta
              </Link>
            </div>
          )}
        </ExpandableSection>

        <ExpandableSection
          title="Quem gastou"
          summary={
            data.peopleTotals.length >= 2
              ? `${data.peopleTotals[0].name} ${formatBRL(data.peopleTotals[0].amount)} · ${data.peopleTotals[1].name} ${formatBRL(data.peopleTotals[1].amount)}`
              : data.peopleTotals[0]
                ? `${data.peopleTotals[0].name} ${formatBRL(data.peopleTotals[0].amount)}`
                : "Nenhum gasto real no mês"
          }
        >
          {data.peopleTotals.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.peopleTotals.slice(0, 2).map((person, index) => (
                <PartnerCard
                  key={person.name}
                  name={person.name}
                  amount={person.amount}
                  total={data.variableSpent}
                  tone={index % 2 === 0 ? "emerald" : "indigo"}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500">Nenhum gasto real encontrado para mostrar este card.</p>
          )}
        </ExpandableSection>

        <ExpandableSection
          title="Onde está indo"
          summary={
            data.categoryTotals[0]
              ? `Maior categoria: ${data.categoryTotals[0].name} · ${formatBRL(data.categoryTotals[0].amount)}`
              : "Sem categorias no ciclo"
          }
        >
          <CategoryBreakdown expenses={data.categoryExpenses} />
        </ExpandableSection>

        <ExpandableSection
          title="Últimos gastos"
          summary={`${monthLabel} · ${data.monthExpenses.length} lançamentos · ${formatBRL(data.variableSpent)}`}
          defaultOpen
        >
          <RecentExpenses expenses={expenses} defaultMonth={activeMonthKey} />
        </ExpandableSection>
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


