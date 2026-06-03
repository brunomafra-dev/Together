import { useState } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Plus, Trash2, TrendingDown, CalendarCheck, Sparkles } from "lucide-react";
import { addMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function Installments() {
  const { installments, deleteInstallment } = useFinance();
  const [showAddForm, setShowAddForm] = useState(false);

  const totalMonthly = installments.reduce(
    (s, i) => s + i.monthlyAmount,
    0
  );
  const totalRemaining = installments.reduce(
    (s, i) => s + i.monthlyAmount * i.remainingMonths,
    0
  );

  const nextRelief = [...installments]
    .filter((i) => i.remainingMonths > 0)
    .sort((a, b) => a.remainingMonths - b.remainingMonths)[0];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Parcelas</h1>
            <p className="text-sm text-stone-600 mt-1">
              O que ainda está pesando todo mês
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova parcela
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              <TrendingDown className="w-4 h-4" />
              Saindo todo mês
            </div>
            <p className="text-3xl font-semibold text-stone-900">
              {formatBRL(totalMonthly)}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="flex items-center gap-2 text-stone-500 text-xs mb-2">
              <CalendarCheck className="w-4 h-4" />
              Total que ainda falta
            </div>
            <p className="text-3xl font-semibold text-stone-900">
              {formatBRL(totalRemaining)}
            </p>
          </div>
        </div>

        {nextRelief && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-900">
                Próximo alívio: {nextRelief.name} acaba em{" "}
                {format(addMonths(new Date(), nextRelief.remainingMonths), "MMMM 'de' yyyy", {
                  locale: ptBR,
                })}
                .
              </p>
              <p className="text-xs text-emerald-800 mt-1">
                Vocês vão recuperar {formatBRL(nextRelief.monthlyAmount)} por mês
                no orçamento.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {installments.map((inst) => {
            const totalMonths = inst.currentMonth + inst.remainingMonths;
            const progress = (inst.currentMonth / totalMonths) * 100;
            const finalMonth = format(
              addMonths(new Date(), inst.remainingMonths),
              "MMMM 'de' yyyy",
              { locale: ptBR }
            );
            const emotional =
              progress >= 75
                ? "Quase lá! 🎉"
                : progress >= 50
                ? "Mais da metade já foi 💪"
                : progress >= 25
                ? "No caminho 🚶"
                : "Começando essa jornada";

            return (
              <div
                key={inst.id}
                className="bg-white rounded-2xl p-6 border border-stone-200 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-stone-900">{inst.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {inst.category} · termina em {finalMonth}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteInstallment(inst.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Por mês</p>
                    <p className="font-semibold text-stone-900">
                      {formatBRL(inst.monthlyAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Faltam</p>
                    <p className="font-semibold text-stone-900">
                      {inst.remainingMonths}{" "}
                      {inst.remainingMonths === 1 ? "mês" : "meses"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 mb-1">Ainda devem</p>
                    <p className="font-semibold text-stone-900">
                      {formatBRL(inst.monthlyAmount * inst.remainingMonths)}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-stone-600">{emotional}</span>
                    <span className="text-stone-500">
                      {inst.currentMonth} de {totalMonths}
                    </span>
                  </div>
                  <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {installments.length === 0 && (
            <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center">
              <p className="text-stone-400 text-sm">
                Nenhuma parcela em andamento. Que liberdade! 🎉
              </p>
            </div>
          )}
        </div>
      </div>

      {showAddForm && (
        <AddInstallmentModal onClose={() => setShowAddForm(false)} />
      )}
    </Layout>
  );
}

interface AddInstallmentModalProps {
  onClose: () => void;
}

function AddInstallmentModal({ onClose }: AddInstallmentModalProps) {
  const { addInstallment } = useFinance();
  const [name, setName] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [remainingMonths, setRemainingMonths] = useState("");
  const [category, setCategory] = useState("Eletrônicos");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = parseFloat(monthlyAmount.replace(",", "."));
    const months = parseInt(remainingMonths);
    if (!name || !monthly || !months) return;

    addInstallment({
      name,
      totalAmount: monthly * months,
      monthlyAmount: monthly,
      remainingMonths: months,
      currentMonth: 0,
      category,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-stone-900 mb-6">
          Nova parcela
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Nome
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ex: Geladeira nova"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Valor mensal
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Meses restantes
              </label>
              <input
                type="number"
                value={remainingMonths}
                onChange={(e) => setRemainingMonths(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="12"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option>Eletrônicos</option>
              <option>Casa</option>
              <option>Veículo</option>
              <option>Educação</option>
              <option>Viagem</option>
              <option>Outros</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
