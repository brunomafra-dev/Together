import { useState } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Plus, Trash2, Save, X } from "lucide-react";

export function Settings() {
  const {
    fixedExpenses,
    settings,
    deleteFixedExpense,
    updateSettings,
  } = useFinance();

  const [monthlyIncome, setMonthlyIncome] = useState(
    settings.monthlyIncome.toString()
  );
  const [partner1, setPartner1] = useState(settings.partnerNames[0]);
  const [partner2, setPartner2] = useState(settings.partnerNames[1]);
  const [cards, setCards] = useState<string[]>(settings.cards);
  const [newCard, setNewCard] = useState("");
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveSettings = () => {
    updateSettings({
      monthlyIncome: parseFloat(monthlyIncome) || 0,
      partnerNames: [partner1, partner2],
      cards,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCard = () => {
    if (newCard.trim() && !cards.includes(newCard.trim())) {
      setCards([...cards, newCard.trim()]);
      setNewCard("");
    }
  };

  const removeCard = (c: string) => setCards(cards.filter((x) => x !== c));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Ajustes</h1>
          <p className="text-sm text-stone-600 mt-1">
            Configure renda, casal e contas fixas
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-4">Casal & renda</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Renda mensal combinada (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                  Parceiro 1
                </label>
                <input
                  type="text"
                  value={partner1}
                  onChange={(e) => setPartner1(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                  Parceiro 2
                </label>
                <input
                  type="text"
                  value={partner2}
                  onChange={(e) => setPartner2(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Cartões / formas de pagamento
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {cards.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 py-1.5 rounded-lg text-sm"
                  >
                    {c}
                    <button
                      onClick={() => removeCard(c)}
                      className="text-stone-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCard())}
                  className="flex-1 px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="ex: Nubank"
                />
                <button
                  type="button"
                  onClick={addCard}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveSettings}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              {saved ? "Salvo!" : "Salvar ajustes"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-stone-900">Contas fixas</h2>
            <button
              onClick={() => setShowAddFixed(true)}
              className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          <div className="space-y-1">
            {fixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0 group"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {expense.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {expense.category} · vence dia {expense.dueDate}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-stone-900">
                    {formatBRL(expense.amount)}
                  </p>
                  <button
                    onClick={() => deleteFixedExpense(expense.id)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {fixedExpenses.length === 0 && (
              <p className="text-center py-8 text-stone-400 text-sm">
                Nenhuma conta fixa cadastrada
              </p>
            )}
          </div>
        </div>
      </div>

      {showAddFixed && (
        <AddFixedExpenseModal onClose={() => setShowAddFixed(false)} />
      )}
    </Layout>
  );
}

interface AddFixedExpenseModalProps {
  onClose: () => void;
}

function AddFixedExpenseModal({ onClose }: AddFixedExpenseModalProps) {
  const { addFixedExpense } = useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Moradia");
  const [dueDate, setDueDate] = useState("1");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!name || !value) return;
    addFixedExpense({
      name,
      amount: value,
      category,
      dueDate: parseInt(dueDate),
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
          Nova conta fixa
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
              placeholder="ex: Aluguel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Valor
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Dia do vencimento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <option>Moradia</option>
              <option>Contas</option>
              <option>Seguros</option>
              <option>Assinaturas</option>
              <option>Saúde</option>
              <option>Lazer</option>
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
