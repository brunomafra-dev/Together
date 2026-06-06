import { useMemo, useState } from "react";
import { endOfMonth, format, getDate, getDaysInMonth, isWithinInterval, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Sparkles, TrendingDown, Users, Wallet } from "lucide-react";
import { AddExpenseModal } from "./AddExpenseModal";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { Layout } from "./Layout";
import { RecentExpenses } from "./RecentExpenses";
import { formatBRL, useFinance } from "../context/FinanceContext";

export function Dashboard() {
  const {
    household,
    expenses,
    installments,
    fixedExpenses,
    categories,
    paymentMethods,
    settings,
    loading,
    error,
  } = useFinance();
  const [showAddExpense, setShowAddExpense] = useState(false);

  const now = new Date();
  const currentMonth = useMemo(
    () => ({ start: startOfMonth(now), end: endOfMonth(now) }),
    [],
  );

  const data = useMemo(() => {
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const paymentMethodNames = new Map(paymentMethods.map((method) => [method.id, method.name]));
    const householdNames = household?.partnerNames ?? settings.partnerNames.filter(Boolean);

    const resolvedExpenses = expenses.map((expense) => ({
      ...expense,
      category: categoryNames.get(expense.category) || expense.category || "Sem categoria",
      card: expense.card ? paymentMethodNames.get(expense.card) || expense.card : null,
      paidBy: householdNames.find((name) => name === expense.paidBy) || expense.paidBy || "Sem responsavel",
    }));

    const monthExpenses = resolvedExpenses.filter((expense) =>
      isWithinInterval(parseISO(expense.date), currentMonth),
    );

    const variableSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const fixedTotal = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const installmentsTotal = installments.reduce((sum, installment) => sum + installment.monthlyAmount, 0);
    const committed = fixedTotal + installmentsTotal;
    const totalSpent = committed + variableSpent;
    const income = settings.monthlyIncome;
    const available = income - totalSpent;

    const spendByPerson = monthExpenses.reduce((acc, expense) => {
      acc[expense.paidBy] = (acc[expense.paidBy] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const peopleTotals = Object.entries(spendByPerson)
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);

    const dayOfMonth = getDate(now);
    const daysInMonth = getDaysInMonth(now);
    const daysLeft = daysInMonth - dayOfMonth;
    const dailyPace = dayOfMonth > 0 ? variableSpent / dayOfMonth : 0;
    const projectedVariable = dailyPace * daysInMonth;
    const projectedLeftover = income - committed - projectedVariable;

    return {
      income,
      fixedTotal,
      installmentsTotal,
      variableSpent,
      committed,
      totalSpent,
      available,
      monthExpenses,
      peopleTotals,
      daysLeft,
      projectedLeftover,
      dailyPace,
    };
  }, [categories, currentMonth, expenses, fixedExpenses, household?.partnerNames, installments, paymentMethods, settings.monthlyIncome, settings.partnerNames]);

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
      ? `Se continuarem nesse ritmo, sobrarao ${formatBRL(data.projectedLeftover)} no fim do mes.`
      : `Atencao: nesse ritmo, voces vao ultrapassar em ${formatBRL(Math.abs(data.projectedLeftover))} ate o fim do mes.`;

  const greetingNames = household?.partnerNames?.filter(Boolean) ?? settings.partnerNames.filter(Boolean);

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
            <h1 className="mt-1 text-2xl font-semibold text-stone-900">
              {greetingNames.length > 0 ? `Oi, ${greetingNames.join(" e ")}` : "Oi"} 
            </h1>
          </div>
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-white shadow-sm transition-colors hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />
            Novo gasto
          </button>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-white to-stone-50 p-8">
          <p className="mb-2 text-sm text-stone-600">Livre para gastar</p>
          <h2 className={`text-6xl font-semibold ${availableColor}`}>
            {formatBRL(data.available)}
          </h2>
          <p className="mt-3 text-sm text-stone-500">
            Calculado com renda do household, contas fixas, parcelas e gastos reais do mes.
          </p>

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-xs text-stone-500">
              <span>Uso do orcamento</span>
              <span>{data.income > 0 ? `${((data.totalSpent / data.income) * 100).toFixed(0)}%` : "0%"}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div
                className="bg-stone-400"
                style={{ width: `${data.income > 0 ? (data.fixedTotal / data.income) * 100 : 0}%` }}
              />
              <div
                className="bg-indigo-400"
                style={{ width: `${data.income > 0 ? (data.installmentsTotal / data.income) * 100 : 0}%` }}
              />
              <div
                className="bg-emerald-400"
                style={{ width: `${data.income > 0 ? (data.variableSpent / data.income) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-stone-400" /> Fixas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-400" /> Parcelas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Variaveis
              </span>
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
              Renda do household
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.income)}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <TrendingDown className="h-4 w-4" />
              Comprometimento
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.committed)}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {formatBRL(data.fixedTotal)} fixas - {formatBRL(data.installmentsTotal)} parcelas
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-2 flex items-center gap-2 text-xs text-stone-500">
              <Plus className="h-4 w-4" />
              Gastos do mes
            </div>
            <p className="text-xl font-semibold text-stone-900">
              {formatBRL(data.variableSpent)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2 text-stone-700">
            <Users className="h-4 w-4" />
            <h3 className="font-medium">Quem gastou</h3>
          </div>
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
            <p className="text-sm text-stone-500">
              Nenhum gasto real encontrado para mostrar este card.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CategoryBreakdown expenses={data.monthExpenses} />
          <RecentExpenses expenses={data.monthExpenses} />
        </div>
      </div>

      {showAddExpense && <AddExpenseModal onClose={() => setShowAddExpense(false)} />}
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-stone-800">{name}</p>
        <p className="text-xs text-stone-500">{pct.toFixed(0)}%</p>
      </div>
      <p className="mb-3 text-2xl font-semibold text-stone-900">
        {formatBRL(amount)}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/60">
        <div
          className={`h-full rounded-full transition-all ${toneMap[tone].bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
