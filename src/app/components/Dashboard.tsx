import { useState, useMemo } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Plus, TrendingDown, Wallet, Sparkles, Users } from "lucide-react";
import { AddExpenseModal } from "./AddExpenseModal";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { RecentExpenses } from "./RecentExpenses";
import {
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  getDate,
  getDaysInMonth,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export function Dashboard() {
  const { expenses, installments, fixedExpenses, settings, loading, error } = useFinance();
  const [showAddExpense, setShowAddExpense] = useState(false);

  const now = new Date();
  const currentMonth = useMemo(
    () => ({ start: startOfMonth(now), end: endOfMonth(now) }),
    []
  );

  const data = useMemo(() => {
    const monthExpenses = expenses.filter((e) =>
      isWithinInterval(parseISO(e.date), currentMonth)
    );
    const variableSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const fixedTotal = fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const installmentsTotal = installments.reduce(
      (s, i) => s + i.monthlyAmount,
      0
    );
    const committed = fixedTotal + installmentsTotal;
    const totalSpent = committed + variableSpent;
    const available = settings.monthlyIncome - totalSpent;

    const partner1Total = monthExpenses
      .filter((e) => e.paidBy === settings.partnerNames[0])
      .reduce((s, e) => s + e.amount, 0);
    const partner2Total = monthExpenses
      .filter((e) => e.paidBy === settings.partnerNames[1])
      .reduce((s, e) => s + e.amount, 0);

    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const daysLeft = daysInMonth - dayOfMonth;
    const dailyPace = dayOfMonth > 0 ? variableSpent / dayOfMonth : 0;
    const projectedVariable = dailyPace * daysInMonth;
    const projectedLeftover =
      settings.monthlyIncome - committed - projectedVariable;

    return {
      income: settings.monthlyIncome,
      fixedTotal,
      installmentsTotal,
      variableSpent,
      committed,
      totalSpent,
      available,
      monthExpenses,
      partner1Total,
      partner2Total,
      daysLeft,
      projectedLeftover,
      dailyPace,
    };
  }, [expenses, installments, fixedExpenses, settings, currentMonth]);

  const monthLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });
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
      ? `Se continuarem nesse ritmo, sobrarão ${formatBRL(
          data.projectedLeftover
        )} no fim do mês.`
      : `Atenção: nesse ritmo, vocês vão ultrapassar em ${formatBRL(
          Math.abs(data.projectedLeftover)
        )} até o fim do mês.`;

  return (
    <Layout>
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}
      {loading && (
        <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          Carregando dados do Supabase...
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500">
              {monthLabel}
            </p>
            <h1 className="text-2xl font-semibold text-stone-900 mt-1">
              Oi, {settings.partnerNames[0] || "vocês"} e{" "}
              {settings.partnerNames[1] || "vocês"} 👋
            </h1>
          </div>
          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo gasto
          </button>
        </div>

        {/* Hero - Livre para gastar */}
        <div className="bg-gradient-to-br from-white to-stone-50 rounded-3xl p-8 border border-stone-200">
          <p className="text-sm text-stone-600 mb-2">Livre para gastar</p>
          <h2 className={`text-6xl font-semibold ${availableColor}`}>
            {formatBRL(data.available)}
          </h2>
          <p className="text-sm text-stone-500 mt-3">
            Depois de tirar contas fixas, parcelas e o que já saiu esse mês.
          </p>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-stone-500 mb-2">
              <span>Uso do orçamento</span>
              <span>
                {((data.totalSpent / data.income) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden flex">
              <div
                className="bg-stone-400"
                style={{ width: `${(data.fixedTotal / data.income) * 100}%` }}
              />
              <div
                className="bg-indigo-400"
                style={{
                  width: `${(data.installmentsTotal / data.income) * 100}%`,
                }}
              />
              <div
                className="bg-emerald-400"
                style={{
                  width: `${(data.variableSpent / data.income) * 100}%`,
                }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-stone-600 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-stone-400 rounded-sm" /> Fixas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-indigo-400 rounded-sm" />{" "}
                Parcelas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" />{" "}
                Variáveis
              </span>
            </div>
          </div>
        </div>

        {/* Future risk projection */}
        <div className={`rounded-2xl p-5 border ${projectionTone}`}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">{projectionMessage}</p>
              <p className="text-xs opacity-75 mt-1">
                Faltam {data.daysLeft} dias. Ritmo atual:{" "}
                {formatBRL(data.dailyPace)} por dia.
              </p>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              <Wallet className="w-4 h-4" />
              Renda do mês
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.income)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              <TrendingDown className="w-4 h-4" />
              Comprometimento do mês
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.committed)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              {formatBRL(data.fixedTotal)} fixas ·{" "}
              {formatBRL(data.installmentsTotal)} parcelas
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              <Plus className="w-4 h-4" />
              Já gastaram esse mês
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.variableSpent)}
            </p>
          </div>
        </div>

        {/* Couple awareness */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <div className="flex items-center gap-2 text-stone-700 mb-4">
            <Users className="w-4 h-4" />
            <h3 className="font-medium">Quem gastou esse mês</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PartnerCard
              name={settings.partnerNames[0]}
              amount={data.partner1Total}
              total={data.variableSpent}
              tone="emerald"
            />
            <PartnerCard
              name={settings.partnerNames[1]}
              amount={data.partner2Total}
              total={data.variableSpent}
              tone="indigo"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryBreakdown expenses={data.monthExpenses} />
          <RecentExpenses expenses={data.monthExpenses} />
        </div>
      </div>

      {showAddExpense && (
        <AddExpenseModal onClose={() => setShowAddExpense(false)} />
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
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-stone-800">{name}</p>
        <p className="text-xs text-stone-500">{pct.toFixed(0)}%</p>
      </div>
      <p className="text-2xl font-semibold text-stone-900 mb-3">
        {formatBRL(amount)}
      </p>
      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
        <div
          className={`h-full ${toneMap[tone].bar} rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
