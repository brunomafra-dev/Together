import { Layout } from "./Layout";
import { formatBRL, useFinance } from "../context/FinanceContext";
import { CircleDollarSign, Compass, Edit3, Lightbulb, Sparkles, Target, TrendingDown, Wallet } from "lucide-react";

const planCards = [
  { name: "Moradia", share: "35%", amount: 4200, tone: "stone" },
  { name: "Alimentação", share: "20%", amount: 2400, tone: "emerald" },
  { name: "Investimentos", share: "15%", amount: 1800, tone: "cyan" },
  { name: "Lazer", share: "10%", amount: 1200, tone: "amber" },
  { name: "Outros", share: "20%", amount: 2400, tone: "indigo" },
];

const progressRows = [
  { name: "Moradia", planned: 4200, realized: 3409, tone: "sky", status: "Abaixo do esperado" },
  { name: "Alimentação", planned: 2400, realized: 377.5, tone: "sky", status: "Abaixo do esperado" },
  { name: "Investimentos", planned: 1800, realized: 0, tone: "sky", status: "Abaixo do esperado" },
  { name: "Lazer", planned: 1200, realized: 89.9, tone: "sky", status: "Abaixo do esperado" },
  { name: "Outros", planned: 2400, realized: 1620, tone: "sky", status: "Abaixo do esperado" },
];

const insights = [
  "Moradia está 19% abaixo do planejado.",
  "Alimentação está 84% abaixo do planejado.",
  "Lazer está 93% abaixo do planejado.",
  "Outros está 32% abaixo do planejado.",
];

function toneClass(tone: string) {
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

export function Goals() {
  const { settings } = useFinance();
  const income = settings.monthlyIncome || 12000;
  const mainGoalTotal = 15000;
  const current = 8000;
  const percent = Math.round((current / mainGoalTotal) * 100);
  const remaining = mainGoalTotal - current;

  return (
    <Layout>
      <div className="space-y-7">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Metas</h1>
          <p className="text-sm text-stone-600">Como o ritmo de vocês conversa com os planos do casal</p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
              <Target className="h-5 w-5 text-stone-500" />
              <span>Objetivo principal</span>
            </div>
            <button className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
              <Edit3 className="h-4 w-4" />
              Editar objetivo
            </button>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-50 p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
                  Construindo juntos
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-stone-950">Reserva de Emergência</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    {formatBRL(current)} de {formatBRL(mainGoalTotal)}
                  </p>
                </div>
                <div className="w-full max-w-3xl">
                  <div className="h-3 rounded-full bg-stone-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
                    Faltam {formatBRL(remaining)} para completar. No ritmo atual, vocês estão no caminho <span className="font-medium">💪</span>
                  </p>
                </div>
              </div>

              <div className="min-w-[140px] text-right">
                <div className="text-5xl font-semibold text-teal-700">{percent}%</div>
                <p className="mt-1 text-sm text-stone-500">concluído</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
              <Wallet className="h-5 w-5 text-stone-500" />
              <span>Planejamento do casal</span>
            </div>
            <button className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
              <Edit3 className="h-4 w-4" />
              Ajustar plano
            </button>
          </div>
          <p className="text-sm text-stone-600">Como vocês decidiram dividir a renda mensal de {formatBRL(income)}</p>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {planCards.map((card) => (
              <article key={card.name} className={`rounded-2xl border p-4 ${toneClass(card.tone)}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-base font-medium">{card.name}</h3>
                  <span className="text-sm text-stone-500">{card.share}</span>
                </div>
                <p className="mt-5 text-2xl font-semibold">{formatBRL(card.amount)}</p>
                <div className="mt-6 h-2 rounded-full bg-white/70">
                  <div
                    className="h-2 rounded-full bg-current opacity-70"
                    style={{ width: card.share }}
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
            <TrendingDown className="h-5 w-5 text-stone-500" />
            <span>Planejado vs Realizado</span>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
            {progressRows.map((row, index) => {
              const pct = row.planned > 0 ? Math.min((row.realized / row.planned) * 100, 100) : 0;
              const diff = row.planned - row.realized;
              return (
                <div key={row.name} className={`p-5 ${index !== progressRows.length - 1 ? "border-b border-stone-100" : ""}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <h3 className="text-lg font-medium text-stone-950">{row.name}</h3>
                      <p className="text-sm text-stone-500">
                        Planejado: {formatBRL(row.planned)} · Realizado: {formatBRL(row.realized)}
                      </p>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700">
                      ↘ Abaixo do esperado
                    </span>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-stone-600">
                    {formatBRL(diff)} abaixo do plano
                  </p>
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
                  Excelente
                </div>
                <h3 className="text-2xl font-medium text-stone-950">
                  Vocês estão seguindo 100% do planejamento financeiro.
                </h3>
                <p className="text-sm text-stone-600">
                  Calculado a partir da aderência média de todas as categorias do plano.
                </p>
              </div>
              <div className="text-right">
                <div className="text-5xl font-semibold text-teal-700">100%</div>
                <p className="text-sm text-stone-500">aderência</p>
              </div>
            </div>
            <div className="mt-8 h-3 rounded-full bg-emerald-100">
              <div className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: "100%" }} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-stone-950">Radar do mês</h3>
                <p className="text-sm text-stone-600">Um resumo do ritmo atual</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-white/70 p-4 text-stone-800">
              Se continuarem nesse ritmo, sobrarão {formatBRL(2566.6)} no fim do mês.
            </div>
            <p className="mt-3 text-sm text-stone-600">
              Ótimo ritmo. Vocês podem direcionar essa sobra para a Reserva de Emergência e acelerar a meta principal.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 text-2xl font-medium text-stone-900">
            <Lightbulb className="h-5 w-5 text-stone-500" />
            <span>Insights do Together</span>
          </div>

          <div className="space-y-3">
            {insights.map((item) => (
              <div key={item} className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sky-900 shadow-sm">
                <div className="flex items-start gap-3">
                  <CircleDollarSign className="mt-0.5 h-4 w-4 text-amber-500" />
                  <p className="text-sm">{item}</p>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-emerald-950 shadow-sm">
              <div className="flex items-start gap-3">
                <Compass className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p className="text-sm">
                  Vocês podem encerrar o mês com {formatBRL(2566.6)} de sobra — mais do que o esperado.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
