import { useEffect, useState } from "react";
import { useFinance } from "../context/FinanceContext";
import { X } from "lucide-react";
import { CategorySelect } from "./CategorySelect";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

interface AddExpenseModalProps {
  onClose: () => void;
}

export function AddExpenseModal({ onClose }: AddExpenseModalProps) {
  const { addExpense, settings, categories, paymentMethods, loading } = useFinance();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [paidBy, setPaidBy] = useState(settings.partnerNames[0] || "");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!paidBy && settings.partnerNames[0]) {
      setPaidBy(settings.partnerNames[0]);
    }
    if (!methodId && paymentMethods.length > 0) {
      setMethodId(paymentMethods[0].id);
    }
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [settings.partnerNames, paymentMethods, categories, paidBy, methodId, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0) {
      setFormError("Informe um valor válido.");
      return;
    }

    if (loading || categories.length === 0 || paymentMethods.length === 0) {
      setFormError("Aguarde o carregamento das categorias e formas de pagamento.");
      return;
    }

    if (!categoryId || !categories.some((c) => c.id === categoryId)) {
      setFormError("Selecione uma categoria válida.");
      return;
    }

    if (!methodId || !paymentMethods.some((m) => m.id === methodId)) {
      setFormError("Selecione uma forma de pagamento válida.");
      return;
    }

    if (!paidBy.trim()) {
      setFormError("Informe quem pagou.");
      return;
    }

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const categoryName = selectedCategory?.name || "";

    try {
      setFormError(null);
      await addExpense({
        amount: value,
        category: categoryName,
        description,
        date: new Date().toISOString().split("T")[0],
        paidBy: paidBy.trim(),
        card: methodId,
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o gasto.");
    }
  };

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
            <h2 className="text-xl font-semibold text-stone-900">Novo gasto</h2>
            <p className="text-xs text-stone-500 mt-0.5">Adicione rápido, ajustes depois.</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Valor</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">R$</span>
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
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Categoria</label>
            <CategorySelect value={categoryId} onChange={setCategoryId} placeholder="Selecione a categoria" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Forma de pagamento</label>
            <PaymentMethodSelect value={methodId} onChange={setMethodId} placeholder="Selecione a forma de pagamento" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Quem pagou</label>
            <input
              type="text"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Digite quem pagou"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Descrição (opcional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Para que foi esse gasto?"
            />
          </div>

          {formError && (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {formError}
            </p>
          )}

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
