import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Compass, Edit3, Lightbulb, Plus, Sparkles, Target, TrendingDown, Wallet, X, Save } from "lucide-react";
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
  tone: GoalTone;
};

type ProgressRow = {
  id?: string;
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
  const { household, settings } = useFinance();
  const [goal, setGoal] = useState<GoalSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const income = settings.monthlyIncome || household?.monthlyIncome || 0;
  const snapshot = goal ?? emptyGoal(income);
  const mainGoalPercent = snapshot.total > 0 ? Math.round((snapshot.current / snapshot.total) * 100) : 0;
  const mainGoalRemaining = Math.max(snapshot.total - snapshot.current, 0);
  const averagePlanUsage = snapshot.progressRows.some((row) => row.planned > 0)
    ? Math.round(
        snapshot.progressRows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) /
          snapshot.progressRows.filter((row) => row.planned > 0).length,
      )
    : 0;
  const planCards = goal?.planCards.length ? snapshot.planCards : buildSuggestedPlan(income);

  const [title, setTitle] = useState(snapshot.title);
  const [label, setLabel] = useState(snapshot.label);
  const [current, setCurrent] = useState(String(snapshot.current));
  const [total, setTotal] = useState(String(snapshot.total || income || 0));
  const [allocations, setAllocations] = useState<PlanCard[]>(planCards);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>(snapshot.progressRows);

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
        setAllocations(buildSuggestedPlan(income));
        setProgressRows(fallback.progressRows);
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
          ? rows.map((row) => ({ id: row.id, name: row.name, planned: row.planned, realized: row.realized, status: row.status }))
          : emptyGoal(income).progressRows,
        financialHealth: {
          score: rows.length
            ? Math.round(rows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / rows.length)
            : 0,
          label: "Saúde financeira",
          description: "Aderência ao plano calculada com dados reais do Supabase.",
        },
        monthRadar: {
          label: "Radar do mês",
          summary: "Projeção calculada a partir dos dados do banco.",
          note: "Depois podemos sofisticar essa análise sem mexer na UI.",
        },
        insights: rows.length
          ? rows.map((row) => ({ kind: "info", text: `${row.name} está ${row.planned - row.realized >= 0 ? "abaixo" : "acima"} do planejado.` }))
          : emptyGoal(income).insights,
        suggestion: emptyGoal(income).suggestion,
      });

      setTitle(currentGoal.title);
      setLabel(currentGoal.label);
      setCurrent(String(currentGoal.currentAmount));
      setTotal(String(currentGoal.targetAmount));
      setAllocations(resolvedPlanCards);
      setProgressRows(
        rows.length
          ? rows.map((row) => ({ id: row.id, name: row.name, planned: row.planned, realized: row.realized, status: row.status }))
          : emptyGoal(income).progressRows,
      );
    };

    void load();
  }, [household?.id, income]);

  useEffect(() => {
    if (!editing && !goal) {
      setTitle(snapshot.title);
      setLabel(snapshot.label);
      setCurrent(String(snapshot.current));
      setTotal(String(snapshot.total || income || 0));
      setAllocations(planCards);
      setProgressRows(snapshot.progressRows);
    }
  }, [editing, goal, income, planCards, snapshot]);

  const openEdit = () => setEditing(true);
  const closeEdit = () => {
    setEditing(false);
    setFormError(null);
  };

  const updateAllocation = (index: number, patch: Partial<PlanCard>) => {
    setAllocations((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const updateProgressRow = (index: number, patch: Partial<ProgressRow>) => {
    setProgressRows((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSave = async () => {
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

      const planCardsPercent = allocations.reduce((sum, item) => sum + item.percent, 0);
      const normalizedAllocations = planCardsPercent > 0 ? allocations : buildSuggestedPlan(income);

      const existingPlan = goal?.id ? await financeService.fetchGoalPlanItems(savedGoal.id).catch(() => []) : [];
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
        progressRows: rows.map((row) => ({ id: row.id, name: row.name, planned: row.planned, realized: row.realized, status: row.status })),
        financialHealth: {
          score: rows.length
            ? Math.round(rows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / rows.length)
            : 0,
          label: "Saúde financeira",
          description: "Aderência ao plano calculada com dados reais do Supabase.",
        },
        monthRadar: {
          label: "Radar do mês",
          summary: "Projeção calculada a partir dos dados do banco.",
          note: "Depois podemos sofisticar essa análise sem mexer na UI.",
        },
        insights: rows.map((row) => ({ kind: "info", text: `${row.name} está ${row.planned - row.realized >= 0 ? "abaixo" : "acima"} do planejado.` })),
        suggestion: emptyGoal(income).suggestion,
      });
      closeEdit();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a meta.");
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
          <p className="text-xs text-stone-500">Dados reais do Supabase quando disponíveis. Caso contrário, a tela fica zerada e mostra apenas uma sugestão de base saudável.</p>
        </header>

        <section className="space-y-4">
          <SectionHeader icon={Target} title="Objetivo principal" actionLabel={goal ? "Editar objetivo" : "Criar objetivo"} onAction={openEdit} />
          <div className="rounded-[2rem] border border-stone-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">{snapshot.label}</div>
                <div>
                  <h2 className="text-3xl font-semibold text-stone-950">{snapshot.title}</h2>
                  <p className="mt-2 text-sm text-stone-600">{snapshot.total > 0 ? `${formatBRL(snapshot.current)} de ${formatBRL(snapshot.total)}` : "Sem meta cadastrada"}</p>
                </div>
                <div className="w-full max-w-3xl">
                  <div className="h-3 rounded-full bg-stone-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${mainGoalPercent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-stone-600">{snapshot.total > 0 ? `Faltam ${formatBRL(mainGoalRemaining)} para completar.` : "Cadastre uma meta para ver progresso e projeções."}</p>
                </div>
              </div>
              <div className="min-w-[140px] text-right">
                <div className="text-5xl font-semibold text-teal-700">{mainGoalPercent}%</div>
                <p className="mt-1 text-sm text-stone-500">concluído</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={Wallet} title="Planejamento do casal" actionLabel="Ajustar plano" onAction={openEdit} />
          <p className="text-sm text-stone-600">Como vocês decidiram dividir a renda mensal de {formatBRL(snapshot.householdIncome)}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {planCards.map((card, index) => (
              <article key={card.id ?? card.name} className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-medium">{card.name}</h3>
                  <span className="text-sm text-stone-500">{card.share}</span>
                </div>
                <p className="mt-5 text-2xl font-semibold">{formatBRL(card.amount)}</p>
                <div className="mt-6 h-2 rounded-full bg-white/70">
                  <div className="h-2 rounded-full bg-current opacity-70" style={{ width: `${card.percent}%` }} />
                </div>
                {editing && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-xs uppercase tracking-[0.16em] text-stone-500">Percentual</label>
                    <input
                      type="number"
                      value={card.percent}
                      onChange={(e) => updateAllocation(index, { percent: Number(e.target.value) || 0, share: buildPercentText(Number(e.target.value) || 0), amount: income * ((Number(e.target.value) || 0) / 100) })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-stone-900">{snapshot.suggestion.title}</p>
            <p className="mt-2 text-sm text-stone-600">{snapshot.suggestion.note}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {snapshot.suggestion.allocations.map((item) => (
                <div key={item.name} className={`rounded-2xl border p-4 ${toneClass(item.tone)}`}>
                  <p className="text-xs uppercase tracking-[0.16em] opacity-70">{item.name}</p>
                  <p className="mt-2 text-xl font-semibold">{item.share}</p>
                  <p className="text-xs text-stone-500">{item.percent}% sugerido</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={TrendingDown} title="Planejado vs Realizado" />
          <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            {progressRows.map((row, index) => {
              const pct = row.planned > 0 ? Math.min((row.realized / row.planned) * 100, 100) : 0;
              const diff = row.planned - row.realized;
              return (
                <div key={row.id ?? row.name} className={`p-5 ${index !== progressRows.length - 1 ? "border-b border-stone-100" : ""}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-stone-950">{row.name}</h3>
                      <p className="text-sm text-stone-500">Planejado: {formatBRL(row.planned)} · Realizado: {formatBRL(row.realized)}</p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">↘ {row.status}</span>
                  </div>
                  <ProgressBar percent={pct} />
                  <p className="mt-3 text-sm text-stone-600">{formatBRL(diff)} abaixo do plano</p>
                  {editing && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <input type="text" value={row.name} onChange={(e) => updateProgressRow(index, { name: e.target.value })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Nome" />
                      <input type="number" value={row.planned} onChange={(e) => updateProgressRow(index, { planned: Number(e.target.value) || 0 })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Planejado" />
                      <input type="number" value={row.realized} onChange={(e) => updateProgressRow(index, { realized: Number(e.target.value) || 0 })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Realizado" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {snapshot.financialHealth.label}
                </div>
                <h3 className="text-2xl font-medium text-stone-950">{snapshot.financialHealth.description}</h3>
              </div>
              <div className="text-right">
                <div className="text-5xl font-semibold text-teal-700">{snapshot.financialHealth.score}%</div>
                <p className="text-sm text-stone-500">aderência</p>
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-stone-950">{snapshot.monthRadar.label}</h3>
                <p className="text-sm text-stone-600">Um resumo do ritmo atual</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4 text-stone-800">{snapshot.monthRadar.summary}</div>
            <p className="mt-3 text-sm text-stone-600">{snapshot.monthRadar.note}</p>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader icon={Lightbulb} title="Insights do Together" />
          <div className="space-y-3">
            {snapshot.insights.map((item) => (
              <div key={item.text} className={`rounded-2xl border px-4 py-4 shadow-sm ${item.kind === "positive" ? "border-emerald-100 bg-emerald-50 text-emerald-950" : "border-sky-100 bg-sky-50 text-sky-900"}`}>
                <div className="flex items-start gap-3">
                  {item.kind === "positive" ? <Compass className="mt-0.5 h-4 w-4 text-emerald-600" /> : <CircleDollarSign className="mt-0.5 h-4 w-4 text-amber-500" />}
                  <p className="text-sm">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Saúde financeira</p>
            <div className="mt-3 text-3xl font-semibold text-stone-950">{averagePlanUsage}%</div>
            <p className="mt-2 text-sm text-stone-600">Média de aderência ao plano, baseada no que foi planejado versus realizado.</p>
          </article>
          <article className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Objetivo atual</p>
            <div className="mt-3 text-3xl font-semibold text-stone-950">{mainGoalPercent}%</div>
            <p className="mt-2 text-sm text-stone-600">Progresso da reserva de emergência no momento.</p>
          </article>
          <article className="rounded-[2rem] border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Status do mês</p>
            <div className="mt-3 text-3xl font-semibold text-stone-950">Em alta</div>
            <p className="mt-2 text-sm text-stone-600">A estrutura está pronta para substituir os mocks por dados do usuário.</p>
          </article>
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={closeEdit}>
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <h2 className="text-xl font-semibold text-stone-950">Editar meta</h2>
              <button type="button" onClick={closeEdit} className="text-stone-400 hover:text-stone-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="mb-3 text-sm font-medium text-stone-900">Planejamento</p>
                <div className="space-y-3">
                  {allocations.map((item, index) => (
                    <div key={item.name} className="grid grid-cols-[1.1fr_0.6fr_0.8fr] gap-2">
                      <input value={item.name} onChange={(e) => updateAllocation(index, { name: e.target.value })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                      <input type="number" value={item.percent} onChange={(e) => updateAllocation(index, { percent: Number(e.target.value) || 0, share: buildPercentText(Number(e.target.value) || 0), amount: (Number(total) || income) * ((Number(e.target.value) || 0) / 100) })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                      <div className={`rounded-xl border px-3 py-2 text-sm ${toneClass(item.tone)}`}>{formatBRL((Number(total) || income) * (item.percent / 100))}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 p-4">
                <p className="mb-3 text-sm font-medium text-stone-900">Planejado vs realizado</p>
                <div className="space-y-3">
                  {progressRows.map((row, index) => (
                    <div key={row.id ?? row.name} className="grid grid-cols-[1fr_0.8fr_0.8fr] gap-2">
                      <input value={row.name} onChange={(e) => updateProgressRow(index, { name: e.target.value })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                      <input type="number" value={row.planned} onChange={(e) => updateProgressRow(index, { planned: Number(e.target.value) || 0 })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                      <input type="number" value={row.realized} onChange={(e) => updateProgressRow(index, { realized: Number(e.target.value) || 0 })} className="rounded-xl border border-stone-200 px-3 py-2 text-sm" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {formError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closeEdit} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar meta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
