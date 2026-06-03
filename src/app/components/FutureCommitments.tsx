import { useMemo } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Calendar, TrendingDown, TrendingUp } from "lucide-react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FutureCommitments() {
  const { installments, fixedExpenses, settings } = useFinance();

  const futureMonths = useMemo(() => {
    const months = [];
    const now = new Date();

    for (let i = 1; i <= 6; i++) {
      const monthDate = addMonths(now, i);
      const monthInstallments = installments
        .filter((inst) => inst.remainingMonths >= i)
        .reduce((sum, inst) => sum + inst.monthlyAmount, 0);
      const monthFixed = fixedExpenses.reduce((s, e) => s + e.amount, 0);
      const total = monthInstallments + monthFixed;
      months.push({
        date: monthDate,
        label: format(monthDate, "MMMM 'de' yyyy", { locale: ptBR }),
        installments: monthInstallments,
        fixed: monthFixed,
        total,
        free: settings.monthlyIncome - total,
      });
    }
    return months;
  }, [installments, fixedExpenses, settings]);

  const prevMonth = futureMonths[0]?.total || 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">
            Impacto futuro
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            O que já está comprometido nos próximos meses
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
          <p className="text-sm text-emerald-900 mb-1">
            Esse compromisso vai diminuir
          </p>
          <p className="text-stone-700 text-sm">
            Conforme as parcelas terminam, vocês recuperam dinheiro livre todo
            mês. Acompanhe abaixo como cada mês vai ficar mais leve.
          </p>
        </div>

        <div className="grid gap-3">
          {futureMonths.map((month, index) => {
            const change = index === 0 ? 0 : month.total - prevMonth;
            const isRelief = index > 0 && month.total < futureMonths[index - 1].total;

            return (
              <div
                key={index}
                className="bg-white rounded-2xl p-5 border border-stone-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stone-500" />
                    <h3 className="font-medium text-stone-900 capitalize">
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

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-stone-50 rounded-xl p-3">
                    <p className="text-xs text-stone-500 mb-1">Contas fixas</p>
                    <p className="font-semibold text-stone-900">
                      {formatBRL(month.fixed)}
                    </p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <p className="text-xs text-indigo-700 mb-1">Parcelas</p>
                    <p className="font-semibold text-indigo-900">
                      {formatBRL(month.installments)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <p className="text-xs text-emerald-700 mb-1">
                      Sobra estimada
                    </p>
                    <p className="font-semibold text-emerald-900">
                      {formatBRL(month.free)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-stone-600" />
            <h3 className="font-medium text-stone-900">Contas fixas ativas</h3>
          </div>
          <div className="space-y-2">
            {fixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between py-2.5 border-b border-stone-100 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {expense.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {expense.category} · vence dia {expense.dueDate}
                  </p>
                </div>
                <p className="text-sm font-medium text-stone-900">
                  {formatBRL(expense.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
