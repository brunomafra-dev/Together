import { useEffect, useState } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL } from "../context/FinanceContext";
import { Plus, Trash2, Save, Edit2 } from "lucide-react";
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
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const defaultPaymentMethodNames = new Set(["Pix", "Dinheiro", "Débito"]);

  const handleSaveSettings = async () => {
    try {
      setSettingsError(null);
      await updateSettings({
        monthlyIncome: parseFloat(monthlyIncome) || 0,
        partnerNames: [partner1, partner2],
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Não foi possível salvar os ajustes.");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Ajustes</h1>
          <p className="mt-1 text-sm text-stone-600">Configure renda, casal e contas fixas</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 font-medium text-stone-900">Casal & renda</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                Renda mensal combinada (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Parceiro 1</label>
                <input
                  type="text"
                  value={partner1}
                  onChange={(e) => setPartner1(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Parceiro 2</label>
                <input
                  type="text"
                  value={partner2}
                  onChange={(e) => setPartner2(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Formas de Pagamento</label>
              <div className="mb-3 space-y-2">
                {paymentMethods.map((method) => (
                  <div key={method.id} className="group flex items-center justify-between rounded-lg bg-stone-50 p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-900">{method.name}</p>
                      <p className="text-xs text-stone-500">Limite: {method.limitAmount !== null ? formatBRL(method.limitAmount) : "sem limite definido"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMethodId(method.id)}
                        className="text-stone-400 transition-colors hover:text-emerald-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!defaultPaymentMethodNames.has(method.name)) {
                            void deletePaymentMethod(method.id);
                          }
                        }}
                        disabled={defaultPaymentMethodNames.has(method.name)}
                        className="text-stone-400 transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAddPaymentMethod(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white transition-colors hover:bg-stone-800"
              >
                <Plus className="h-4 w-4" />
                Adicionar cartão
              </button>
            </div>

            {settingsError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{settingsError}</p>
            )}

            <button
              type="button"
              onClick={() => void handleSaveSettings()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <Save className="h-4 w-4" />
              {saved ? "Salvo!" : "Salvar ajustes"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-stone-900">Contas fixas</h2>
            <button
              type="button"
              onClick={() => setShowAddFixed(true)}
              className="flex items-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white transition-colors hover:bg-stone-800"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          <div className="space-y-1">
            {fixedExpenses.map((expense) => (
              <div key={expense.id} className="group flex items-center justify-between border-b border-stone-100 py-3 last:border-0">
                <div>
                  <p className="text-sm font-medium text-stone-900">{expense.name}</p>
                  <p className="text-xs text-stone-500">{expense.category} · vence dia {expense.dueDate}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-stone-900">{formatBRL(expense.amount)}</p>
                  <button
                    type="button"
                    onClick={() => void deleteFixedExpense(expense.id)}
                    className="text-stone-400 transition-all hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            {fixedExpenses.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Nenhuma conta fixa cadastrada.</p>}
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
      {showAddFixed && <AddFixedExpenseModal onClose={() => setShowAddFixed(false)} />}
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

function AddPaymentMethodModal({ onClose, editingId }: AddPaymentMethodModalProps) {
  const { addPaymentMethod, updatePaymentMethod, paymentMethods } = useFinance();
  const editingMethod = editingId ? paymentMethods.find((m) => m.id === editingId) : null;
  const [name, setName] = useState(editingMethod?.name || "");
  const [limitAmount, setLimitAmount] = useState(
    editingMethod?.limitAmount !== null && editingMethod?.limitAmount !== undefined ? editingMethod.limitAmount.toString() : "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      setFormError(null);
      if (editingId && editingMethod) {
        await updatePaymentMethod(editingId, trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined);
      } else {
        await addPaymentMethod(trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined);
      }
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o cartão.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">{editingId ? "Editar cartão" : "Adicionar cartão"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Nubank Bruno"
              className="w-full rounded-lg border border-stone-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Limite total</label>
            <input
              type="text"
              inputMode="decimal"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-stone-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {formError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-stone-600 transition-colors hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700">
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
  const [dueDate, setDueDate] = useState("1");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    const parsedDueDate = parseInt(dueDate, 10);
    if (!name.trim() || !value || Number.isNaN(parsedDueDate) || parsedDueDate < 1 || parsedDueDate > 31) {
      setFormError("Preencha nome, valor e dia do vencimento.");
      return;
    }

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const categoryName = selectedCategory?.name || "";

    try {
      setFormError(null);
      await addFixedExpense({
        name: name.trim(),
        amount: value,
        category: categoryName,
        dueDate: parsedDueDate,
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a conta fixa.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-6 text-xl font-semibold text-stone-900">Nova conta fixa</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="ex: Aluguel"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Valor</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0,00"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Dia do vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">Categoria</label>
            <CategorySelect value={categoryId} onChange={setCategoryId} placeholder="Selecione a categoria" />
          </div>

          {formError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-stone-700 transition-colors hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
