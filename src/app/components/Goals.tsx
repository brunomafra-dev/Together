import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Compass, Edit3, Lightbulb, Sparkles, Target, TrendingDown, Wallet } from "lucide-react";
import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import * as financeService from "../../services/financeService";

type GoalTone = "stone" | "emerald" | "cyan" | "amber" | "indigo";

type GoalViewModel = {
  mainGoal: {
    title: string;
    label: string;
    current: number;
    total: number;
  };
  householdIncome: number;
  planCards: Array<{ name: string; share: string; amount: number; tone: GoalTone }>;
  progressRows: Array<{ name: string; planned: number; realized: number; status: string }>;
  financialHealth: { score: number; label: string; description: string };
  monthRadar: { label: string; summary: string; note: string };
  insights: Array<{ kind: "info" | "positive"; text: string }>;
};

const FALLBACK_GOAL: GoalViewModel = {
  mainGoal: { title: "Reserva de Emergência", label: "Construindo juntos", current: 8000, total: 15000 },
  householdIncome: 12000,
  planCards: [
    { name: "Moradia", share: "35%", amount: 4200, tone: "stone" },
    { name: "Alimentação", share: "20%", amount: 2400, tone: "emerald" },
    { name: "Investimentos", share: "15%", amount: 1800, tone: "cyan" },
    { name: "Lazer", share: "10%", amount: 1200, tone: "amber" },
    { name: "Outros", share: "20%", amount: 2400, tone: "indigo" },
  ],
  progressRows: [
    { name: "Moradia", planned: 4200, realized: 3409, status: "Abaixo do esperado" },
    { name: "Alimentação", planned: 2400, realized: 377.5, status: "Abaixo do esperado" },
    { name: "Investimentos", planned: 1800, realized: 0, status: "Abaixo do esperado" },
    { name: "Lazer", planned: 1200, realized: 89.9, status: "Abaixo do esperado" },
    { name: "Outros", planned: 2400, realized: 1620, status: "Abaixo do esperado" },
  ],
  financialHealth: { score: 100, label: "Excelente", description: "Vocês estão seguindo 100% do planejamento financeiro." },
  monthRadar: { label: "Radar do mês", summary: "Se continuarem nesse ritmo, sobrarão R$ 2.566,60 no fim do mês.", note: "Ótimo ritmo. Vocês podem direcionar essa sobra para a Reserva de Emergência e acelerar a meta principal." },
  insights: [
    { kind: "info", text: "Moradia está 19% abaixo do planejado." },
    { kind: "info", text: "Alimentação está 84% abaixo do planejado." },
    { kind: "info", text: "Lazer está 93% abaixo do planejado." },
    { kind: "info", text: "Outros está 32% abaixo do planejado." },
    { kind: "positive", text: "Vocês podem encerrar o mês com R$ 2.566,60 de sobra." },
  ],
};

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

function GoalSectionHeader({ icon: Icon, title, actionLabel }: { icon: typeof Target; title: string; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
        <Icon className="h-5 w-5 text-stone-500" />
        <span>{title}</span>
      </div>
      {actionLabel ? (
        <button type="button" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
          <Edit3 className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function GoalProgressBar({ percent }: { percent: number }) {
  return (
    <div className="mt-4 h-2 rounded-full bg-stone-100">
      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Goals() {
  const { household, settings } = useFinance();
  const [dbGoal, setDbGoal] = useState<GoalViewModel | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!household?.id) return;
      const goals = await financeService.fetchGoals(household.id).catch(() => []);
      const goal = goals[0];
      if (!goal) {
        setDbGoal(null);
        return;
      }
      const planItems = await financeService.fetchGoalPlanItems(goal.id).catch(() => []);
      const progressRows = await financeService.fetchGoalProgressRows(goal.id).catch(() => []);
      setDbGoal({
        mainGoal: {
          title: goal.title,
          label: goal.label,
          current: goal.currentAmount,
          total: goal.targetAmount,
        },
        householdIncome: settings.monthlyIncome || household.monthlyIncome || 0,
        planCards: planItems.map((item) => ({ name: item.name, share: item.share, amount: item.amount, tone: item.tone })),
        progressRows: progressRows.map((row) => ({ name: row.name, planned: row.planned, realized: row.realized, status: row.status })),
        financialHealth: {
          score: progressRows.length > 0 ? Math.round(progressRows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / progressRows.length) : 0,
          label: "Saúde financeira",
          description: "Aderência ao plano calculada com dados reais do Supabase.",
        },
        monthRadar: {
          label: "Radar do mês",
          summary: "Projeção calculada a partir dos dados do banco.",
          note: "Depois podemos sofisticar esta análise sem mexer na UI.",
        },
        insights: progressRows.map((row) => ({ kind: "info", text: `${row.name} está ${row.planned - row.realized >= 0 ? "abaixo" : "acima"} do planejado.` })),
      });
    };
    void load();
  }, [household?.id, settings.monthlyIncome, household?.monthlyIncome]);

  const snapshot = dbGoal ?? FALLBACK_GOAL;
  const mainGoalPercent = Math.round((snapshot.mainGoal.current / snapshot.mainGoal.total) * 100);
  const mainGoalRemaining = snapshot.mainGoal.total - snapshot.mainGoal.current;
  const averagePlanUsage = Math.round(snapshot.progressRows.reduce((sum, row) => sum + (row.planned > 0 ? (row.realized / row.planned) * 100 : 0), 0) / snapshot.progressRows.length || 0);

  return (
    <Layout>
      <div className="space-y-7">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Metas</h1>
          <p className="text-sm text-stone-600">Como o ritmo de vocês conversa com os planos do casal</p>
          <p className="text-xs text-stone-500">Dados reais do Supabase quando disponíveis; fallback local quando não houver meta cadastrada.</p>
        </header>

        <section className="space-y-4">
          <GoalSectionHeader icon={Target} title="Objetivo principal" actionLabel="Editar objetivo" />
          <div className="rounded-[2rem] border border-stone-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
                  {snapshot.mainGoal.label}
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-stone-950">{snapshot.mainGoal.title}</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    {formatBRL(snapshot.mainGoal.current)} de {formatBRL(snapshot.mainGoal.total)}
                  </p>
                </div>
                <div className="w-full max-w-3xl">
                  <div className="h-3 rounded-full bg-stone-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${mainGoalPercent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
                    Faltam {formatBRL(mainGoalRemaining)} para completar.
                  </p>
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
          <GoalSectionHeader icon={Wallet} title="Planejamento do casal" actionLabel="Ajustar plano" />
          <p className="text-sm text-stone-600">Como vocês decidiram dividir a renda mensal de {formatBRL(snapshot.householdIncome)}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.planCards.map((card) => (
              <article key={card.name} className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-medium">{card.name}</h3>
                  <span className="text-sm text-stone-500">{card.share}</span>
                </div>
                <p className="mt-5 text-2xl font-semibold">{formatBRL(card.amount)}</p>
                <div className="mt-6 h-2 rounded-full bg-white/70">
                  <div className="h-2 rounded-full bg-current opacity-70" style={{ width: card.share }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <GoalSectionHeader icon={TrendingDown} title="Planejado vs Realizado" />
          <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            {snapshot.progressRows.map((row, index) => {
              const pct = row.planned > 0 ? Math.min((row.realized / row.planned) * 100, 100) : 0;
              const diff = row.planned - row.realized;
              return (
                <div key={row.name} className={`p-5 ${index !== snapshot.progressRows.length - 1 ? "border-b border-stone-100" : ""}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-stone-950">{row.name}</h3>
                      <p className="text-sm text-stone-500">Planejado: {formatBRL(row.planned)} · Realizado: {formatBRL(row.realized)}</p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">↘ {row.status}</span>
                  </div>
                  <GoalProgressBar percent={pct} />
                  <p className="mt-3 text-sm text-stone-600">{formatBRL(diff)} abaixo do plano</p>
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
          <GoalSectionHeader icon={Lightbulb} title="Insights do Together" />
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
            <p className="mt-2 text-sm text-stone-600">Estrutura local pronta para substituir os mocks por dados do Supabase depois.</p>
          </article>
        </section>
      </div>
    </Layout>
  );
}
