import { useEffect, useMemo, useRef, useState } from "react";
import { endOfMonth, getDate, getDaysInMonth, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { Edit3, Plus, Sparkles, Target, TrendingDown, Wallet, X, Save, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { ExpandableSection } from "./ExpandableSection";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

type GoalTone = "stone" | "emerald" | "cyan" | "amber" | "indigo";

type PlanCard = {
  id?: string;
  localId?: string;
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

type ContributionTarget =
  | { kind: "main" }
  | { kind: "future"; index: number };

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
      share: item.share,
      percent: item.percent,
      amount: income * (item.percent / 100),
      currentAmount: 0,
      tone: item.tone,
    })),
    progressRows: [],
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
      { kind: "positive", text: "A divisão inicial é uma sugestão editável para ajudar o casal a começar." },
    ],
    suggestion: {
      title: "Sugestão de divisão editável",
      note: "A base inicial vem de práticas comuns de organização financeira e serve só como ponto de partida. Vocês podem alterar percentuais, adicionar categorias ou remover o que não fizer sentido.",
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

function nextPlanTone(index: number): GoalTone {
  const tones: GoalTone[] = ["stone", "emerald", "cyan", "amber", "indigo"];
  return tones[index % tones.length];
}

function SectionHeader({
  icon: Icon,
  title,
  actionLabel,
  actionIcon: ActionIcon = Edit3,
  actionTone = "ghost",
  onAction,
}: {
  icon: typeof Target;
  title: string;
  actionLabel?: string;
  actionIcon?: typeof Edit3;
  actionTone?: "ghost" | "primary";
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
        <Icon className="h-5 w-5 text-stone-500" />
        <span>{title}</span>
      </div>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
            actionTone === "primary"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]"
          }`}
        >
          <ActionIcon className="h-4 w-4" />
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
  const normalized = Math.max(0, Number(percent) || 0);
  const text = Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/\.?0+$/, "");
  return `${text}%`;
}

export function Goals() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    household,
    settings,
    incomeEntries,
    expenses,
    fixedExpenses,
    fixedExpenseMonthlyValues,
    financialCommitments,
    categories,
    activeCycle,
  } = useFinance();
  const [goal, setGoal] = useState<GoalSnapshot | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingPlanning, setEditingPlanning] = useState(false);
  const [editingFutureGoalIndex, setEditingFutureGoalIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const income = settings.monthlyIncome || household?.monthlyIncome || 0;
  const snapshot = goal ?? emptyGoal(income);
  const mainGoalPercent = snapshot.total > 0 ? Math.round((snapshot.current / snapshot.total) * 100) : 0;
  const mainGoalRemaining = Math.max(snapshot.total - snapshot.current, 0);
  const planCards = snapshot.planCards;
  const financialData = useMemo(() => {
    const cycleDate = new Date(activeCycle.year, activeCycle.month - 1, 1);
    const today = new Date();
    const referenceDate =
      today.getFullYear() === activeCycle.year && today.getMonth() + 1 === activeCycle.month
        ? today
        : cycleDate;
    const currentMonth = { start: startOfMonth(cycleDate), end: endOfMonth(cycleDate) };
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const monthExpenses = expenses.filter((expense) =>
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
    const variableSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const fixedSpent = fixedExpenses.reduce((sum, expense) => sum + fixedExpenseAmount(expense), 0);
    const installmentSpent = financialCommitments
      .filter((commitment) => commitment.status !== "finished")
      .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
    const totalSpent = fixedSpent + variableSpent + installmentSpent;
    const extraIncome = monthIncomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const realIncome = income + extraIncome;
    const remainingBalance = realIncome - totalSpent;
    const dayOfMonth = Math.max(getDate(referenceDate), 1);
    const daysInMonth = getDaysInMonth(cycleDate);
    const projectedVariable = (variableSpent / dayOfMonth) * daysInMonth;
    const projectedEndBalance = realIncome - fixedSpent - installmentSpent - projectedVariable;
    const categoryTotals = new Map<string, number>();

    for (const expense of monthExpenses) {
      const name = categoryNames.get(expense.category) || expense.category || "Sem categoria";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + expense.amount);
    }

    for (const expense of fixedExpenses) {
      const name = expense.category || "Sem categoria";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + fixedExpenseAmount(expense));
    }

    for (const commitment of financialCommitments.filter((item) => item.status !== "finished")) {
      const name = categoryNames.get(commitment.categoryId) || commitment.categoryId || "Parcelas";
      categoryTotals.set(name, (categoryTotals.get(name) || 0) + commitment.installmentValue);
    }

    const sortedCategories = Array.from(categoryTotals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);
    const highestCategory = sortedCategories[0] ?? null;
    const lowestCategory = sortedCategories.length > 1 ? sortedCategories[sortedCategories.length - 1] : null;
    const healthScore = realIncome > 0 ? Math.max(0, Math.min(100, Math.round((remainingBalance / realIncome) * 100))) : 0;
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
      extraIncome,
      realIncome,
      totalSpent,
      categoryTotals: sortedCategories,
      remainingBalance,
      projectedEndBalance,
      highestCategory,
      lowestCategory,
      healthScore,
      spendingTrend,
    };
  }, [activeCycle.month, activeCycle.year, categories, expenses, financialCommitments, fixedExpenseMonthlyValues, fixedExpenses, income, incomeEntries]);

  const [title, setTitle] = useState(snapshot.title);
  const [label, setLabel] = useState(snapshot.label);
  const [current, setCurrent] = useState(String(snapshot.current));
  const [total, setTotal] = useState(String(snapshot.total || income || 0));
  const [progressRows, setProgressRows] = useState<ProgressRow[]>(snapshot.progressRows);
  const [planningAllocations, setPlanningAllocations] = useState<PlanCard[]>(planCards);
  const planningItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [futureGoalName, setFutureGoalName] = useState("");
  const [futureGoalPlanned, setFutureGoalPlanned] = useState("");
  const [futureGoalRealized, setFutureGoalRealized] = useState("");
  const [contributionTarget, setContributionTarget] = useState<ContributionTarget | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const planningTotalPercent = planningAllocations.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);

  useEffect(() => {
    const state = location.state as { openContribution?: "main" } | null;
    if (state?.openContribution !== "main" || !goal?.id || contributionTarget) return;

    setContributionTarget({ kind: "main" });
    navigate(location.pathname, { replace: true, state: null });
  }, [contributionTarget, goal?.id, location.pathname, location.state, navigate]);

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
        setPlanningAllocations(buildSuggestedPlan(income));
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
              status: row.status === "Sem meta cadastrada" || !row.status ? "Em andamento" : row.status,
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
              status: row.status === "Sem meta cadastrada" || !row.status ? "Em andamento" : row.status,
            }))
          : [],
      );
      setPlanningAllocations(resolvedPlanCards);
    };

    void load();
  }, [household?.id, income]);

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
  const closeFutureGoalEdit = () => {
    setEditingFutureGoalIndex(null);
    setFutureGoalName("");
    setFutureGoalPlanned("");
    setFutureGoalRealized("");
    setFormError(null);
  };
  const closeContribution = () => {
    setContributionTarget(null);
    setContributionAmount("");
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
      setPlanningAllocations(buildSuggestedPlan(income));
      setEditingGoal(false);
      setEditingPlanning(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível excluir a meta.");
    } finally {
      setSaving(false);
    }
  };

  const refreshGoalState = async (savedGoal: Awaited<ReturnType<typeof financeService.addGoal>>) => {
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
    const resolvedProgressRows = rows.map((row) => ({
      id: row.id,
      name: row.name,
      planned: row.planned,
      realized: row.realized,
    status: row.status === "Sem meta cadastrada" || !row.status ? "Em andamento" : row.status,
    }));

    setGoal({
      id: savedGoal.id,
      title: savedGoal.title,
      label: savedGoal.label,
      current: savedGoal.currentAmount,
      total: savedGoal.targetAmount,
      householdIncome: income,
      planCards: resolvedPlanCards,
      progressRows: resolvedProgressRows,
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
    setProgressRows(resolvedProgressRows);
    setPlanningAllocations(resolvedPlanCards);
  };

  const ensureGoal = async () => {
    const householdId = household?.id;
    if (!householdId) return null;
    const payload = {
      householdId,
      title: title.trim() || "Meta principal",
      label: label.trim() || "Planejamento",
      currentAmount: Number(current) || 0,
      targetAmount: Number(total) || 0,
    };

    return goal?.id
      ? await financeService.updateGoal(goal.id, payload)
      : await financeService.addGoal(payload);
  };

  const handleDeleteProgressRow = async (rowIndex: number) => {
    const row = progressRows[rowIndex];
    if (!row) return;
    if (!window.confirm("Excluir esta meta futura?")) return;
    setSaving(true);
    setFormError(null);
    try {
      if (row.id) {
        await financeService.deleteGoalProgressRow(row.id);
      }
      if (goal?.id) {
        const savedGoal = await ensureGoal();
        if (savedGoal) {
          await refreshGoalState(savedGoal);
        }
      } else {
        setProgressRows((prev) => prev.filter((_, index) => index !== rowIndex));
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível excluir a meta futura.");
    } finally {
      setSaving(false);
    }
  };

  const openFutureGoalAdd = () => {
    setEditingFutureGoalIndex(-1);
    setFutureGoalName("");
    setFutureGoalPlanned("");
    setFutureGoalRealized("");
  };

  const openFutureGoalEdit = (index: number) => {
    const row = progressRows[index];
    if (!row) return;
    setEditingFutureGoalIndex(index);
    setFutureGoalName(row.name);
    setFutureGoalPlanned(String(row.planned));
    setFutureGoalRealized(String(row.realized));
  };

  const handleSaveFutureGoal = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const savedGoal = await ensureGoal();
      if (!savedGoal) return;
      const rowPayload = {
        name: futureGoalName.trim() || "Meta futura",
        planned: Number(futureGoalPlanned) || 0,
        realized: Number(futureGoalRealized) || 0,
        status: "Em andamento",
      };
      const currentRow = editingFutureGoalIndex !== null && editingFutureGoalIndex >= 0 ? progressRows[editingFutureGoalIndex] : null;
      if (currentRow?.id) {
        await financeService.updateGoalProgressRow(currentRow.id, rowPayload);
      } else {
        await financeService.addGoalProgressRow(savedGoal.id, rowPayload);
      }
      await refreshGoalState(savedGoal);
      closeFutureGoalEdit();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a meta futura.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContribution = async () => {
    const amount = Number(contributionAmount.replace(",", "."));
    if (!contributionTarget || !amount || amount <= 0) return;

    setSaving(true);
    setFormError(null);
    try {
      if (contributionTarget.kind === "main") {
        const savedGoal = await ensureGoal();
        if (!savedGoal) return;
        const updatedGoal = await financeService.updateGoal(savedGoal.id, {
          title: savedGoal.title,
          label: savedGoal.label,
          currentAmount: savedGoal.currentAmount + amount,
          targetAmount: savedGoal.targetAmount,
        });
        await refreshGoalState(updatedGoal);
        setCurrent(String(updatedGoal.currentAmount));
      } else {
        const row = progressRows[contributionTarget.index];
        if (!row) return;
        const nextRealized = row.realized + amount;
        if (row.id) {
          await financeService.updateGoalProgressRow(row.id, {
            name: row.name,
            planned: row.planned,
            realized: nextRealized,
            status: row.status,
          });
          const savedGoal = await ensureGoal();
          if (savedGoal) await refreshGoalState(savedGoal);
        } else {
          setProgressRows((prev) =>
            prev.map((item, index) =>
              index === contributionTarget.index ? { ...item, realized: nextRealized } : item,
            ),
          );
        }
      }
      closeContribution();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível adicionar o valor.");
    } finally {
      setSaving(false);
    }
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

      const savedGoal = goal?.id
        ? await financeService.updateGoal(goal.id, payload)
        : await financeService.addGoal(payload);

      await refreshGoalState(savedGoal);
      closeGoalEdit();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a meta.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlanningCategory = () => {
    const localId = crypto.randomUUID();
    setPlanningAllocations((prev) => [
      ...prev,
      {
        localId,
        name: "",
        share: "0%",
        percent: 0,
        amount: 0,
        currentAmount: 0,
        tone: nextPlanTone(prev.length),
      },
    ]);
    window.setTimeout(() => {
      planningItemRefs.current[localId]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  const handleSavePlanning = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const savedGoal = await ensureGoal();
      if (!savedGoal) return;
      const normalizedAllocations = planningAllocations.map((item, index) => ({
        ...item,
        name: item.name.trim() || `Categoria ${index + 1}`,
        percent: Number(item.percent) || 0,
        share: buildPercentText(Number(item.percent) || 0),
        amount: income * ((Number(item.percent) || 0) / 100),
        tone: item.tone || nextPlanTone(index),
      }));

      const existingPlan = await financeService.fetchGoalPlanItems(savedGoal.id).catch(() => []);
      for (const item of existingPlan) {
        await financeService.deleteGoalPlanItem(item.id);
      }
      for (const item of normalizedAllocations) {
        await financeService.addGoalPlanItem(savedGoal.id, {
          name: item.name,
          share: buildPercentText(item.percent),
          amount: income * (item.percent / 100),
          tone: item.tone,
        });
      }

      const planItems = await financeService.fetchGoalPlanItems(savedGoal.id).catch(() => []);
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

      setGoal((prev) => ({
        ...(prev ?? emptyGoal(income)),
        id: savedGoal.id,
        title: savedGoal.title,
        label: savedGoal.label,
        current: savedGoal.currentAmount,
        total: savedGoal.targetAmount,
        planCards: resolvedPlanCards,
        householdIncome: income,
      }));
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
      <div className="space-y-5 sm:space-y-7">
        <header className="space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">Metas</h1>
          <p className="text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6">Como o ritmo de vocês conversa com os planos do casal</p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-2 sm:space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:px-3 sm:text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 sm:h-2.5 sm:w-2.5" />
                  Saúde financeira
                </div>
                <h3 className="break-words text-lg font-semibold text-stone-950 sm:text-2xl sm:font-medium">{formatBRL(financialData.remainingBalance)} livres neste mês</h3>
                <p className="text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6">
                  Renda real {formatBRL(financialData.realIncome)}
                  {financialData.extraIncome > 0 ? ` (${formatBRL(income)} planejada + ${formatBRL(financialData.extraIncome)} entradas)` : ""}
                  {" - "}fixas {formatBRL(financialData.fixedSpent)} - variáveis {formatBRL(financialData.variableSpent)} - parcelas {formatBRL(financialData.installmentSpent)}.
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="break-words text-3xl font-semibold text-teal-700 sm:text-5xl">{financialData.healthScore}%</div>
                <p className="text-xs text-stone-500 sm:text-sm">da renda livre</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 sm:h-12 sm:w-12">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-stone-950 sm:text-xl sm:font-medium">Radar do mês</h3>
                <p className="text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6">Categorias, tendência e saldo projetado</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-3 sm:gap-3">
              <div className="rounded-xl border border-emerald-100 bg-white/70 p-3 sm:rounded-2xl sm:p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500 sm:text-xs sm:tracking-[0.16em]">Maior gasto</p>
                <p className="mt-1 break-words text-sm font-semibold text-stone-950 sm:mt-2">{financialData.highestCategory?.name ?? "Sem gastos"}</p>
                <p className="break-words text-xs text-stone-600 sm:text-sm">{formatBRL(financialData.highestCategory?.amount ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white/70 p-3 sm:rounded-2xl sm:p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500 sm:text-xs sm:tracking-[0.16em]">Menor gasto</p>
                <p className="mt-1 break-words text-sm font-semibold text-stone-950 sm:mt-2">{financialData.lowestCategory?.name ?? "Sem comparação"}</p>
                <p className="break-words text-xs text-stone-600 sm:text-sm">{formatBRL(financialData.lowestCategory?.amount ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white/70 p-3 sm:rounded-2xl sm:p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500 sm:text-xs sm:tracking-[0.16em]">Saldo projetado</p>
                <p className="mt-1 break-words text-sm font-semibold text-stone-950 sm:mt-2">{formatBRL(financialData.projectedEndBalance)}</p>
                <p className="break-words text-xs text-stone-600 sm:text-sm">{financialData.spendingTrend}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 sm:space-y-4">
          <SectionHeader icon={Target} title="Objetivo principal" actionLabel={goal ? "Editar objetivo" : "Criar objetivo"} onAction={openGoalEdit} />
          <div className="rounded-2xl border border-stone-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50 p-4 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3 sm:space-y-4">
                <div className="inline-flex max-w-full break-words rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700 sm:px-3 sm:text-xs sm:tracking-[0.18em]">{snapshot.label}</div>
                <div>
                  <h2 className="break-words text-xl font-semibold text-stone-950 sm:text-3xl">{snapshot.title}</h2>
                  <p className="mt-2 break-words text-sm text-stone-600">{goal ? `${formatBRL(snapshot.current)} de ${formatBRL(snapshot.total)}` : "Sem meta cadastrada"}</p>
                </div>
                {goal && (
                  <button
                    type="button"
                    onClick={() => setContributionTarget({ kind: "main" })}
                    className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar valor
                  </button>
                )}
                <div className="w-full max-w-3xl">
                  <div className="h-2.5 rounded-full bg-stone-100 sm:h-3">
                    <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 sm:h-3" style={{ width: `${mainGoalPercent}%` }} />
                  </div>
                  <p className="mt-2 break-words text-xs text-stone-600 sm:mt-3 sm:text-sm">{goal ? `Faltam ${formatBRL(mainGoalRemaining)} para completar.` : "Cadastre uma meta para ver progresso e projeções."}</p>
                </div>
              </div>
              <div className="text-left lg:min-w-[140px] lg:text-right">
                <div className="break-words text-3xl font-semibold text-teal-700 sm:text-5xl">{mainGoalPercent}%</div>
                <p className="mt-1 text-xs text-stone-500 sm:text-sm">concluído</p>
              </div>
            </div>
          </div>
        </section>

        <ExpandableSection
          title="Planejamento do casal"
          summary={`${planCards.length} categorias · ${buildPercentText(planCards.reduce((sum, item) => sum + item.percent, 0))} da renda`}
          actions={
            <button
              type="button"
              onClick={openPlanningEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]"
            >
              <Edit3 className="h-4 w-4" />
              Ajustar plano
            </button>
          }
        >
          <p className="text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6">Como vocês decidiram dividir a renda mensal de {formatBRL(snapshot.householdIncome)}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {planCards.map((card) => (
              <article key={card.id ?? card.localId ?? card.name} className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
                {(() => {
                  const spent = financialData.categoryTotals.find((item) => item.name.toLowerCase() === card.name.toLowerCase())?.amount ?? 0;
                  const remaining = card.amount - spent;
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-base font-medium">{card.name}</h3>
                  <span className="text-xs text-stone-500 sm:text-sm">{card.share}</span>
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
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
            <p className="text-sm font-medium text-emerald-900">Sugestão editável</p>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Essa base inicial é inspirada em práticas comuns de organização financeira e soma {buildPercentText(planCards.reduce((sum, item) => sum + item.percent, 0))} da renda mensal. Ela é só um ponto de partida: vocês podem editar percentuais, adicionar categorias ou remover itens conforme a realidade do casal.
            </p>
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Metas futuras"
          summary={
            progressRows.length > 0
              ? `${progressRows.length} metas · ${formatBRL(progressRows.reduce((sum, row) => sum + row.planned, 0))} em objetivos`
              : "Nenhuma meta futura cadastrada"
          }
          defaultOpen={progressRows.length > 0}
          actions={
            <button
              type="button"
              onClick={openFutureGoalAdd}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <Plus className="h-4 w-4" />
              Nova meta
            </button>
          }
        >
          <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            {progressRows.length > 0 ? (
              progressRows.map((row, index) => {
                const pct = row.planned > 0 ? Math.min((row.realized / row.planned) * 100, 100) : 0;
                const diff = row.planned - row.realized;
                return (
                  <div key={row.id ?? row.localId ?? `future-goal-${index}`} className={`p-5 ${index !== progressRows.length - 1 ? "border-b border-stone-100" : ""}`}>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex items-start gap-2">
                          <h3 className="min-w-0 break-words text-lg font-medium text-stone-950">{row.name}</h3>
                          <div className="flex shrink-0 gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setContributionTarget({ kind: "future", index })}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600 transition-all hover:bg-emerald-100 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.2)]"
                              aria-label="Adicionar valor na meta futura"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openFutureGoalEdit(index)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]"
                              aria-label="Editar meta futura"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteProgressRow(index)}
                              disabled={saving}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_0_18px_rgba(244,63,94,0.16)] disabled:opacity-50"
                              aria-label="Excluir meta futura"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
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
                <p className="text-xs text-stone-500 sm:text-sm">Nenhuma meta futura cadastrada.</p>
                <button
                  type="button"
                  onClick={openFutureGoalAdd}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Plus className="h-4 w-4" />
                  Nova meta
                </button>
              </div>
            )}
          </div>
        </ExpandableSection>

      </div>

      {contributionTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={closeContribution}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Adicionar valor</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {contributionTarget.kind === "main"
                    ? snapshot.title
                    : progressRows[contributionTarget.index]?.name ?? "Meta futura"}
                </p>
              </div>
              <button type="button" onClick={closeContribution} className="text-stone-400 hover:text-stone-700">
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Valor</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-lg border border-stone-200 px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {formError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={closeContribution} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => void handleSaveContribution()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  <Plus className="h-4 w-4" />
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={closeGoalEdit}>
          <div className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-stone-950">Editar meta</h2>
              <button type="button" onClick={closeGoalEdit} className="text-stone-400 hover:text-stone-700"><X className="h-4 w-4 sm:h-5 sm:w-5" /></button>
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

      {editingFutureGoalIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={closeFutureGoalEdit}>
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-stone-900">
                {editingFutureGoalIndex >= 0 ? "Editar meta" : "Nova meta"}
              </h2>
              <button type="button" onClick={closeFutureGoalEdit} className="text-stone-400 hover:text-stone-700">
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Nome</label>
                <input
                  type="text"
                  value={futureGoalName}
                  onChange={(e) => setFutureGoalName(e.target.value)}
                  placeholder="Ex: Reserva de emergência"
                  className="w-full rounded-lg border border-stone-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Valor alvo</label>
                <input
                  type="number"
                  value={futureGoalPlanned}
                  onChange={(e) => setFutureGoalPlanned(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-stone-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-stone-500">Valor atual</label>
                <input
                  type="number"
                  value={futureGoalRealized}
                  onChange={(e) => setFutureGoalRealized(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-stone-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {formError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={closeFutureGoalEdit} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => void handleSaveFutureGoal()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar meta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPlanning && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-0 sm:items-center sm:p-4" onClick={closePlanningEdit}>
          <div className="max-h-[100dvh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-100 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-stone-950">Ajustar planejamento</h2>
                <p className="mt-1 text-xs text-stone-500 sm:hidden">Edite uma categoria por vez. Novas categorias aparecem no final.</p>
              </div>
              <button type="button" onClick={closePlanningEdit} className="shrink-0 text-stone-400 hover:text-stone-700"><X className="h-4 w-4 sm:h-5 sm:w-5" /></button>
            </div>

            <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-5 py-5 sm:max-h-[calc(100vh-8rem)] sm:px-6">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs leading-5 text-stone-600 sm:text-sm sm:leading-6">Distribuição definida por vocês com base na renda mensal: {formatBRL(income)}</p>
                    <p className="mt-1 text-xs text-stone-500">Total informado: {buildPercentText(planningTotalPercent)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddPlanningCategory}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar categoria
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {planningAllocations.map((item, index) => {
                  const itemKey = item.id ?? item.localId ?? `plan-${index}`;
                  return (
                    <div
                      key={itemKey}
                      ref={(node) => {
                        planningItemRefs.current[itemKey] = node;
                      }}
                      className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Categoria {index + 1}</p>
                          <p className="mt-1 text-sm text-stone-600">{formatBRL(income * ((Number(item.percent) || 0) / 100))} planejados</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPlanningAllocations((prev) => prev.filter((_, i) => i !== index))}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
                          aria-label="Remover categoria"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_140px_180px] sm:items-end">
                        <label className="block">
                          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">Nome</span>
                          <input
                            value={item.name}
                            onChange={(e) => setPlanningAllocations((prev) => prev.map((row, i) => i === index ? { ...row, name: e.target.value } : row))}
                            placeholder="Ex: Moradia"
                            className="w-full min-w-0 rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">Percentual</span>
                          <input
                            type="number"
                            value={item.percent}
                            onChange={(e) => setPlanningAllocations((prev) => prev.map((row, i) => i === index ? { ...row, percent: Number(e.target.value) || 0, share: buildPercentText(Number(e.target.value) || 0), amount: income * ((Number(e.target.value) || 0) / 100) } : row))}
                            placeholder="%"
                            className="w-full min-w-0 rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </label>
                        <div className={`min-w-0 break-words rounded-xl border px-3 py-2.5 text-sm ${toneClass(item.tone)}`}>
                          <span className="block text-xs opacity-70">Valor mensal</span>
                          <span className="font-semibold">{formatBRL(income * ((Number(item.percent) || 0) / 100))}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {planningAllocations.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-5 text-center text-sm text-stone-500">
                    Adicione uma categoria para começar a divisão.
                  </p>
                )}
              </div>

              {formError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

              <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col-reverse gap-3 border-t border-stone-100 bg-white px-5 py-4 sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                <button type="button" onClick={closePlanningEdit} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
                <button type="button" disabled={saving} onClick={() => void handleSavePlanning()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
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
