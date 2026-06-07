import { useEffect, useMemo, useState } from "react";
import { endOfMonth, getDate, getDaysInMonth, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { Edit3, Plus, Sparkles, Target, TrendingDown, Wallet, X, Save } from "lucide-react";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

type GoalTone = "stone" | "emerald" | "cyan" | "amber" | "indigo";

type PlanCard = {
  id?: string;
  name: string;
  share: string;
  percent: number;
  amount: number;
  currentAmount: number;
  tone: GoalTone;
};

type ProgressRow = {
  id?: string;
  localId?: string;
  name: string;
  planned: number;
  realized: number;
  status: string;
};

type GoalSnapshot = {
  id?: string;
  title: string;
  label: string;
  current: number;
  total: number;
  householdIncome: number;
  planCards: PlanCard[];
  progressRows: ProgressRow[];
  financialHealth: { score: number; label: string; description: string };
  monthRadar: { label: string; summary: string; note: string };
  insights: Array<{ kind: "info" | "positive"; text: string }>;
  suggestion: {
    title: string;
    note: string;
    allocations: Array<{ name: string; share: string; percent: number; tone: GoalTone }>;
  };
};

const DEFAULT_ALLOCATIONS: GoalSnapshot["suggestion"]["allocations"] = [
  { name: "Moradia", share: "35%", percent: 35, tone: "stone" },
  { name: "Alimentação", share: "20%", percent: 20, tone: "emerald" },
  { name: "Investimentos", share: "15%", percent: 15, tone: "cyan" },
  { name: "Lazer", share: "10%", percent: 10, tone: "amber" },
  { name: "Outros", share: "20%", percent: 20, tone: "indigo" },
];

function toneClass(tone: GoalTone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 border-emerald-100 text-emerald-900";
    case "cyan":
      return "bg-cyan-50 border-cyan-100 text-cyan-900";
    case "amber":
      return "bg-amber-50 border-amber-100 text-amber-900";
    case "indigo":
      return "bg-indigo-50 border-indigo-100 text-indigo-900";
    default:
      return "bg-stone-50 border-stone-200 text-stone-900";
  }
}

function emptyGoal(income: number): GoalSnapshot {
  return {
    title: "Nenhuma meta cadastrada",
    label: "Começar do zero",
    current: 0,
    total: 0,
    householdIncome: income,
    planCards: DEFAULT_ALLOCATIONS.map((item) => ({
      name: item.name,
      share: "0%",
      percent: 0,
      amount: 0,
      currentAmount: 0,
      tone: item.tone,
    })),
    progressRows: [
      { name: "Meta 1", planned: 0, realized: 0, status: "Sem meta cadastrada" },
      { name: "Meta 2", planned: 0, realized: 0, status: "Sem meta cadastrada" },
      { name: "Meta 3", planned: 0, realized: 0, status: "Sem meta cadastrada" },
      { name: "Meta 4", planned: 0, realized: 0, status: "Sem meta cadastrada" },
      { name: "Meta 5", planned: 0, realized: 0, status: "Sem meta cadastrada" },
    ],
    financialHealth: {
      score: 0,
      label: "Sem dados",
      description: "Ainda não há metas salvas para calcular a saúde financeira.",
    },
    monthRadar: {
      label: "Radar do mês",
      summary: "Cadastre sua primeira meta para gerar projeções e leituras reais.",
      note: "A tela fica zerada até existir dado do usuário.",
    },
    insights: [
      { kind: "info", text: "Nenhuma meta cadastrada ainda." },
      { kind: "info", text: "Os valores exibidos ficam zerados até o primeiro cadastro." },
      { kind: "positive", text: "Use a sugestão abaixo como base, mas vocês podem dividir como quiserem." },
    ],
    suggestion: {
      title: "Sugestão de base saudável",
      note: "A divisão abaixo reflete a base atual de vocês. Ela pode servir como ponto de partida, mas o casal/família continua livre para ajustar como quiser.",
      allocations: DEFAULT_ALLOCATIONS,
    },
  };
}

function buildSuggestedPlan(income: number): PlanCard[] {
  return DEFAULT_ALLOCATIONS.map((item) => ({
    name: item.name,
    share: item.share,
    percent: item.percent,
    amount: income * (item.percent / 100),
    currentAmount: 0,
    tone: item.tone,
  }));
}

function SectionHeader({ icon: Icon, title, actionLabel, onAction }: { icon: typeof Target; title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
        <Icon className="h-5 w-5 text-stone-500" />
        <span>{title}</span>
      </div>
      {actionLabel ? (
        <button type="button" onClick={onAction} className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
          <Edit3 className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-4 h-2 rounded-full bg-stone-100">
      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

function buildPercentText(percent: number) {
  return `${Math.max(0, Math.round(percent))}%`;
}

export function Goals() {
  const { household, settings, expenses, fixedExpenses, installments, categories } = useFinance();
  const [goal, setGoal] = useState<GoalSnapshot | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const income = settings.monthlyIncome || household?.monthlyIncome || 0;
  const snapshot = goal ?? emptyGoal(income);
  const fallbackPlanCards = useMemo(() => buildSuggestedPlan(income), [income]);
  const mainGoalPercent = snapshot.total > 0 ? Math.round((snapshot.current / snapshot.total) * 100) : 0;
  const mainGoalRemaining = Math.max(snapshot.total - snapshot.current, 0);
  const planCards = goal?.planCards.length ? snapshot.planCards : fallbackPlanCards;
  const financialData = useMemo(() => {
    const now = new Date();
    const currentMonth = { start: startOfMonth(now), end: endOfMonth(now) };
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const monthExpenses = expenses.filter((expense) =>
      isWithinInterval(parseISO(expense.date), currentMonth),
    );
    const variableSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const fixedSpent = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const installmentSpent = installments.reduce((sum, installment) => sum + installment.monthlyAmount, 0);
    const totalSpent = fixedSpent + variableSpent + installmentSpent;
    const remainingBalance = income - totalSpent;
    const dayOfMonth = Math.max(getDate(now), 1);
    const daysInMonth = getDaysInMonth(now);
    const projectedVariable = (variableSpent / dayOfMonth) * daysInMonth;
    const projectedEndBalance = income - fixedSpent - installmentSpent - projectedVariable;
    const categoryTotals = new Map<string, number>();

    for (const expense of monthExpenses) {
      const name = categoryNames.get(expense.category) || expense.category || "Sem categoria";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + expense.amount);
    }

    for (const expense of fixedExpenses) {
      const name = expense.category || "Sem categoria";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + expense.amount);
    }

    for (const installment of installments) {
      const name = categoryNames.get(installment.category) || installment.category || "Parcelas";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + installment.monthlyAmount);
    }

    const sortedCategories = Array.from(categoryTotals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);
    const highestCategory = sortedCategories[0] ?? null;
    const lowestCategory = sortedCategories.length > 1 ? sortedCategories[sortedCategories.length - 1] : null;
    const healthScore = income > 0 ? Math.max(0, Math.min(100, Math.round((remainingBalance / income) * 100))) : 0;
    const spendingTrend =
      projectedEndBalance >= remainingBalance
        ? "Ritmo estável para o restante do mês."
        : projectedEndBalance >= 0
          ? "Atenção: o ritmo atual reduz a sobra até o fim do mês."
          : "Alerta: nesse ritmo, o mês pode fechar no negativo.";

    return {
      variableSpent,
      fixedSpent,
      installmentSpent,
      totalSpent,
      categoryTotals: sortedCategories,
      remainingBalance,
      projectedEndBalance,
      highestCategory,
      lowestCategory,
      healthScore,
      spendingTrend,
    };
  }, [categories, expenses, fixedExpenses, installments, income]);

  const [title, setTitle] = useState(snapshot.title);
  const [label, setLabel] = useState(snapshot.label);
  const [current, setCurrent] = useState(String(snapshot.current));
  const [total, setTotal] = useState(String(snapshot.total || income || 0));
  const [progressRows, setProgressRows] = useState<ProgressRow[]>(snapshot.progressRows);
  const [planningAllocations, setPlanningAllocations] = useState<PlanCard[]>(planCards);

  useEffect(() => {
    const load = async () => {
      if (!household?.id) return;
      const goals = await financeService.fetchGoals(household.id).catch(() => []);
      const currentGoal = goals[0];
      if (!currentGoal) {
        const fallback = emptyGoal(income);
        setGoal(null);
        setTitle(fallback.title);
        setLabel(fallback.label);
        setCurrent("0");
        setTotal(String(income || 0));
        setProgressRows(fallback.progressRows);
        setPlanningAllocations(fallbackPlanCards);
        return;
      }

      const planItems = await financeService.fetchGoalPlanItems(currentGoal.id).catch(() => []);
      const rows = await financeService.fetchGoalProgressRows(currentGoal.id).catch(() => []);
      const resolvedPlanCards = planItems.length
        ? planItems.map((item) => ({
            id: item.id,
            name: item.name,
            share: item.share,
            percent: Number(item.share.replace("%", "")) || 0,
            amount: item.amount,
            currentAmount: 0,
            tone: item.tone,
          }))
        : buildSuggestedPlan(income);

      setGoal({
        id: currentGoal.id,
        title: currentGoal.title,
        label: currentGoal.label,
        current: currentGoal.currentAmount,
        total: currentGoal.targetAmount,
        householdIncome: income,
        planCards: resolvedPlanCards,
        progressRows: rows.length
          ? rows.map((row) => ({
              id: row.id,
              name: row.name,
              planned: row.planned,
              realized: row.realized,
              status: row.status,
            }))
          : [],
        financialHealth: {
          score: rows.length
            ? Math.round(rows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / rows.length)
            : 0,
          label: "Saúde financeira",
          description: currentGoal.targetAmount > 0
            ? `Você atingiu ${Math.round((currentGoal.currentAmount / currentGoal.targetAmount) * 100)}% da meta ${currentGoal.title}.`
            : "Defina um valor alvo para acompanhar o progresso.",
        },
        monthRadar: {
          label: "Radar do mês",
          summary: currentGoal.targetAmount > currentGoal.currentAmount
            ? `Faltam ${formatBRL(currentGoal.targetAmount - currentGoal.currentAmount)} para atingir a meta ${currentGoal.title}.`
            : "Meta concluída. Vocês chegaram ao valor definido.",
          note: rows.length > 0 ? `${rows.length} meta${rows.length === 1 ? "" : "s"} futura${rows.length === 1 ? "" : "s"} acompanhando esse objetivo.` : "Adicione metas futuras para dividir esse objetivo em etapas menores.",
        },
        insights: [],
        suggestion: emptyGoal(income).suggestion,
      });

      setTitle(currentGoal.title);
      setLabel(currentGoal.label);
      setCurrent(String(currentGoal.currentAmount));
      setTotal(String(currentGoal.targetAmount));
      setProgressRows(
        rows.length
          ? rows.map((row) => ({
              id: row.id,
              name: row.name,
              planned: row.planned,
              realized: row.realized,
              status: row.status,
            }))
          : [],
      );
      setPlanningAllocations(resolvedPlanCards);
    };

    void load();
  }, [household?.id, income, fallbackPlanCards]);

  const openGoalEdit = () => setEditingGoal(true);
  const openPlanningEdit = () => setEditingPlanning(true);
  const closeGoalEdit = () => {
    setEditingGoal(false);
    setFormError(null);
  };
  const closePlanningEdit = () => {
    setEditingPlanning(false);
    setFormError(null);
  };

  const handleDeleteGoal = async () => {
    if (!goal?.id) return;
    if (!window.confirm("Excluir esta meta?")) return;

    setSaving(true);
    setFormError(null);
    try {
      await financeService.deleteGoal(goal.id);
      setGoal(null);
      setTitle(emptyGoal(income).title);
      setLabel(emptyGoal(income).label);
      setCurrent("0");
      setTotal(String(income || 0));
      setProgressRows(emptyGoal(income).progressRows);
      setPlanningAllocations(fallbackPlanCards);
      setEditingGoal(false);
      setEditingPlanning(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível excluir a meta.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgressRow = (rowIndex: number) => {
    setProgressRows((prev) => prev.filter((_, index) => index !== rowIndex));
    setGoal((prev) =>
      prev
        ? {
            ...prev,
            progressRows: prev.progressRows.filter((_, index) => index !== rowIndex),
          }
        : prev,
    );
  };

  const handleAddSubGoal = () => {
    setProgressRows((prev) => [
      ...prev,
      { localId: crypto.randomUUID(), name: "Nova meta futura", planned: 0, realized: 0, status: "Em andamento" },
    ]);
  };

  const openFutureGoalAdd = () => {
    setEditingGoal(true);
  };

  const updateProgressRow = (index: number, patch: Partial<ProgressRow>) => {
    setProgressRows((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSaveGoal = async () => {
    const householdId = household?.id;
    if (!householdId) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        householdId,
        title: title.trim() || "Meta principal",
        label: label.trim() || "Planejamento",
        currentAmount: Number(current) || 0,
        targetAmount: Number(total) || 0,
      };

      let savedGoal = goal?.id
        ? await financeService.updateGoal(goal.id, payload)
        : await financeService.addGoal(payload);

      const existingProgress = goal?.id ? await financeService.fetchGoalProgressRows(savedGoal.id).catch(() => []) : [];
      for (const row of existingProgress) {
        await financeService.deleteGoalProgressRow(row.id);
      }
      for (const row of progressRows) {
        await financeService.addGoalProgressRow(savedGoal.id, {
          name: row.name.trim() || "Meta",
          planned: Number(row.planned) || 0,
          realized: Number(row.realized) || 0,
          status: row.status || "Em andamento",
        });
      }

      const planItems = await financeService.fetchGoalPlanItems(savedGoal.id).catch(() => []);
      const rows = await financeService.fetchGoalProgressRows(savedGoal.id).catch(() => []);
      const resolvedPlanCards = planItems.length
        ? planItems.map((item) => ({
            id: item.id,
            name: item.name,
            share: item.share,
            percent: Number(item.share.replace("%", "")) || 0,
            amount: item.amount,
            currentAmount: 0,
            tone: item.tone,
          }))
        : buildSuggestedPlan(income);

      setGoal({
        id: savedGoal.id,
        title: savedGoal.title,
        label: savedGoal.label,
        current: savedGoal.currentAmount,
        total: savedGoal.targetAmount,
        householdIncome: income,
        planCards: resolvedPlanCards,
        progressRows: rows.map((row) => ({
          id: row.id,
          name: row.name,
          planned: row.planned,
          realized: row.realized,
          status: row.status,
        })),
        financialHealth: {
          score: rows.length
            ? Math.round(rows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / rows.length)
            : 0,
          label: "Saúde financeira",
          description: savedGoal.targetAmount > 0
            ? `Você atingiu ${Math.round((savedGoal.currentAmount / savedGoal.targetAmount) * 100)}% da meta ${savedGoal.title}.`
            : "Defina um valor alvo para acompanhar o progresso.",
        },
        monthRadar: {
          label: "Radar do mês",
          summary: savedGoal.targetAmount > savedGoal.currentAmount
            ? `Faltam ${formatBRL(savedGoal.targetAmount - savedGoal.currentAmount)} para atingir a meta ${savedGoal.title}.`
            : "Meta concluída. Vocês chegaram ao valor definido.",
          note: rows.length > 0 ? `${rows.length} meta${rows.length === 1 ? "" : "s"} futura${rows.length === 1 ? "" : "s"} acompanhando esse objetivo.` : "Adicione metas futuras para dividir esse objetivo em etapas menores.",
        },
        insights: [],
        suggestion: emptyGoal(income).suggestion,
      });
      closeGoalEdit();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePlanning = async () => {
    const householdId = household?.id;
    if (!householdId || !goal?.id) return;
    setSaving(true);
    setFormError(null);
    try {
      const planCardsPercent = planningAllocations.reduce((sum, item) => sum + item.percent, 0);
      const normalizedAllocations = planCardsPercent > 0 ? planningAllocations : buildSuggestedPlan(income);

      const existingPlan = await financeService.fetchGoalPlanItems(goal.id).catch(() => []);
      for (const item of existingPlan) {
        await financeService.deleteGoalPlanItem(item.id);
      }
      for (const item of normalizedAllocations) {
        await financeService.addGoalPlanItem(goal.id, {
          name: item.name,
          share: buildPercentText(item.percent),
          amount: income * (item.percent / 100),
          tone: item.tone,
        });
      }

      const planItems = await financeService.fetchGoalPlanItems(goal.id).catch(() => []);
      const resolvedPlanCards = planItems.length
        ? planItems.map((item) => ({
            id: item.id,
            name: item.name,
            share: item.share,
            percent: Number(item.share.replace("%", "")) || 0,
            amount: item.amount,
            currentAmount: 0,
            tone: item.tone,
          }))
        : buildSuggestedPlan(income);

      setGoal((prev) => prev ? { ...prev, planCards: resolvedPlanCards, householdIncome: income } : prev);
      setPlanningAllocations(resolvedPlanCards);
      closePlanningEdit();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-7">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Metas</h1>
          <p className="text-sm text-stone-600">Como o ritmo de vocês conversa com os planos do casal</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Saúde financeira
                </div>
                <h3 className="break-words text-xl font-medium text-stone-950 sm:text-2xl">{formatBRL(financialData.remainingBalance)} livres neste mês</h3>
                <p className="text-sm text-stone-600">
                  Renda {formatBRL(income)} - fixas {formatBRL(financialData.fixedSpent)} - variáveis {formatBRL(financialData.variableSpent)} - parcelas {formatBRL(financialData.installmentSpent)}.
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="break-words text-4xl font-semibold text-teal-700 sm:text-5xl">{financialData.healthScore}%</div>
                <p className="text-sm text-stone-500">da renda livre</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-medium text-stone-950">Radar do mês</h3>
                <p className="text-sm text-stone-600">Categorias, tendência e saldo projetado</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Maior gasto</p>
                <p className="mt-2 break-words text-sm font-semibold text-stone-950">{financialData.highestCategory?.name ?? "Sem gastos"}</p>
                <p className="break-words text-sm text-stone-600">{formatBRL(financialData.highestCategory?.amount ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Menor gasto</p>
                <p className="mt-2 break-words text-sm font-semibold text-stone-950">{financialData.lowestCategory?.name ?? "Sem comparação"}</p>
                <p className="break-words text-sm text-stone-600">{formatBRL(financialData.lowestCategory?.amount ?? 0)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/70 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Saldo projetado</p>
                <p className="mt-2 break-words text-sm font-semibold text-stone-950">{formatBRL(financialData.projectedEndBalance)}</p>
                <p className="break-words text-sm text-stone-600">{financialData.spendingTrend}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={Target} title="Objetivo principal" actionLabel={goal ? "Editar objetivo" : "Criar objetivo"} onAction={openGoalEdit} />
          <div className="rounded-[2rem] border border-stone-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-4">
                <div className="inline-flex max-w-full break-words rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">{snapshot.label}</div>
                <div>
                  <h2 className="break-words text-2xl font-semibold text-stone-950 sm:text-3xl">{snapshot.title}</h2>
                  <p className="mt-2 break-words text-sm text-stone-600">{goal ? `${formatBRL(snapshot.current)} de ${formatBRL(snapshot.total)}` : "Sem meta cadastrada"}</p>
                </div>
                <div className="w-full max-w-3xl">
                  <div className="h-3 rounded-full bg-stone-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${mainGoalPercent}%` }} />
                  </div>
                  <p className="mt-3 break-words text-sm text-stone-600">{goal ? `Faltam ${formatBRL(mainGoalRemaining)} para completar.` : "Cadastre uma meta para ver progresso e projeções."}</p>
                </div>
              </div>
              <div className="text-left lg:min-w-[140px] lg:text-right">
                <div className="break-words text-4xl font-semibold text-teal-700 sm:text-5xl">{mainGoalPercent}%</div>
                <p className="mt-1 text-sm text-stone-500">concluído</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={Wallet} title="Planejamento do casal" actionLabel="Ajustar plano" onAction={openPlanningEdit} />
          <p className="text-sm text-stone-600">Como vocês decidiram dividir a renda mensal de {formatBRL(snapshot.householdIncome)}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {planCards.map((card, index) => (
              <article key={card.id ?? card.name} className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
                {(() => {
                  const spent = financialData.categoryTotals.find((item) => item.name.toLowerCase() === card.name.toLowerCase())?.amount ?? 0;
                  const remaining = card.amount - spent;
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-base font-medium">{card.name}</h3>
                  <span className="text-sm text-stone-500">{card.share}</span>
                </div>
                <p className="mt-5 break-words text-xl font-semibold sm:text-2xl">{formatBRL(card.amount)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="opacity-70">Gasto</p>
                    <p className="break-words font-semibold">{formatBRL(spent)}</p>
                  </div>
                  <div>
                    <p className="opacity-70">Restante</p>
                    <p className="break-words font-semibold">{formatBRL(remaining)}</p>
                  </div>
                </div>
                <div className="mt-6 h-2 rounded-full bg-white/70">
                  <div className="h-2 rounded-full bg-current opacity-70" style={{ width: `${card.amount > 0 ? Math.min((spent / card.amount) * 100, 100) : 0}%` }} />
                </div>
                    </>
                  );
                })()}
                {editingPlanning && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs uppercase tracking-[0.16em] text-stone-500">Percentual</label>
                    <input
                      type="number"
                      value={card.percent}
                      onChange={(e) => setPlanningAllocations((prev) => prev.map((item, i) => i === index ? {
                        ...item,
                        percent: Number(e.target.value) || 0,
                        share: buildPercentText(Number(e.target.value) || 0),
                        amount: income * ((Number(e.target.value) || 0) / 100),
                      } : item))}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-900">{snapshot.suggestion.title}</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">{snapshot.suggestion.note}</p>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={TrendingDown} title="Metas futuras" actionLabel="Adicionar meta futura" onAction={openFutureGoalAdd} />
          <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            {progressRows.length > 0 ? (
              progressRows.map((row, index) => {
                const pct = row.planned > 0 ? Math.min((row.realized / row.planned) * 100, 100) : 0;
                const diff = row.planned - row.realized;
                return (
                  <div key={row.id ?? row.localId ?? `future-goal-${index}`} className={`p-5 ${index !== progressRows.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <h3 className="break-words text-lg font-medium text-stone-950">{row.name}</h3>
                        <p className="break-words text-sm text-stone-500">Alvo: {formatBRL(row.planned)} · Atual: {formatBRL(row.realized)}</p>
                      </div>
                      <span className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">{row.status}</span>
                    </div>
                    <ProgressBar percent={pct} />
                    <p className="mt-3 text-sm text-stone-600">
                      {diff > 0 ? `Faltam ${formatBRL(diff)} para esta meta futura.` : diff < 0 ? `${formatBRL(Math.abs(diff))} acima do alvo.` : "Meta futura no valor alvo."}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-stone-500">Nenhuma meta futura cadastrada.</p>
                <button
                  type="button"
                  onClick={openFutureGoalAdd}
                  className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  Adicionar meta futura
                </button>
              </div>
            )}
          </div>
        </section>

      </div>

      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={closeGoalEdit}>
          <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-stone-950">Editar meta</h2>
              <button type="button" onClick={closeGoalEdit} className="text-stone-400 hover:text-stone-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Objetivo</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Etiqueta</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Atual</label>
                  <input type="number" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Total</label>
                  <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-900">Metas futuras</p>
                  <button type="button" onClick={handleAddSubGoal} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700">
                    Adicionar meta futura
                  </button>
                </div>
                <div className="space-y-3">
                  {progressRows.map((row, index) => (
                    <div key={row.id ?? row.localId ?? `future-goal-edit-${index}`} className="grid gap-2 md:grid-cols-[1.2fr_0.7fr_0.7fr_auto]">
                      <input
                        value={row.name}
                        onChange={(e) => updateProgressRow(index, { name: e.target.value })}
                        className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder="Nome"
                      />
                      <input
                        type="number"
                        value={row.planned}
                        onChange={(e) => updateProgressRow(index, { planned: Number(e.target.value) || 0 })}
                        className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder="Valor alvo"
                      />
                      <input
                        type="number"
                        value={row.realized}
                        onChange={(e) => updateProgressRow(index, { realized: Number(e.target.value) || 0 })}
                        className="rounded-xl border border-stone-200 px-3 py-2 text-sm"
                        placeholder="Valor atual"
                      />
                      <button type="button" onClick={() => handleDeleteProgressRow(index)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                        Excluir
                      </button>
                    </div>
                  ))}
                  {progressRows.length === 0 && <p className="text-sm text-stone-500">Nenhuma meta futura cadastrada.</p>}
                </div>
              </div>

              {formError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {goal?.id && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteGoal()}
                    disabled={saving}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60 sm:mr-auto"
                  >
                    Excluir meta
                  </button>
                )}
                <button type="button" onClick={closeGoalEdit} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => void handleSaveGoal()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar meta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPlanning && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={closePlanningEdit}>
          <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-stone-950">Ajustar plano</h2>
              <button type="button" onClick={closePlanningEdit} className="text-stone-400 hover:text-stone-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-5">
              <p className="text-sm text-stone-600">Distribuição calculada com base na renda mensal: {formatBRL(income)}</p>
              <div className="mt-6 space-y-3">
                {planningAllocations.map((item, index) => (
                  <div key={item.name} className="grid gap-2 sm:grid-cols-[1.1fr_0.6fr_0.8fr]">
                    <input value={item.name} onChange={(e) => setPlanningAllocations((prev) => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))} className="min-w-0 rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                    <input type="number" value={item.percent} onChange={(e) => setPlanningAllocations((prev) => prev.map((row, i) => i === index ? { ...row, percent: Number(e.target.value) || 0, share: buildPercentText(Number(e.target.value) || 0), amount: income * ((Number(e.target.value) || 0) / 100) } : row))} className="min-w-0 rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                    <div className={`min-w-0 break-words rounded-xl border px-3 py-2 text-sm ${toneClass(item.tone)}`}>{formatBRL(income * (item.percent / 100))}</div>
                  </div>
                ))}
              </div>

              {formError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={closePlanningEdit} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => void handleSavePlanning()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar plano"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
