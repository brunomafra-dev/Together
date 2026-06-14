import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Expense, useFinance } from "../context/FinanceContext";
import { X } from "lucide-react";
import { CategorySelect } from "./CategorySelect";
import { PaymentMethodSelect } from "./PaymentMethodSelect";

interface AddExpenseModalProps {
  onClose: () => void;
  expense?: Expense;
}

function todayLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AddExpenseModal({ onClose, expense }: AddExpenseModalProps) {
  const { addExpense, updateExpense, household, settings, categories, paymentMethods } = useFinance();
  const isEditing = Boolean(expense);
  const [amount, setAmount] = useState(expense ? String(expense.amount).replace(".", ",") : "");
  const [categoryId, setCategoryId] = useState(expense?.category ?? "");
  const [methodId, setMethodId] = useState(expense?.card ?? "");
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? "");
  const [purchaseDate, setPurchaseDate] = useState(expense?.date ?? todayLocalDate());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [recurringMonthly, setRecurringMonthly] = useState(Boolean(expense?.recurringMonthly));
  const [showSubscriptionSuggestion, setShowSubscriptionSuggestion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const householdMembers = useMemo(() => {
    const names = [
      household?.partnerNames[0] || settings.partnerNames[0] || "",
      household?.partnerNames[1] || settings.partnerNames[1] || "",
    ];
    const ids = [household?.partnerIds[0] || "", household?.partnerIds[1] || ""];

    return names
      .map((name, index) => {
        const trimmedName = name.trim();
        return {
          id: ids[index] || trimmedName,
          name: trimmedName,
          value: trimmedName,
        };
      })
      .filter((member) => member.name);
  }, [household?.partnerIds, household?.partnerNames, settings.partnerNames]);
  const subscriptionCategoryId = useMemo(
    () => categories.find((category) => category.name.trim().toLowerCase() === "assinaturas")?.id ?? "",
    [categories],
  );
  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    if (value && value === subscriptionCategoryId) {
      setRecurringMonthly(true);
      setShowSubscriptionSuggestion(false);
    }
  };
  const isSubscriptionCategory = Boolean(subscriptionCategoryId && categoryId === subscriptionCategoryId);

  useEffect(() => {
    if ((!paidBy || !householdMembers.some((member) => member.value === paidBy)) && householdMembers[0]) {
      setPaidBy(householdMembers[0].value);
    }
    if (!methodId && paymentMethods.length > 0) {
      setMethodId(paymentMethods[0].id);
    }
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [householdMembers, paymentMethods, categories, paidBy, methodId, categoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    if (!value || value <= 0 || isSaving) return;

    setIsSaving(true);
    try {
      const payload = {
        amount: value,
        category: categoryId,
        description,
        date: purchaseDate,
        paidBy,
        card: methodId,
        recurringMonthly,
      };

      if (expense) {
        await updateExpense(expense.id, payload);
        toast.success("Gasto atualizado.");
      } else {
        await addExpense(payload);
        toast.success("Gasto salvo.");
      }

      onClose();
    } catch (err) {
      toast.error((err as Error)?.message || "Não foi possível salvar o gasto.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className="max-h-[100dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">{isEditing ? "Editar gasto" : "Novo gasto"}</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {isEditing ? "Ajuste os dados do lançamento." : "Adicione rápido, ajustes depois."}
            </p>
          </div>
          <button disabled={isSaving} onClick={handleClose} className="text-stone-400 hover:text-stone-600 disabled:opacity-50 transition-colors">
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
            <CategorySelect value={categoryId} onChange={handleCategoryChange} placeholder="Selecione a categoria" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Forma de pagamento</label>
            <PaymentMethodSelect value={methodId} onChange={setMethodId} placeholder="Selecione a forma de pagamento" />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Quem pagou</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">Selecione quem pagou</option>
              {householdMembers.map((member) => (
                <option key={member.id} value={member.value}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Data da compra</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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

          <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={recurringMonthly}
              onChange={(e) => {
                const checked = e.target.checked;
                setRecurringMonthly(checked);
                setShowSubscriptionSuggestion(checked && Boolean(subscriptionCategoryId) && !isSubscriptionCategory);
              }}
              className="mt-1 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              <span className="block font-medium text-stone-900">Recorrente mensal</span>
              <span className="text-xs text-stone-500">Marca para revisão mensal, sem lançar duplicado automaticamente.</span>
            </span>
          </label>

          {showSubscriptionSuggestion && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Quer classificar como assinatura?</p>
              <p className="mt-1 text-xs text-amber-800">
                Se for uma compra recorrente, como fralda ou remédio, mantenha a categoria atual.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionSuggestion(false)}
                  className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-900"
                >
                  Manter categoria
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryId(subscriptionCategoryId);
                    setShowSubscriptionSuggestion(false);
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-medium text-white"
                >
                  Trocar para Assinaturas
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 disabled:opacity-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !amount || parseFloat(amount.replace(",", ".")) <= 0 || !paidBy}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSaving ? "Salvando..." : isEditing ? "Salvar edição" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
