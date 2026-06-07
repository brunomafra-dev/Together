import { useEffect, useRef, useState } from "react";
import { Layout } from "./Layout";
import { useFinance, formatBRL, MonthlySnapshotModel } from "../context/FinanceContext";
import { Camera, LogOut, Mail, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { CategorySelect } from "./CategorySelect";
import { useAuth } from "../context/AuthContext";
import * as financeService from "../../services/financeService";

const PAYMENT_TYPE_LABELS = {
  credit_card: "Cartão de crédito",
  debit: "Débito",
  pix: "Pix",
  cash: "Dinheiro",
} as const;

export function Settings() {
  const { user, signOut } = useAuth();
  const {
    household,
    fixedExpenses,
    settings,
    paymentMethods,
    monthlySnapshots,
    deleteFixedExpense,
    updateSettings,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    closeMonth,
    deleteMonthlySnapshot,
  } = useFinance();

  const [monthlyIncome, setMonthlyIncome] = useState(settings.monthlyIncome ? settings.monthlyIncome.toString() : "");
  const [partner1, setPartner1] = useState(settings.partnerNames[0]);
  const [partner2, setPartner2] = useState(settings.partnerNames[1]);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MonthlySnapshotModel | null>(null);
  const [closingMonth, setClosingMonth] = useState(false);
  const [profile, setProfile] = useState<financeService.ProfileModel | null>(null);
  const [householdAvatarUrl, setHouseholdAvatarUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultPaymentMethodNames = new Set(["Pix", "Dinheiro", "Débito"]);
  const coupleName = [partner1, partner2].filter(Boolean).join(" & ") || profile?.name || "Perfil";
  const accountEmail = profile?.email || user?.email || "";
  const initials = [partner1, partner2]
    .map((name) => name.trim()[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BL";

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await financeService.fetchCurrentProfile());
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : "Não foi possível carregar o perfil.");
      }
    };
    void loadProfile();
  }, []);

  useEffect(() => {
    setHouseholdAvatarUrl(household?.avatarUrl || "");
  }, [household?.avatarUrl]);

  const handleSaveSettings = () => {
    updateSettings({
      monthlyIncome: parseFloat(monthlyIncome) || 0,
      partnerNames: [partner1, partner2],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const monthLabel = (snapshot: MonthlySnapshotModel) =>
    new Date(snapshot.year, snapshot.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleCloseMonth = async () => {
    if (!window.confirm("Fechar o mês atual? Um histórico imutável será criado.")) return;
    setClosingMonth(true);
    try {
      const snapshot = await closeMonth();
      setSelectedSnapshot(snapshot);
    } finally {
      setClosingMonth(false);
    }
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file || !household?.id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const avatarUrl = await financeService.uploadHouseholdAvatar(household.id, file);
      await financeService.updateHouseholdAvatar(household.id, avatarUrl);
      setHouseholdAvatarUrl(avatarUrl);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Não foi possível salvar a foto.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Excluir sua conta? Esta ação não pode ser desfeita.")) return;
    await financeService.deleteCurrentAccount();
    await signOut();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Perfil</h1>
          <p className="text-sm text-stone-600 mt-1">
            Perfil, renda, casal e contas fixas
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-5">Perfil</h2>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-visible rounded-2xl bg-emerald-500">
              {householdAvatarUrl ? (
                <img src={householdAvatarUrl} alt={coupleName} className="h-full w-full rounded-2xl object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl text-lg font-semibold text-white">{initials}</div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={profileSaving}
                className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:text-emerald-600 disabled:opacity-60"
                aria-label="Alterar foto do perfil"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleAvatarChange(event.target.files?.[0])}
              />
            </div>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold text-stone-950">{coupleName}</p>
              <p className="break-words text-sm text-stone-500">{accountEmail}</p>
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">E-mail da conta</label>
            <div className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900">
              <Mail className="h-4 w-4 text-stone-400" />
              <span className="break-words">{accountEmail}</span>
            </div>
          </div>
          {profileError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</p>}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-4">Família</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Parceiro 1</label>
              <input
                type="text"
                value={partner1}
                onChange={(e) => setPartner1(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Parceiro 2</label>
              <input
                type="text"
                value={partner2}
                onChange={(e) => setPartner2(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-4">Planejamento Financeiro</h2>
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">Renda mensal combinada (R$)</label>
            <input
              type="number"
              step="0.01"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={handleSaveSettings}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            {saved ? "Salvo!" : "Salvar perfil"}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-4">Formas de Pagamento</h2>

          <div className="space-y-4">
            <div>
              <div className="space-y-2 mb-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="group flex flex-col gap-3 rounded-lg bg-stone-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-stone-900">{method.name}</p>
                      <p className="break-words text-xs text-stone-500">
                        {PAYMENT_TYPE_LABELS[method.type]}{method.type === "credit_card" ? ` · Limite: ${method.limitAmount !== null ? formatBRL(method.limitAmount) : "sem limite definido"}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMethodId(method.id);
                          setShowAddPaymentMethod(true);
                        }}
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
                Adicionar cartão
              </button>
            </div>

          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-medium text-stone-900">Contas Fixas</h2>
            <button
              onClick={() => setShowAddFixed(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-3 py-2 text-sm text-white transition-colors hover:bg-stone-800 sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          <div className="space-y-1">
            {fixedExpenses.map((expense) => (
              <div
                key={expense.id}
                className="group flex flex-col gap-2 border-b border-stone-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-stone-900">
                    {expense.name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {expense.category} · vence dia {expense.dueDate}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <p className="break-words text-sm font-medium text-stone-900">
                    {formatBRL(expense.amount)}
                  </p>
                  <button
                    onClick={() => deleteFixedExpense(expense.id)}
                    className="text-stone-400 transition-all hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
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

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-medium text-stone-900">Histórico Financeiro</h2>
              <p className="text-sm text-stone-500">Feche meses para criar relatórios que não mudam depois.</p>
            </div>
            <button
              type="button"
              onClick={() => void handleCloseMonth()}
              disabled={closingMonth}
              className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm text-white transition-colors hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
            >
              {closingMonth ? "Fechando..." : "Fechar mês"}
            </button>
          </div>

          {monthlySnapshots.length === 0 ? (
            <p className="text-center py-8 text-stone-400 text-sm">Nenhum histórico mensal ainda.</p>
          ) : (
            <div className="space-y-2">
              {monthlySnapshots.map((snapshot) => (
                <button
                  key={snapshot.id}
                  type="button"
                  onClick={() => setSelectedSnapshot(snapshot)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition-colors hover:bg-stone-100"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium capitalize text-stone-900">{monthLabel(snapshot)}</p>
                      <p className="break-words text-xs text-stone-500">Gastos {formatBRL(snapshot.totalExpenses)} · Sobra {formatBRL(snapshot.remainingBalance)}</p>
                    </div>
                    <span className="text-xs text-stone-500 sm:text-right">{snapshot.financialHealth.availablePercent}% livre</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-900 mb-4">Conta</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Excluir conta
            </button>
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
      {selectedSnapshot && (
        <FinancialHistoryModal
          snapshot={selectedSnapshot}
          monthLabel={monthLabel(selectedSnapshot)}
          onClose={() => setSelectedSnapshot(null)}
          onDelete={async () => {
            if (!window.confirm("Excluir este histórico? Os dados atuais não serão alterados.")) return;
            await deleteMonthlySnapshot(selectedSnapshot.id);
            setSelectedSnapshot(null);
          }}
        />
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
  const [methodType, setMethodType] = useState(editingMethod?.type ?? "credit_card");
  const [closingDay, setClosingDay] = useState(editingMethod?.closingDay ? String(editingMethod.closingDay) : "");
  const [dueDay, setDueDay] = useState(editingMethod?.dueDay ? String(editingMethod.dueDay) : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editingId && editingMethod) {
      await updatePaymentMethod(editingId, trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined, methodType, closingDay ? Number(closingDay) : null, dueDay ? Number(dueDay) : null);
    } else {
      await addPaymentMethod(trimmed, limitAmount ? parseFloat(limitAmount.replace(",", ".")) : undefined, methodType, closingDay ? Number(closingDay) : null, dueDay ? Number(dueDay) : null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-lg sm:p-6">
        <h2 className="text-lg font-semibold text-stone-900 mb-4">
          {editingId ? "Editar cartão" : "Adicionar cartão"}
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
              Tipo
            </label>
            <select
              value={methodType}
              onChange={(e) => setMethodType(e.target.value as keyof typeof PAYMENT_TYPE_LABELS)}
              className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="credit_card">Cartão de crédito</option>
              <option value="debit">Débito</option>
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>

          {methodType === "credit_card" && (
            <>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                    Fechamento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                    Vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="20"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-stone-600 transition-colors hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
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
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 sm:p-6"
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

          <div className="grid gap-3 sm:grid-cols-2">
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

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
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

function FinancialHistoryModal({
  snapshot,
  monthLabel,
  onClose,
  onDelete,
}: {
  snapshot: MonthlySnapshotModel;
  monthLabel: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-100 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold capitalize text-stone-950">{monthLabel}</h2>
            <p className="text-xs text-stone-500">Histórico fechado em {new Date(snapshot.closedAt).toLocaleDateString("pt-BR")}</p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile label="Renda" value={formatBRL(snapshot.monthlyIncome)} />
            <SummaryTile label="Gastos" value={formatBRL(snapshot.totalExpenses)} />
            <SummaryTile label="Sobra" value={formatBRL(snapshot.remainingBalance)} />
            <SummaryTile label="Livre" value={`${snapshot.financialHealth.availablePercent}%`} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <HistoryList title="Categorias" rows={snapshot.categoryTotals.map((item) => ({ label: item.name, value: formatBRL(item.amount) }))} />
            <HistoryList title="Cartões" rows={snapshot.cardTotals.map((item) => ({ label: item.name, value: `${formatBRL(item.amount)}${item.availableLimit !== null ? ` · livre ${formatBRL(item.availableLimit)}` : ""}` }))} />
            <HistoryList title="Metas" rows={snapshot.goalProgress.map((item) => ({ label: item.title, value: `${formatBRL(item.currentAmount)} / ${formatBRL(item.targetAmount)} · ${item.percent}%` }))} />
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="text-sm font-medium text-stone-900">Indicadores</h3>
              <p className="mt-3 text-sm text-stone-600">Gasto total: {snapshot.financialHealth.totalSpentPercent}% da renda.</p>
              <p className="mt-1 text-sm text-stone-600">Parcelas: {formatBRL(snapshot.installmentExpensesTotal)}</p>
              <p className="mt-1 text-sm text-stone-600">Fixas: {formatBRL(snapshot.fixedExpensesTotal)}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => void onDelete()} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              Excluir histórico
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-stone-500">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function HistoryList({ title, rows }: { title: string; rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-medium text-stone-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">Nenhum dado neste mês.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="flex flex-col gap-1 border-b border-stone-100 py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between">
              <span className="break-words text-sm text-stone-700">{row.label}</span>
              <span className="break-words text-sm font-medium text-stone-950 sm:text-right">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
