import { useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { X } from "lucide-react";

interface AddExpenseModalProps {
  onClose: () => void;
}

const CATEGORIES = [
  "Mercado",
  "Restaurante",
  "Transporte",
  "Lazer",
  "Compras",
  "Saúde",
  "Casa",
  "Outros",
];

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 10, 12];

export function AddExpenseModal({ onClose }: AddExpenseModalProps) {
  const { addExpense, addInstallment, settings } = useFinance();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Mercado");
  const [card, setCard] = useState(settings.cards[0] || "Nubank");
  const [installments, setInstallments] = useState(1);
  const [paidBy, setPaidBy] = useState(settings.partnerNames[0]);
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) return;

    addExpense({
      amount: value,
      category,
      description,
      date: new Date().toISOString().split("T")[0],
      paidBy,
      card,
      installments,
    });

    if (installments > 1) {
      addInstallment({
        name: description || category,
        totalAmount: value,
        monthlyAmount: value / installments,
        remainingMonths: installments - 1,
        currentMonth: 1,
        category,
      });
    }

    onClose();
  };

  const installmentValue =
    installments > 1 && parseFloat(amount.replace(",", "."))
      ? parseFloat(amount.replace(",", ".")) / installments
      : 0;

  return (
    <div
      className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">
              Novo gasto
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Adicione rápido, ajustes depois.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Valor
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-2xl font-semibold border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0,00"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Categoria
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-2.5 rounded-lg text-sm transition-colors ${
                    category === cat
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Cartão
            </label>
            <div className="flex gap-2 flex-wrap">
              {settings.cards.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCard(c)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    card === c
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Parcelas
            </label>
            <div className="flex gap-2 flex-wrap">
              {INSTALLMENT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setInstallments(n)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    installments === n
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {n === 1 ? "À vista" : `${n}x`}
                </button>
              ))}
            </div>
            {installmentValue > 0 && (
              <p className="text-xs text-stone-500 mt-2">
                {installments}x de R${" "}
                {installmentValue.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Quem pagou
            </label>
            <div className="grid grid-cols-2 gap-2">
              {settings.partnerNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setPaidBy(name)}
                  className={`px-4 py-3 rounded-lg transition-colors ${
                    paidBy === name
                      ? "bg-stone-900 text-white"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Para que foi esse gasto?"
            />
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
              disabled={!amount || parseFloat(amount.replace(",", ".")) <= 0}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
