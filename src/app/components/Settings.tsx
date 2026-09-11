import { useEffect, useRef, useState } from "react";
import { Layout } from "./Layout";
import { ExpandableSection } from "./ExpandableSection";
import {
  CategoryModel,
  FixedExpense,
  FixedExpenseMonthlyValueModel,
  useFinance,
  formatBRL,
  MonthlySnapshotModel,
  FinancialCycle,
} from "../context/FinanceContext";
import type { FinancialRoutine } from "../context/FinanceContext";
import { CalendarDays, Camera, LogOut, Mail, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { CategorySelect } from "./CategorySelect";
import { useAuth } from "../context/AuthContext";
import * as financeService from "../../services/financeService";
import { formatLocalDate, parseLocalDate } from "../utils/financialCycles";
import {
  CYCLE_MODE_LABELS,
  INCOME_MODE_LABELS,
  suggestedFinancialCycle,
} from "../utils/financialRoutine";
import { useNavigate } from "react-router";

const PAYMENT_TYPE_LABELS = {
  credit_card: "Cartão de crédito",
  debit: "Débito",
  pix: "Pix",
  cash: "Dinheiro",
} as const;

const csvCell = (value: string | number) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

const exportSnapshotExpensesCsv = (snapshot: MonthlySnapshotModel, monthLabel: string) => {
  const rows = [
    [
      "data da compra",
      "data de impacto",
      "fechamento da fatura",
      "vencimento da fatura",
      "descrição",
      "categoria",
      "forma de pagamento",
      "quem pagou",
      "valor",
    ],
    ...snapshot.expenseRows.map((expense) => [
      expense.purchaseDate,
      expense.effectiveDate,
      expense.invoiceClosingDate || "",
      expense.invoiceDueDate || "",
      expense.description || "",
      expense.category || "Sem categoria",
      expense.paymentMethod || "",
      expense.paidBy || "",
      expense.amount.toFixed(2).replace(".", ","),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gastos-${monthLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export function Settings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const {
    household,
    categories,
    expenses,
    fixedExpenses,
    financialCommitments,
    fixedExpenseMonthlyValues,
    settings,
    paymentMethods,
    monthlySnapshots,
    activeCycle,
    deleteFixedExpense,
    upsertFixedExpenseMonthlyValue,
    updateSettings,
    updateHouseholdAvatar,
    updateFinancialRoutine,
    resetOnboarding,
    deletePaymentMethod,
    reopenMonth,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useFinance();

  const [monthlyIncome, setMonthlyIncome] = useState(
    settings.monthlyIncome ? settings.monthlyIncome.toString() : "",
  );
  const [partner1, setPartner1] = useState(settings.partnerNames[0]);
  const [partner2, setPartner2] = useState(settings.partnerNames[1]);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);
  const [editingFixedMonthlyValue, setEditingFixedMonthlyValue] = useState<FixedExpense | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<MonthlySnapshotModel | null>(null);
  const [profile, setProfile] = useState<financeService.ProfileModel | null>(null);
  const [householdAvatarUrl, setHouseholdAvatarUrl] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [categoryPlanItems, setCategoryPlanItems] = useState<financeService.GoalPlanItemModel[]>(
    [],
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPlanItemId, setNewCategoryPlanItemId] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [financialRoutine, setFinancialRoutine] = useState<FinancialRoutine>(() => ({
    incomeMode: household?.incomeMode ?? "fixed",
    primaryIncomeDay: household?.primaryIncomeDay ?? 5,
    cycleMode: household?.cycleMode ?? "payment_day",
    cycleCloseDay: household?.cycleCloseDay ?? null,
  }));
  const [routineSaving, setRoutineSaving] = useState(false);
  const [routineError, setRoutineError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasEditedSettingsRef = useRef(false);
  const defaultPaymentMethodNames = new Set(["Pix", "Dinheiro", "Débito"]);
  const coupleName = [partner1, partner2].filter(Boolean).join(" & ") || profile?.name || "Perfil";
  const accountEmail = profile?.email || user?.email || "";
  const plannedIncome = parseFloat(monthlyIncome) || 0;
  const hasProfileFieldChanges =
    plannedIncome !== settings.monthlyIncome ||
    partner1.trim() !== settings.partnerNames[0].trim() ||
    partner2.trim() !== settings.partnerNames[1].trim();
  const hasRoutineChanges = Boolean(
    household &&
    (financialRoutine.incomeMode !== household.incomeMode ||
      financialRoutine.primaryIncomeDay !== household.primaryIncomeDay ||
      financialRoutine.cycleMode !== household.cycleMode ||
      financialRoutine.cycleCloseDay !== household.cycleCloseDay),
  );
  const hasSettingsChanges = hasProfileFieldChanges || hasRoutineChanges;
  const fixedExpensesTotal = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const creditCardCount = paymentMethods.filter((method) => method.type === "credit_card").length;
  const initials =
    [partner1, partner2]
      .map((name) => name.trim()[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "BL";
  const routinePreview = suggestedFinancialCycle(formatLocalDate(new Date()), financialRoutine);
  const routineSummary = `${INCOME_MODE_LABELS[financialRoutine.incomeMode]} · ${CYCLE_MODE_LABELS[financialRoutine.cycleMode]}`;

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfile(await financeService.fetchCurrentProfile());
      } catch (error) {
        setProfileError(
          error instanceof Error ? error.message : "Não foi possível carregar o perfil.",
        );
      }
    };
    void loadProfile();
  }, []);

  useEffect(() => {
    setHouseholdAvatarUrl(household?.avatarUrl || "");
  }, [household?.avatarUrl]);

  useEffect(() => {
    if (!household) return;
    setFinancialRoutine({
      incomeMode: household.incomeMode,
      primaryIncomeDay: household.primaryIncomeDay,
      cycleMode: household.cycleMode,
      cycleCloseDay: household.cycleCloseDay,
    });
  }, [
    household?.cycleCloseDay,
    household?.cycleMode,
    household?.incomeMode,
    household?.primaryIncomeDay,
  ]);

  useEffect(() => {
    if (hasEditedSettingsRef.current) return;
    setMonthlyIncome(settings.monthlyIncome ? settings.monthlyIncome.toString() : "");
    setPartner1(settings.partnerNames[0]);
    setPartner2(settings.partnerNames[1]);
  }, [settings.monthlyIncome, settings.partnerNames]);

  useEffect(() => {
    if (!household?.id) {
      setCategoryPlanItems([]);
      return;
    }

    const loadPlanItems = async () => {
      try {
        const goals = await financeService.fetchGoals(household.id);
        const currentGoal = goals[0];
        setCategoryPlanItems(
          currentGoal ? await financeService.fetchGoalPlanItems(currentGoal.id) : [],
        );
      } catch (error) {
        setCategoryError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as divisões do planejamento.",
        );
      }
    };

    void loadPlanItems();
  }, [household?.id]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || categorySaving) return;
    if (categories.some((category) => category.name.trim().toLowerCase() === name.toLowerCase())) {
      setCategoryError("Já existe uma categoria com esse nome.");
      return;
    }

    setCategorySaving(true);
    setCategoryError(null);
    try {
      await addCategory(name, newCategoryPlanItemId || null);
      setNewCategoryName("");
      setNewCategoryPlanItemId("");
      toast.success("Categoria adicionada.");
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Não foi possível adicionar a categoria.",
      );
    } finally {
      setCategorySaving(false);
    }
  };

  const handleUpdateCategory = async (id: string, changes: Partial<Omit<CategoryModel, "id">>) => {
    const name = changes.name?.trim() ?? "";
    if (!name) throw new Error("Informe um nome para a categoria.");
    if (
      categories.some(
        (category) =>
          category.id !== id && category.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      const error = new Error("Já existe uma categoria com esse nome.");
      setCategoryError(error.message);
      throw error;
    }

    setCategoryError(null);
    try {
      await updateCategory(id, {
        name,
        goalPlanItemId: changes.goalPlanItemId ?? null,
      });
      toast.success("Categoria atualizada.");
    } catch (error) {
      setCategoryError(
        error instanceof Error ? error.message : "Não foi possível atualizar a categoria.",
      );
      throw error;
    }
  };

  const handleDeleteCategory = async (category: CategoryModel) => {
    const variableUsage = expenses.filter((expense) => expense.category === category.id).length;
    const fixedUsage = fixedExpenses.filter(
      (expense) =>
        expense.categoryId === category.id ||
        (!expense.categoryId &&
          expense.category.trim().toLowerCase() === category.name.trim().toLowerCase()),
    ).length;
    const commitmentUsage = financialCommitments.filter(
      (commitment) => commitment.categoryId === category.id,
    ).length;
    const usageCount = variableUsage + fixedUsage + commitmentUsage;

    if (usageCount > 0) {
      const message = `Esta categoria está sendo usada em ${usageCount} ${usageCount === 1 ? "lançamento" : "lançamentos"}. Reclassifique-os antes de apagar.`;
      setCategoryError(message);
      toast.error(message);
      throw new Error(message);
    }
    if (!window.confirm(`Apagar a categoria “${category.name}”?`)) return;

    setCategoryError(null);
    try {
      await deleteCategory(category.id);
      toast.success("Categoria apagada.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível apagar a categoria.";
      setCategoryError(message);
      throw error;
    }
  };

  const handleSaveSettings = async () => {
    if (settingsSaving || routineSaving) return;
    if (!partner1.trim()) {
      setSettingsError("Informe pelo menos o primeiro nome do perfil.");
      return;
    }
    const dayIsValid = (day: number | null) => day !== null && day >= 1 && day <= 31;
    if (
      financialRoutine.cycleMode === "payment_day" &&
      !dayIsValid(financialRoutine.primaryIncomeDay)
    ) {
      setRoutineError("Informe um dia de recebimento entre 1 e 31.");
      setSettingsError("Revise a configuração da rotina financeira.");
      return;
    }
    if (
      financialRoutine.cycleMode === "custom_day" &&
      !dayIsValid(financialRoutine.cycleCloseDay)
    ) {
      setRoutineError("Informe um dia de virada entre 1 e 31.");
      setSettingsError("Revise a configuração da rotina financeira.");
      return;
    }

    setSettingsSaving(true);
    setSettingsError(null);
    setRoutineError(null);
    setSaved(false);

    try {
      if (hasProfileFieldChanges) {
        await updateSettings({
          monthlyIncome: parseFloat(monthlyIncome) || 0,
          partnerNames: [partner1.trim(), partner2.trim()],
        });
      }
      if (hasRoutineChanges) await updateFinancialRoutine(financialRoutine);
      hasEditedSettingsRef.current = false;
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const monthLabel = (snapshot: MonthlySnapshotModel) => {
    const reference = new Date(snapshot.year, snapshot.month - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    const range = `${parseLocalDate(snapshot.cycleStartDate).toLocaleDateString("pt-BR")} a ${parseLocalDate(
      snapshot.cycleEndDate,
    ).toLocaleDateString("pt-BR")}`;
    return `${reference} · ${range}`;
  };

  const handleAvatarChange = async (file?: File | null) => {
    if (!file || !household?.id) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const avatarUrl = await financeService.uploadHouseholdAvatar(household.id, file);
      await updateHouseholdAvatar(avatarUrl);
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

  const handleRestartGuide = async () => {
    if (routineSaving) return;
    setRoutineSaving(true);
    setRoutineError(null);
    try {
      await resetOnboarding();
    } catch (error) {
      setRoutineError(
        error instanceof Error ? error.message : "Não foi possível abrir o guia inicial.",
      );
    } finally {
      setRoutineSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="together-page-heading flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">Perfil</h1>
            <p className="text-sm text-stone-600 mt-1">Perfil, renda, casal e contas fixas</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSettings()}
            disabled={settingsSaving || routineSaving || !hasSettingsChanges}
            aria-busy={settingsSaving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Save className="w-4 h-4" />
            {settingsSaving ? "Salvando..." : saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
        {settingsError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {settingsError}
          </p>
        )}

        <ExpandableSection title="Perfil" summary={accountEmail || "Conta conectada"} defaultOpen>
          <h2 className="font-medium text-stone-900 mb-5">Perfil</h2>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-visible rounded-2xl bg-emerald-500">
              {householdAvatarUrl ? (
                <img
                  src={householdAvatarUrl}
                  alt={coupleName}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-2xl text-lg font-semibold text-white">
                  {initials}
                </div>
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
                accept="image/jpeg,image/png,image/webp"
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
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              E-mail da conta
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900">
              <Mail className="h-4 w-4 text-stone-400" />
              <span className="break-words">{accountEmail}</span>
            </div>
          </div>
          {profileError && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {profileError}
            </p>
          )}
        </ExpandableSection>

        <ExpandableSection
          title="Casal e rendimento"
          summary={`${coupleName} · renda ${formatBRL(plannedIncome)}`}
        >
          <h2 className="font-medium text-stone-900 mb-4">Casal e rendimento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Parceiro 1
              </label>
              <input
                type="text"
                value={partner1}
                onChange={(e) => {
                  hasEditedSettingsRef.current = true;
                  setPartner1(e.target.value);
                }}
                required
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
                onChange={(e) => {
                  hasEditedSettingsRef.current = true;
                  setPartner2(e.target.value);
                }}
                placeholder="Opcional"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
                Renda mensal planejada (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={monthlyIncome}
                onChange={(e) => {
                  hasEditedSettingsRef.current = true;
                  setMonthlyIncome(e.target.value);
                }}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Minha rotina financeira"
          summary={routineSummary}
          icon={CalendarDays}
          tone="teal"
        >
          <div className="space-y-5">
            <div>
              <h2 className="font-medium text-stone-900">Como seu mês funciona</h2>
              <p className="mt-1 text-sm text-stone-500">
                O dia de receber e o dia de virar o ciclo são configurações diferentes. Isso não
                altera o fechamento individual das faturas dos cartões.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                  Tipo de renda
                </span>
                <select
                  value={financialRoutine.incomeMode}
                  onChange={(event) => {
                    const incomeMode = event.target.value as FinancialRoutine["incomeMode"];
                    setFinancialRoutine((current) => ({
                      ...current,
                      incomeMode,
                      primaryIncomeDay:
                        incomeMode === "variable" ? null : (current.primaryIncomeDay ?? 5),
                      cycleMode:
                        incomeMode === "variable" && current.cycleMode === "payment_day"
                          ? "manual"
                          : current.cycleMode,
                    }));
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Object.entries(INCOME_MODE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                  Dia principal do recebimento
                </span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  disabled={financialRoutine.incomeMode === "variable"}
                  value={financialRoutine.primaryIncomeDay ?? ""}
                  onChange={(event) =>
                    setFinancialRoutine((current) => ({
                      ...current,
                      primaryIncomeDay: Number(event.target.value) || null,
                    }))
                  }
                  placeholder={financialRoutine.incomeMode === "variable" ? "Sem dia fixo" : "5"}
                  className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-stone-50 disabled:text-stone-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                  Virada do ciclo
                </span>
                <select
                  value={financialRoutine.cycleMode}
                  onChange={(event) =>
                    setFinancialRoutine((current) => ({
                      ...current,
                      cycleMode: event.target.value as FinancialRoutine["cycleMode"],
                    }))
                  }
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="payment_day" disabled={financialRoutine.primaryIncomeDay === null}>
                    {CYCLE_MODE_LABELS.payment_day}
                  </option>
                  <option value="custom_day">{CYCLE_MODE_LABELS.custom_day}</option>
                  <option value="manual">{CYCLE_MODE_LABELS.manual}</option>
                </select>
              </label>

              {financialRoutine.cycleMode === "custom_day" && (
                <label className="block">
                  <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                    Dia da virada
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={financialRoutine.cycleCloseDay ?? ""}
                    onChange={(event) =>
                      setFinancialRoutine((current) => ({
                        ...current,
                        cycleCloseDay: Number(event.target.value) || null,
                      }))
                    }
                    className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
              )}
            </div>

            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950">
              {routinePreview ? (
                <>
                  Pela configuração atual, o ciclo em andamento vai de{" "}
                  <strong>
                    {parseLocalDate(routinePreview.startDate).toLocaleDateString("pt-BR")}
                  </strong>{" "}
                  até{" "}
                  <strong>
                    {parseLocalDate(routinePreview.endDate).toLocaleDateString("pt-BR")}
                  </strong>
                  . O fechamento continua sendo confirmado por você.
                </>
              ) : (
                "Você escolheu a virada manual. O app acompanha as datas e você decide quando encerrar o ciclo."
              )}
            </div>

            {routineError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {routineError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleRestartGuide()}
                disabled={routineSaving}
                className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                Refazer guia inicial
              </button>
            </div>
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Categorias de gastos"
          summary={`${categories.length} categorias · personalize e vincule ao planejamento`}
        >
          <div className="space-y-4">
            <div>
              <h2 className="font-medium text-stone-900">Categorias de gastos</h2>
              <p className="mt-1 text-sm text-stone-500">
                Vincule categorias como Gasolina e Manutenção à divisão Carro para consolidar o
                gasto real automaticamente.
              </p>
            </div>

            <div className="space-y-2">
              {categories.map((category) => (
                <CategoryEditorRow
                  key={category.id}
                  category={category}
                  planItems={categoryPlanItems}
                  onSave={handleUpdateCategory}
                  onDelete={handleDeleteCategory}
                />
              ))}
            </div>

            <div className="grid gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                  Nova categoria
                </span>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Ex: Manutenção"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
                  Divisão do planejamento
                </span>
                <select
                  value={newCategoryPlanItemId}
                  onChange={(event) => setNewCategoryPlanItemId(event.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Sem divisão</option>
                  {categoryPlanItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void handleAddCategory()}
                disabled={categorySaving || !newCategoryName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>

            {categoryPlanItems.length === 0 && (
              <p className="text-xs text-stone-500">
                Salve primeiro o “Planejamento do casal” na tela Metas para disponibilizar as
                divisões aqui.
              </p>
            )}
            {categoryError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {categoryError}
              </p>
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Formas de pagamento"
          summary={`${paymentMethods.length} formas · ${creditCardCount} cartões`}
        >
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
                      <p className="break-words text-sm font-medium text-stone-900">
                        {method.name}
                      </p>
                      <p className="break-words text-xs text-stone-500">
                        {PAYMENT_TYPE_LABELS[method.type]}
                        {method.type === "credit_card"
                          ? ` · Limite: ${method.limitAmount !== null ? formatBRL(method.limitAmount) : "sem limite definido"} · Fecha dia ${method.closingDay ?? "—"} · Vence dia ${method.dueDay ?? "—"}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMethodId(method.id);
                          setShowAddPaymentMethod(true);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)]"
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
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_0_18px_rgba(244,63,94,0.16)] disabled:cursor-not-allowed disabled:opacity-30"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <Plus className="w-4 h-4" />
                Adicionar cartão
              </button>
            </div>
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Contas fixas"
          summary={`${fixedExpenses.length} contas · ${formatBRL(fixedExpensesTotal)}/mês`}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-medium text-stone-900">Contas Fixas</h2>
            <button
              onClick={() => setShowAddFixed(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Nova conta
            </button>
          </div>

          <div className="space-y-1">
            {fixedExpenses.map((expense) => (
              <FixedExpenseRow
                key={expense.id}
                expense={expense}
                monthlyValues={fixedExpenseMonthlyValues}
                activeCycle={activeCycle}
                onEdit={setEditingFixedExpense}
                onEditMonthlyValue={setEditingFixedMonthlyValue}
                onDelete={deleteFixedExpense}
              />
            ))}
            {fixedExpenses.length === 0 && (
              <p className="text-center py-8 text-stone-400 text-sm">
                Nenhuma conta fixa cadastrada.
              </p>
            )}
          </div>
        </ExpandableSection>

        <ExpandableSection
          title="Histórico financeiro"
          summary={`${monthlySnapshots.length} fechamentos`}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-medium text-stone-900">Histórico Financeiro</h2>
              <p className="text-sm text-stone-500">
                Feche meses para criar relatórios que não mudam depois.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/", { state: { openCloseMonth: true } })}
              className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm text-white transition-colors hover:bg-stone-800 sm:w-auto"
            >
              Revisar e fechar mês
            </button>
          </div>

          {monthlySnapshots.length === 0 ? (
            <p className="text-center py-8 text-stone-400 text-sm">
              Nenhum histórico mensal ainda.
            </p>
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
                      <p className="break-words text-sm font-medium capitalize text-stone-900">
                        {monthLabel(snapshot)}
                      </p>
                      <p className="break-words text-xs text-stone-500">
                        Gastos {formatBRL(snapshot.totalExpenses)} · Sobra{" "}
                        {formatBRL(snapshot.remainingBalance)}
                      </p>
                    </div>
                    <span className="text-xs text-stone-500 sm:text-right">
                      {snapshot.financialHealth.availablePercent}% livre
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ExpandableSection>

        <ExpandableSection title="Conta" summary="Sair ou excluir conta">
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
        </ExpandableSection>
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
      {editingFixedExpense && (
        <AddFixedExpenseModal
          fixedExpense={editingFixedExpense}
          onClose={() => setEditingFixedExpense(null)}
        />
      )}
      {editingFixedMonthlyValue && (
        <FixedExpenseMonthlyValueModal
          fixedExpense={editingFixedMonthlyValue}
          currentValue={fixedExpenseMonthlyValues.find(
            (value) =>
              value.fixedExpenseId === editingFixedMonthlyValue.id &&
              value.month === activeCycle.month &&
              value.year === activeCycle.year,
          )}
          month={activeCycle.month}
          year={activeCycle.year}
          onClose={() => setEditingFixedMonthlyValue(null)}
          onSave={async (actualAmount) => {
            await upsertFixedExpenseMonthlyValue({
              fixedExpenseId: editingFixedMonthlyValue.id,
              month: activeCycle.month,
              year: activeCycle.year,
              estimatedAmount: editingFixedMonthlyValue.amount,
              actualAmount,
              status: "confirmed",
            });
            toast.success("Valor real salvo.");
            setEditingFixedMonthlyValue(null);
          }}
        />
      )}
      {selectedSnapshot && (
        <FinancialHistoryModal
          snapshot={selectedSnapshot}
          monthLabel={monthLabel(selectedSnapshot)}
          onClose={() => setSelectedSnapshot(null)}
          canReopen={
            [...monthlySnapshots].sort((left, right) =>
              right.cycleEndDate.localeCompare(left.cycleEndDate),
            )[0]?.id === selectedSnapshot.id
          }
          onReopen={async () => {
            if (
              !window.confirm(
                `Reabrir ${monthLabel(selectedSnapshot)}? Esse mês voltará a ser o mês aberto e os gastos variáveis poderão ser editados novamente.`,
              )
            )
              return;
            try {
              await reopenMonth(selectedSnapshot);
              setSelectedSnapshot(null);
              toast.success("Mês reaberto.");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Não foi possível reabrir o mês.",
              );
            }
          }}
        />
      )}
    </Layout>
  );
}

function CategoryEditorRow({
  category,
  planItems,
  onSave,
  onDelete,
}: {
  category: CategoryModel;
  planItems: financeService.GoalPlanItemModel[];
  onSave: (id: string, changes: Partial<Omit<CategoryModel, "id">>) => Promise<void>;
  onDelete: (category: CategoryModel) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [goalPlanItemId, setGoalPlanItemId] = useState(category.goalPlanItemId ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChanges =
    name.trim() !== category.name.trim() || goalPlanItemId !== (category.goalPlanItemId ?? "");

  useEffect(() => {
    setName(category.name);
    setGoalPlanItemId(category.goalPlanItemId ?? "");
  }, [category.goalPlanItemId, category.name]);

  const handleSave = async () => {
    if (!name.trim() || !hasChanges || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(category.id, {
        name: name.trim(),
        goalPlanItemId: goalPlanItemId || null,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Não foi possível salvar a categoria.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(category);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Não foi possível apagar a categoria.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-stone-500">
            Entra na divisão
          </span>
          <select
            value={goalPlanItemId}
            onChange={(event) => setGoalPlanItemId(event.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Sem divisão</option>
            {planItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!hasChanges || !name.trim() || saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={saving || deleting}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Apagar categoria ${category.name}`}
          title="Apagar categoria"
        >
          <X className="h-4 w-4" />
          <span className="sm:hidden">{deleting ? "Apagando..." : "Apagar"}</span>
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

function FixedExpenseRow({
  expense,
  monthlyValues,
  activeCycle,
  onEdit,
  onEditMonthlyValue,
  onDelete,
}: {
  expense: FixedExpense;
  monthlyValues: FixedExpenseMonthlyValueModel[];
  activeCycle: FinancialCycle;
  onEdit: (expense: FixedExpense) => void;
  onEditMonthlyValue: (expense: FixedExpense) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const monthlyValue = monthlyValues.find(
    (value) =>
      value.fixedExpenseId === expense.id &&
      value.month === activeCycle.month &&
      value.year === activeCycle.year,
  );
  const displayedAmount =
    monthlyValue?.status === "confirmed" && monthlyValue.actualAmount !== null
      ? monthlyValue.actualAmount
      : (monthlyValue?.estimatedAmount ?? expense.amount);

  return (
    <div className="group flex flex-col gap-2 border-b border-stone-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium text-stone-900">{expense.name}</p>
        <p className="text-xs text-stone-500">
          {expense.category} - vence dia {expense.dueDate}
          {expense.amountType === "variable" && (
            <span>
              {" "}
              - {monthlyValue?.status === "confirmed" ? "valor real informado" : "estimado"}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            expense.amountType === "variable"
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {expense.amountType === "variable" ? "Variável" : "Fixa"}
        </span>
        <p className="break-words text-sm font-medium text-stone-900">
          {formatBRL(displayedAmount)}
        </p>
        {expense.amountType === "variable" && (
          <button
            type="button"
            onClick={() => onEditMonthlyValue(expense)}
            className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs text-stone-600 transition-colors hover:bg-stone-50"
          >
            Informar real
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_0_18px_rgba(16,185,129,0.16)] sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Editar conta fixa"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void onDelete(expense.id)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 hover:shadow-[0_0_18px_rgba(244,63,94,0.16)] sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Excluir conta fixa"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FixedExpenseMonthlyValueModal({
  fixedExpense,
  currentValue,
  month,
  year,
  onClose,
  onSave,
}: {
  fixedExpense: FixedExpense;
  currentValue?: FixedExpenseMonthlyValueModel;
  month: number;
  year: number;
  onClose: () => void;
  onSave: (actualAmount: number) => Promise<void>;
}) {
  const [actualAmount, setActualAmount] = useState(
    currentValue?.actualAmount !== null && currentValue?.actualAmount !== undefined
      ? String(currentValue.actualAmount).replace(".", ",")
      : String(fixedExpense.amount).replace(".", ","),
  );
  const [saving, setSaving] = useState(false);
  const monthLabel = `${String(month).padStart(2, "0")}/${year}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = parseFloat(actualAmount.replace(",", "."));
    if (!value || value <= 0 || saving) return;

    setSaving(true);
    try {
      await onSave(value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o valor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-stone-900/40 p-4 backdrop-blur-sm sm:items-center"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-stone-900">Valor real do mês</h2>
            <p className="mt-1 text-xs text-stone-500">
              {fixedExpense.name} - {monthLabel}
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
            Estimado: {formatBRL(fixedExpense.amount)}. Ao salvar, o dashboard e o fechamento deste
            mês passam a usar o valor real.
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-stone-500">
              Valor real
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={actualAmount}
              onChange={(event) => setActualAmount(event.target.value)}
              className="w-full rounded-xl border border-stone-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0,00"
            />
          </div>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="flex-1 rounded-xl border border-stone-200 px-4 py-3 text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar valor real"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddFixedExpenseModalProps {
  fixedExpense?: FixedExpense;
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
    editingMethod?.limitAmount !== null && editingMethod?.limitAmount !== undefined
      ? editingMethod.limitAmount.toString()
      : "",
  );
  const [methodType, setMethodType] = useState(editingMethod?.type ?? "credit_card");
  const [closingDay, setClosingDay] = useState(
    editingMethod?.closingDay ? String(editingMethod.closingDay) : "",
  );
  const [dueDay, setDueDay] = useState(editingMethod?.dueDay ? String(editingMethod.dueDay) : "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    const parsedClosingDay = Number(closingDay);
    const parsedDueDay = Number(dueDay);
    const parsedLimit = limitAmount ? Number(limitAmount.replace(",", ".")) : undefined;
    if (parsedLimit !== undefined && (!Number.isFinite(parsedLimit) || parsedLimit < 0)) {
      toast.error("Informe um limite válido.");
      return;
    }
    if (
      methodType === "credit_card" &&
      (!Number.isInteger(parsedClosingDay) ||
        parsedClosingDay < 1 ||
        parsedClosingDay > 31 ||
        !Number.isInteger(parsedDueDay) ||
        parsedDueDay < 1 ||
        parsedDueDay > 31)
    ) {
      toast.error("Informe dias válidos de fechamento e vencimento para o cartão.");
      return;
    }

    setSaving(true);
    try {
      if (editingId && editingMethod) {
        await updatePaymentMethod(
          editingId,
          trimmed,
          parsedLimit,
          methodType,
          methodType === "credit_card" ? parsedClosingDay : null,
          methodType === "credit_card" ? parsedDueDay : null,
        );
      } else {
        await addPaymentMethod(
          trimmed,
          parsedLimit,
          methodType,
          methodType === "credit_card" ? parsedClosingDay : null,
          methodType === "credit_card" ? parsedDueDay : null,
        );
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar a forma de pagamento.",
      );
    } finally {
      setSaving(false);
    }
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
                    required
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
                    required
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
              disabled={saving}
              className="rounded-lg px-4 py-2 text-stone-600 transition-colors hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
            >
              {saving ? "Salvando..." : editingId ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddFixedExpenseModal({ fixedExpense, onClose }: AddFixedExpenseModalProps) {
  const { addFixedExpense, updateFixedExpense, categories, household, loading } = useFinance();
  const selectedCategoryId = fixedExpense
    ? (fixedExpense.categoryId ??
      categories.find((category) => category.name === fixedExpense.category)?.id ??
      "")
    : "";
  const [name, setName] = useState(fixedExpense?.name ?? "");
  const [amount, setAmount] = useState(
    fixedExpense ? String(fixedExpense.amount).replace(".", ",") : "",
  );
  const [categoryId, setCategoryId] = useState(selectedCategoryId);
  const [dueDate, setDueDate] = useState(fixedExpense ? String(fixedExpense.dueDate) : "");
  const [amountType, setAmountType] = useState<FixedExpense["amountType"]>(
    fixedExpense?.amountType ?? "fixed",
  );
  const [saving, setSaving] = useState(false);
  const householdReady = Boolean(household?.id) && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(",", "."));
    const parsedDueDate = parseInt(dueDate, 10);
    if (!name.trim() || !value || !parsedDueDate || saving) return;
    if (!householdReady) {
      toast.error(
        "Sua casa ainda está sendo carregada. Aguarde alguns segundos e tente novamente.",
      );
      return;
    }

    const selectedCategory = categories.find((c) => c.id === categoryId);
    const categoryName = selectedCategory?.name || "";

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: value,
        categoryId: selectedCategory?.id ?? null,
        category: categoryName,
        dueDate: parsedDueDate,
        amountType,
      };

      if (fixedExpense) {
        await updateFixedExpense(fixedExpense.id, payload);
      } else {
        await addFixedExpense(payload);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    } finally {
      setSaving(false);
    }
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
          {fixedExpense ? "Editar conta fixa" : "Nova conta fixa"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2">
              Tipo de valor
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
              <button
                type="button"
                onClick={() => setAmountType("fixed")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  amountType === "fixed"
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Fixo
              </button>
              <button
                type="button"
                onClick={() => setAmountType("variable")}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  amountType === "variable"
                    ? "bg-white text-stone-950 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                Variável mensal
              </button>
            </div>
          </div>

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
                {amountType === "variable" ? "Valor estimado" : "Valor"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-3 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0,00"
              />
              {amountType === "variable" && (
                <p className="mt-1 text-xs text-stone-500">
                  Use uma média para projeção. O valor real por mês entra na próxima etapa.
                </p>
              )}
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
              disabled={saving}
              className="flex-1 px-4 py-3 border border-stone-200 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !householdReady}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-60 transition-colors font-medium"
            >
              {saving ? "Salvando..." : fixedExpense ? "Salvar edição" : "Salvar"}
            </button>
          </div>
          {!householdReady && (
            <p className="text-center text-xs text-stone-500">Carregando os dados da casa…</p>
          )}
        </form>
      </div>
    </div>
  );
}

function FinancialHistoryModal({
  snapshot,
  monthLabel,
  onClose,
  canReopen,
  onReopen,
}: {
  snapshot: MonthlySnapshotModel;
  monthLabel: string;
  onClose: () => void;
  canReopen: boolean;
  onReopen: () => Promise<void>;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[calc(100vh-2rem)] overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-100 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold capitalize text-stone-950">
              {monthLabel}
            </h2>
            <p className="text-xs text-stone-500">
              Histórico fechado em {new Date(snapshot.closedAt).toLocaleDateString("pt-BR")}
            </p>
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
            <HistoryList
              title="Categorias"
              rows={snapshot.categoryTotals.map((item) => ({
                label: item.name,
                value: formatBRL(item.amount),
              }))}
            />
            <HistoryList
              title="Cartões"
              rows={snapshot.cardTotals.map((item) => ({
                label: item.name,
                value: `${formatBRL(item.amount)}${item.availableLimit !== null ? ` · livre ${formatBRL(item.availableLimit)}` : ""}`,
              }))}
            />
            <HistoryList
              title="Metas"
              rows={snapshot.goalProgress.map((item) => ({
                label: item.title,
                value: `${formatBRL(item.currentAmount)} / ${formatBRL(item.targetAmount)} · ${item.percent}%`,
              }))}
            />
            <div className="md:col-span-2">
              <HistoryList
                title="Lançamentos congelados"
                rows={snapshot.expenseRows.map((item) => ({
                  label: `${parseLocalDate(item.purchaseDate).toLocaleDateString("pt-BR")} · ${item.description || item.category}`,
                  value: `${formatBRL(item.amount)}${item.invoiceDueDate ? ` · fatura ${parseLocalDate(item.invoiceDueDate).toLocaleDateString("pt-BR")}` : ""}`,
                }))}
              />
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <h3 className="text-sm font-medium text-stone-900">Indicadores</h3>
              <p className="mt-3 text-sm text-stone-600">
                Gasto total: {snapshot.financialHealth.totalSpentPercent}% da renda.
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Parcelas: {formatBRL(snapshot.installmentExpensesTotal)}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                Fixas: {formatBRL(snapshot.fixedExpensesTotal)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void onReopen()}
              disabled={!canReopen}
              title={canReopen ? undefined : "Reabra primeiro o ciclo fechado mais recente."}
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canReopen ? "Reabrir mês" : "Histórico permanente"}
            </button>
            <button
              type="button"
              onClick={() => exportSnapshotExpensesCsv(snapshot, monthLabel)}
              disabled={snapshot.expenseRows.length === 0}
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exportar CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700"
            >
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

function HistoryList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-medium text-stone-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-stone-400">Nenhum dado neste mês.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div
              key={`${row.label}-${row.value}`}
              className="flex flex-col gap-1 border-b border-stone-100 py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between"
            >
              <span className="break-words text-sm text-stone-700">{row.label}</span>
              <span className="break-words text-sm font-medium text-stone-950 sm:text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
