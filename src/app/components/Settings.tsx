import { useState } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { CategorySelect } from "./CategorySelect";

export function Settings() {
  const {
    fixedExpenses,
    settings,
    paymentMethods,
    deleteFixedExpense,
    updateSettings,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
  } = useFinance();

  const [monthlyIncome, setMonthlyIncome] = useState(settings.monthlyIncome ? settings.monthlyIncome.toString() : "");
  const [partner1, setPartner1] = useState(settings.partnerNames[0]);
  const [partner2, setPartner2] = useState(settings.partnerNames[1]);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const defaultPaymentMethodNames = new Set(["Pix", "Dinheiro", "Débito"]);

  const handleSaveSettings = () => {
    updateSettings({
      monthlyIncome: parseFloat(monthlyIncome) || 0,
      partnerNames: [partner1, partner2],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
                Formas de Pagamento
              </label>
              <div className="space-y-2 mb-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between bg-stone-50 p-3 rounded-lg group"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-900">{method.name}</p>
                      <p className="text-xs text-stone-500">
                        Limite: {method.limitAmount !== null ? formatBRL(method.limitAmount) : "sem limite definido"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMethodId(method.id)}
                        className="text-stone-400 hover:text-emerald-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!defaultPaymentMethodNames.has(method.name)) {
                            void deletePaymentMethod(method.id);
                          }
                        }}
                        disabled={defaultPaymentMethodNames.has(method.name)}
                        className="text-stone-400 hover:text-rose-600 transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAddPaymentMethod(true)}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar Forma de Pagamento
              </button>
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
                Nenhuma conta fixa cadastrada.
              </p>
            )}
          </div>
        </div>
      </div>

      {showAddPaymentMethod && (
        <AddPaymentMethodModal
          onClose={() => {
            setShowAddPaymentMethod(false);
            setEditingMethodId(null);
          }}
          editingId={editingMethodId}
        />
      )}
      {showAddFixed && (
        <AddFixedExpenseModal onClose={() => setShowAddFixed(false)} />
      )}
    </Layout>
  );
}

interface AddFixedExpenseModalProps {
  onClose: () => void;
}

interface AddPaymentMethodModalProps {
  onClose: () => void;
  editingId?: string | null;
}

function AddPaymentMethodModal({
  onClose,
  editingId,
}: AddPaymentMethodModalProps) {
  const { addPaymentMethod, updatePaymentMethod, paymentMethods } =
    useFinance();
  const editingMethod = editingId
    ? paymentMethods.find((m) => m.id === editingId)
    : null;
  const [name, setName] = useState(editingMethod?.name || "");
  const [limitAmount, setLimitAmount] = useState(
    editingMethod?.limitAmount !== null && editingMethod?.limitAmount !== undefined
      ? editingMethod.limitAmount.toString()
      : "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editingId && editingMethod) {
      await updatePaymentMethod(editingId, trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined);
    } else {
      await addPaymentMethod(trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-96 shadow-lg">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {editingId ? "Editar" : "Adicionar"} Forma de Pagamento
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
              placeholder="Ex: Nubank Bruno"
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Limite total
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
            >
              {editingId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFixedExpenseModal({ onClose }: AddFixedExpenseModalProps) {
  const { addFixedExpense, categories } = useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!name || !value) return;

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const categoryName = selectedCategory?.name || "";

    addFixedExpense({
      name,
      amount: value,
      category: categoryName,
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
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Selecione a categoria"
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
