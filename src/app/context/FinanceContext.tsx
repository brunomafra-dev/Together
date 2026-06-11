import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import * as financeService from "../../services/financeService";
import type {
  CategoryModel,
  FinancialCommitmentModel,
  FixedExpenseMonthlyValueModel,
  FixedExpenseModel,
  HouseholdModel,
  IncomeEntryModel,
  MonthlySnapshotModel,
  PaymentMethodModel,
} from "../../services/financeService";

export type { CategoryModel, HouseholdModel, PaymentMethodModel };
export type { FinancialCommitmentModel };
export type { FixedExpenseMonthlyValueModel };
export type { MonthlySnapshotModel };
export type { IncomeEntryModel };

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: string;
  card?: string | null;
  installments?: number | null;
  notes?: string;
  recurringMonthly?: boolean;
}

export interface Installment {
  id: string;
  name: string;
  totalAmount: number;
  monthlyAmount: number;
  remainingMonths: number;
  currentMonth: number;
  category: string;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDate: number;
  amountType: "fixed" | "variable";
}

export interface BudgetSettings {
  monthlyIncome: number;
  partnerNames: [string, string];
}

interface FinanceContextType {
  household: HouseholdModel | null;
  expenses: Expense[];
  installments: Installment[];
  financialCommitments: FinancialCommitmentModel[];
  incomeEntries: IncomeEntryModel[];
  fixedExpenses: FixedExpense[];
  fixedExpenseMonthlyValues: FixedExpenseMonthlyValueModel[];
  categories: CategoryModel[];
  paymentMethods: PaymentMethodModel[];
  monthlySnapshots: MonthlySnapshotModel[];
  activeCycle: { month: number; year: number };
  settings: BudgetSettings;
  loading: boolean;
  error: string | null;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  updateExpense: (id: string, changes: Partial<Omit<Expense, "id">>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addInstallment: (installment: Omit<Installment, "id">) => Promise<void>;
  updateInstallment: (id: string, changes: Partial<Omit<Installment, "id">>) => Promise<void>;
  deleteInstallment: (id: string) => Promise<void>;
  addFinancialCommitment: (commitment: Omit<FinancialCommitmentModel, "id" | "householdId">) => Promise<FinancialCommitmentModel>;
  updateFinancialCommitment: (id: string, changes: Partial<Omit<FinancialCommitmentModel, "id" | "householdId">>) => Promise<FinancialCommitmentModel>;
  deleteFinancialCommitment: (id: string) => Promise<void>;
  addIncomeEntry: (entry: Omit<IncomeEntryModel, "id" | "householdId">) => Promise<IncomeEntryModel>;
  updateIncomeEntry: (id: string, changes: Partial<Omit<IncomeEntryModel, "id" | "householdId">>) => Promise<IncomeEntryModel>;
  deleteIncomeEntry: (id: string) => Promise<void>;
  addFixedExpense: (expense: Omit<FixedExpense, "id">) => Promise<void>;
  updateFixedExpense: (id: string, changes: Partial<Omit<FixedExpense, "id">>) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  upsertFixedExpenseMonthlyValue: (value: Omit<FixedExpenseMonthlyValueModel, "id" | "householdId">) => Promise<void>;
  updateSettings: (settings: BudgetSettings) => Promise<void>;
  updateHouseholdAvatar: (avatarUrl: string) => Promise<void>;
  addPaymentMethod: (name: string, limitAmount?: number, type?: PaymentMethodModel["type"], closingDay?: number | null, dueDay?: number | null) => Promise<void>;
  updatePaymentMethod: (id: string, name: string, limitAmount?: number, type?: PaymentMethodModel["type"], closingDay?: number | null, dueDay?: number | null) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  closeMonth: (date?: Date) => Promise<MonthlySnapshotModel>;
  openNextMonth: () => Promise<void>;
  reopenMonth: (snapshot: MonthlySnapshotModel) => Promise<void>;
  deleteMonthlySnapshot: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, changes: Partial<Omit<CategoryModel, "id">>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const EMPTY_SETTINGS: BudgetSettings = {
  monthlyIncome: 0,
  partnerNames: ["", ""],
};

const DEFAULT_PAYMENT_METHODS: Array<{ name: string; type: PaymentMethodModel["type"] }> = [
  { name: "Pix", type: "pix" },
  { name: "Dinheiro", type: "cash" },
  { name: "Débito", type: "debit" },
];
const DEFAULT_CATEGORY_NAMES = ["Moradia", "Alimentação", "Gasolina", "Lazer", "Saúde", "Assinaturas", "Investimentos", "Outros"];

const loadErrorMessage = "Não foi possível carregar os dados do Supabase.";

const FINANCE_CACHE_VERSION = 1;

const currentCycle = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const nextCycle = (cycle: { month: number; year: number }) =>
  cycle.month === 12 ? { month: 1, year: cycle.year + 1 } : { month: cycle.month + 1, year: cycle.year };

const fixedExpenseAmountForMonth = (
  expense: FixedExpense,
  values: FixedExpenseMonthlyValueModel[],
  month: number,
  year: number,
) => {
  const monthlyValue = values.find(
    (value) => value.fixedExpenseId === expense.id && value.month === month && value.year === year,
  );
  return monthlyValue?.status === "confirmed" && monthlyValue.actualAmount !== null
    ? monthlyValue.actualAmount
    : monthlyValue?.estimatedAmount ?? expense.amount;
};

type FinanceCache = {
  version: number;
  savedAt: string;
  householdId: string | null;
  household: HouseholdModel | null;
  expenses: Expense[];
  installments: Installment[];
  financialCommitments: FinancialCommitmentModel[];
  incomeEntries: IncomeEntryModel[];
  fixedExpenses: FixedExpense[];
  fixedExpenseMonthlyValues: FixedExpenseMonthlyValueModel[];
  categories: CategoryModel[];
  paymentMethods: PaymentMethodModel[];
  monthlySnapshots: MonthlySnapshotModel[];
  activeCycle: { month: number; year: number };
  settings: BudgetSettings;
};

/**
 * FinanceProvider manages the global financial state and Supabase synchronization.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [household, setHousehold] = useState<HouseholdModel | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [financialCommitments, setFinancialCommitments] = useState<FinancialCommitmentModel[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntryModel[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [fixedExpenseMonthlyValues, setFixedExpenseMonthlyValues] = useState<FixedExpenseMonthlyValueModel[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodModel[]>([]);
  const [monthlySnapshots, setMonthlySnapshots] = useState<MonthlySnapshotModel[]>([]);
  const [activeCycle, setActiveCycle] = useState(currentCycle);
  const [settings, setSettings] = useState<BudgetSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = user ? `together:finance:${user.id}:v${FINANCE_CACHE_VERSION}` : null;

  // Obter household_id na primeira renderização
  useEffect(() => {
    const getHouseholdId = async () => {
      try {
        const id = await financeService.getUserHouseholdId();
        setHouseholdId(id);
      } catch (err) {
        console.error("Erro ao obter household_id:", err);
        setError("Erro ao carregar dados do usuário");
      }
    };
    void getHouseholdId();
  }, []);

  useEffect(() => {
    if (authLoading || !cacheKey) return;

    const rawCache = window.localStorage.getItem(cacheKey);
    if (!rawCache) return;

    try {
      const cache = JSON.parse(rawCache) as FinanceCache;
      if (cache.version !== FINANCE_CACHE_VERSION) return;

      setHouseholdId(cache.householdId);
      setHousehold(cache.household);
      setExpenses(cache.expenses ?? []);
      setInstallments(cache.installments ?? []);
      setFinancialCommitments(cache.financialCommitments ?? []);
      setIncomeEntries(cache.incomeEntries ?? []);
      setFixedExpenses(cache.fixedExpenses ?? []);
      setFixedExpenseMonthlyValues(cache.fixedExpenseMonthlyValues ?? []);
      setCategories(cache.categories ?? []);
      setPaymentMethods(cache.paymentMethods ?? []);
      setMonthlySnapshots(cache.monthlySnapshots ?? []);
      setActiveCycle(cache.activeCycle ?? currentCycle());
      setSettings(cache.settings ?? EMPTY_SETTINGS);
      setLoading(false);
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }, [authLoading, cacheKey]);

  const refreshData = async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    const hasVisibleData = Boolean(household) || expenses.length > 0 || categories.length > 0 || paymentMethods.length > 0;
    setLoading(!hasVisibleData);
    setError(null);

    try {
      const [
        expensesRes,
        installmentsRes,
        financialCommitmentsRes,
        incomeEntriesRes,
        categoriesRes,
        paymentMethodsRes,
        fixedExpensesRes,
        fixedExpenseMonthlyValuesRes,
        householdRes,
        monthlySnapshotsRes,
        financeStateRes,
      ] = await Promise.all([
        financeService.fetchExpenses(householdId),
        financeService.fetchInstallments(householdId),
        financeService.fetchFinancialCommitments(householdId),
        financeService.fetchIncomeEntries(householdId),
        financeService.fetchCategories(householdId),
        financeService.fetchPaymentMethods(householdId),
        financeService.fetchFixedExpenses(householdId),
        financeService.fetchFixedExpenseMonthlyValues(householdId),
        financeService.fetchHousehold(householdId),
        financeService.fetchMonthlySnapshots(householdId).catch(() => []),
        financeService.fetchHouseholdFinanceState(householdId).catch(() => null),
      ]);

      setExpenses(expensesRes.map((e) => ({
        id: e.id,
        amount: e.amount,
        category: e.categoryId,
        description: e.description,
        date: e.date,
        paidBy: e.createdBy,
        card: e.cardId,
        notes: e.notes,
        recurringMonthly: e.recurringMonthly,
      })));
      setInstallments(installmentsRes.map((i) => ({
        id: i.id,
        name: i.name,
        totalAmount: i.totalAmount,
        monthlyAmount: i.monthlyAmount,
        remainingMonths: i.remainingMonths,
        currentMonth: i.totalMonths - i.remainingMonths,
        category: i.categoryId,
      })));
      setCategories(categoriesRes);
      setFinancialCommitments(financialCommitmentsRes);
      setIncomeEntries(incomeEntriesRes);
      setPaymentMethods(paymentMethodsRes);
      setMonthlySnapshots(monthlySnapshotsRes);
      setActiveCycle(
        financeStateRes
          ? { month: financeStateRes.activeMonth, year: financeStateRes.activeYear }
          : currentCycle(),
      );
      setFixedExpenses(
        fixedExpensesRes.map((expense: FixedExpenseModel) => ({
          id: expense.id,
          name: expense.name,
          amount: expense.amount,
          category: expense.category,
          dueDate: expense.dueDate,
          amountType: expense.amountType,
        })),
      );
      setFixedExpenseMonthlyValues(fixedExpenseMonthlyValuesRes);
      setHousehold(householdRes);
      setSettings({
        monthlyIncome: householdRes?.monthlyIncome ?? 0,
        partnerNames: [
          householdRes?.partnerNames[0] ?? "",
          householdRes?.partnerNames[1] ?? "",
        ],
      });

      if (householdId) {
        if (categoriesRes.length === 0) {
          const seededCategories = await Promise.all(
            DEFAULT_CATEGORY_NAMES.map((name) => financeService.addCategory(name, householdId)),
          );
          setCategories(seededCategories);
        } else {
          const existingNames = new Set(categoriesRes.map((category) => category.name.trim().toLowerCase()));
          const missingNames = DEFAULT_CATEGORY_NAMES.filter((name) => !existingNames.has(name.toLowerCase()));
          if (missingNames.length > 0) {
            const newCategories = await Promise.all(
              missingNames.map((name) => financeService.addCategory(name, householdId)),
            );
            setCategories([...categoriesRes, ...newCategories].sort((a, b) => a.name.localeCompare(b.name)));
          }
        }

        if (paymentMethodsRes.length === 0) {
          const seededMethods = await Promise.all(
            DEFAULT_PAYMENT_METHODS.map((method) => financeService.addPaymentMethod(method.name, undefined, householdId, method.type)),
          );
          setPaymentMethods(seededMethods);
        }
      }
    } catch (err) {
      setError((err as Error)?.message ?? loadErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Recarregar quando householdId muda
  useEffect(() => {
    void refreshData();
  }, [householdId]);

  useEffect(() => {
    if (!cacheKey || !householdId || !household) return;

    const cache: FinanceCache = {
      version: FINANCE_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      householdId,
      household,
      expenses,
      installments,
      financialCommitments,
      incomeEntries,
      fixedExpenses,
      fixedExpenseMonthlyValues,
      categories,
      paymentMethods,
      monthlySnapshots,
      activeCycle,
      settings,
    };

    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch {
      // Cache is a speed optimization; failing to write it should not block the app.
    }
  }, [cacheKey, householdId, household, expenses, installments, financialCommitments, incomeEntries, fixedExpenses, fixedExpenseMonthlyValues, categories, paymentMethods, monthlySnapshots, activeCycle, settings]);

  const updateSettings = async (newSettings: BudgetSettings) => {
    if (household) {
      const updated = await financeService.updateHouseholdSettings(
        household.id,
        newSettings.monthlyIncome,
        newSettings.partnerNames,
      );
      setHousehold(updated);
    }
    setSettings(newSettings);
  };

  const updateHouseholdAvatarCtx = async (avatarUrl: string) => {
    if (!household?.id) throw new Error("Casa não encontrada");
    const updated = await financeService.updateHouseholdAvatar(household.id, avatarUrl);
    setHousehold(updated);
  };

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const data = await financeService.addExpense({
      ...expense,
      categoryId: expense.category,
      cardId: expense.card || null,
      createdBy: expense.paidBy,
      householdId: household?.id || "",
    });
    const newExpense: Expense = {
      id: data.id,
      amount: data.amount,
      category: data.categoryId,
      description: data.description,
      date: data.date,
      paidBy: data.createdBy,
      card: data.cardId,
      notes: data.notes,
      recurringMonthly: data.recurringMonthly,
    };
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const addInstallment = async (installment: Omit<Installment, "id">) => {
    const data = await financeService.addInstallment({
      ...installment,
      totalMonths: installment.remainingMonths + installment.currentMonth,
      categoryId: installment.category,
      expenseId: null,
      householdId: household?.id || "",
    });
    const newInstallment: Installment = {
      id: data.id,
      name: data.name,
      totalAmount: data.totalAmount,
      monthlyAmount: data.monthlyAmount,
      remainingMonths: data.remainingMonths,
      currentMonth: data.totalMonths - data.remainingMonths,
      category: data.categoryId,
    };
    setInstallments((prev) => [newInstallment, ...prev]);
  };

  const addFixedExpense = async (expense: Omit<FixedExpense, "id">) => {
    const data = await financeService.addFixedExpense({
      ...expense,
      householdId: household?.id || "",
    });
    setFixedExpenses((prev) => [
      ...prev,
      { id: data.id, name: data.name, amount: data.amount, category: data.category, dueDate: data.dueDate, amountType: data.amountType },
    ]);
  };

  const updateFixedExpense = async (id: string, changes: Partial<Omit<FixedExpense, "id">>) => {
    const updated = await financeService.updateFixedExpense(id, changes);
    setFixedExpenses((prev) => prev.map((f) => (f.id === id ? {
      id: updated.id,
      name: updated.name,
      amount: updated.amount,
      category: updated.category,
      dueDate: updated.dueDate,
      amountType: updated.amountType,
    } : f)));
  };

  const deleteFixedExpense = async (id: string) => {
    await financeService.deleteFixedExpense(id);
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  const upsertFixedExpenseMonthlyValueCtx = async (
    value: Omit<FixedExpenseMonthlyValueModel, "id" | "householdId">,
  ) => {
    if (!household?.id) throw new Error("Casa não encontrada");
    const saved = await financeService.upsertFixedExpenseMonthlyValue({
      ...value,
      householdId: household.id,
    });
    if (!saved) return;
    setFixedExpenseMonthlyValues((prev) => {
      const exists = prev.some(
        (item) =>
          item.fixedExpenseId === saved.fixedExpenseId &&
          item.month === saved.month &&
          item.year === saved.year,
      );
      if (exists) {
        return prev.map((item) =>
          item.fixedExpenseId === saved.fixedExpenseId &&
          item.month === saved.month &&
          item.year === saved.year
            ? saved
            : item,
        );
      }
      return [saved, ...prev];
    });
  };

  const updateExpense = async (id: string, changes: Partial<Omit<Expense, "id">>) => {
    const updated = await financeService.updateExpense(id, {
      amount: changes.amount,
      description: changes.description,
      date: changes.date,
      categoryId: changes.category,
      createdBy: changes.paidBy,
      cardId: changes.card,
      recurringMonthly: changes.recurringMonthly,
    });
    
    setExpenses((prev) => prev.map((e) => (e.id === id ? {
      ...e,
      amount: updated.amount,
      category: updated.categoryId,
      description: updated.description,
      date: updated.date,
      paidBy: updated.createdBy,
      card: updated.cardId,
      notes: updated.notes,
      recurringMonthly: updated.recurringMonthly,
    } : e)));
  };

  const deleteExpense = async (id: string) => {
    await financeService.deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const updateInstallment = async (id: string, changes: Partial<Omit<Installment, "id">>) => {
    const updated = await financeService.updateInstallment(id, changes);
    setInstallments((prev) => prev.map((i) => (i.id === id ? {
      ...i,
      name: updated.name,
      totalAmount: updated.totalAmount,
      monthlyAmount: updated.monthlyAmount,
      remainingMonths: updated.remainingMonths,
      currentMonth: updated.totalMonths - updated.remainingMonths,
      category: updated.categoryId
    } : i)));
  };

  const deleteInstallment = async (id: string) => {
    await financeService.deleteInstallment(id);
    setInstallments((prev) => prev.filter((i) => i.id !== id));
  };

  const addFinancialCommitmentCtx = async (commitment: Omit<FinancialCommitmentModel, "id" | "householdId">) => {
    if (!household?.id) throw new Error("Casa não encontrada");
    const data = await financeService.addFinancialCommitment({
      ...commitment,
      householdId: household.id,
    });
    setFinancialCommitments((prev) => [data, ...prev]);
    return data;
  };

  const updateFinancialCommitmentCtx = async (id: string, changes: Partial<Omit<FinancialCommitmentModel, "id" | "householdId">>) => {
    const data = await financeService.updateFinancialCommitment(id, changes);
    setFinancialCommitments((prev) => prev.map((commitment) => (commitment.id === id ? data : commitment)));
    return data;
  };

  const deleteFinancialCommitmentCtx = async (id: string) => {
    await financeService.deleteFinancialCommitment(id);
    setFinancialCommitments((prev) => prev.filter((commitment) => commitment.id !== id));
  };

  const addIncomeEntryCtx = async (entry: Omit<IncomeEntryModel, "id" | "householdId">) => {
    if (!household?.id) throw new Error("Casa não encontrada");
    const data = await financeService.addIncomeEntry({
      ...entry,
      householdId: household.id,
    });
    setIncomeEntries((prev) => [data, ...prev]);
    return data;
  };

  const updateIncomeEntryCtx = async (
    id: string,
    changes: Partial<Omit<IncomeEntryModel, "id" | "householdId">>,
  ) => {
    const data = await financeService.updateIncomeEntry(id, changes);
    setIncomeEntries((prev) => prev.map((entry) => (entry.id === id ? data : entry)));
    return data;
  };

  const deleteIncomeEntryCtx = async (id: string) => {
    await financeService.deleteIncomeEntry(id);
    setIncomeEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const addCategoryCtx = async (name: string) => {
    if (!householdId) throw new Error("Casa não encontrada");
    const newCat = await financeService.addCategory(name, householdId);
    setCategories((prev) => [...prev, newCat]);
    await refreshData();
  };

  const updateCategoryCtx = async (id: string, changes: Partial<Omit<CategoryModel, "id">>) => {
    const updated = await financeService.updateCategory(id, changes);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    await refreshData();
  };

  const deleteCategoryCtx = async (id: string) => {
    await financeService.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    await refreshData();
  };

  const addPaymentMethodCtx = async (name: string, limitAmount?: number, type: PaymentMethodModel["type"] = "credit_card", closingDay?: number | null, dueDay?: number | null) => {
    if (!householdId) throw new Error("Casa não encontrada");
    const newMethod = await financeService.addPaymentMethod(name, limitAmount, householdId, type, closingDay, dueDay);
    setPaymentMethods((prev) => [...prev, newMethod]);
    await refreshData();
  };

  const updatePaymentMethodCtx = async (id: string, name: string, limitAmount?: number, type: PaymentMethodModel["type"] = "credit_card", closingDay?: number | null, dueDay?: number | null) => {
    const updated = await financeService.updatePaymentMethod(id, name, limitAmount, type, closingDay, dueDay);
    setPaymentMethods((prev) => prev.map((m) => (m.id === id ? updated : m)));
    await refreshData();
  };

  const deletePaymentMethodCtx = async (id: string) => {
    await financeService.deletePaymentMethod(id);
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
    await refreshData();
  };

  const closeMonthCtx = async () => {
    if (!household?.id) throw new Error("Casa não encontrada");
    const month = activeCycle.month;
    const year = activeCycle.year;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const monthExpenses = expenses.filter((expense) => {
      const expenseDate = new Date(`${expense.date}T00:00:00`);
      return expenseDate >= start && expenseDate <= end;
    });
    const monthIncomeEntries = incomeEntries.filter((entry) => {
      const entryDate = new Date(`${entry.date}T00:00:00`);
      return entryDate >= start && entryDate <= end;
    });
    const billingKey = `${year}-${String(month).padStart(2, "0")}`;
    const billingKeyForPurchase = (date: string, closingDay?: number | null) => {
      const purchaseDate = new Date(`${date}T00:00:00`);
      const billDate = purchaseDate.getDate() > (closingDay || 31)
        ? new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, purchaseDate.getDate())
        : purchaseDate;
      return `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, "0")}`;
    };
    const categoryTotals = new Map<string, number>();
    const cardTotals = new Map<string, number>();
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const cardNames = new Map(paymentMethods.map((method) => [method.id, method.name]));

    for (const expense of monthExpenses) {
      const categoryName = categoryNames.get(expense.category) || expense.category || "Sem categoria";
      categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + expense.amount);
    }

    for (const expense of fixedExpenses) {
      const categoryName = expense.category || "Sem categoria";
      categoryTotals.set(
        categoryName,
        (categoryTotals.get(categoryName) || 0) +
          fixedExpenseAmountForMonth(expense, fixedExpenseMonthlyValues, month, year),
      );
    }

    for (const installment of installments) {
      const categoryName = categoryNames.get(installment.category) || installment.category || "Parcelas";
      categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + installment.monthlyAmount);
    }

    for (const commitment of financialCommitments.filter((item) => item.status !== "finished")) {
      const categoryName = categoryNames.get(commitment.categoryId) || commitment.categoryId || "Parcelas";
      categoryTotals.set(categoryName, (categoryTotals.get(categoryName) || 0) + commitment.installmentValue);
    }

    const fixedTotal = fixedExpenses.reduce(
      (sum, expense) => sum + fixedExpenseAmountForMonth(expense, fixedExpenseMonthlyValues, month, year),
      0,
    );
    const variableTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const extraIncomeTotal = monthIncomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const realIncome = settings.monthlyIncome + extraIncomeTotal;
    const installmentTotal = financialCommitments
      .filter((commitment) => commitment.status !== "finished")
      .reduce((sum, commitment) => sum + commitment.installmentValue, 0);
    const totalExpenses = variableTotal + fixedTotal + installmentTotal;
    const goalRows = await financeService.fetchGoals(household.id).catch(() => []);

    const snapshot = await financeService.addMonthlySnapshot({
      householdId: household.id,
      month,
      year,
      monthlyIncome: realIncome,
      totalExpenses,
      fixedExpensesTotal: fixedTotal,
      installmentExpensesTotal: installmentTotal,
      remainingBalance: realIncome - totalExpenses,
      categoryTotals: Array.from(categoryTotals.entries()).map(([name, amount]) => ({ name, amount })),
      cardTotals: paymentMethods
        .filter((method) => method.type === "credit_card")
        .map((method) => {
          const amount = expenses
            .filter((expense) => expense.card === method.id && billingKeyForPurchase(expense.date, method.closingDay) === billingKey)
            .reduce((sum, expense) => sum + expense.amount, 0);
          return {
            name: cardNames.get(method.id) || method.name,
            amount,
            limitAmount: method.limitAmount,
            availableLimit: method.limitAmount === null ? null : method.limitAmount - amount,
          };
        }),
      goalProgress: goalRows.map((goal) => ({
        title: goal.title,
        currentAmount: goal.currentAmount,
        targetAmount: goal.targetAmount,
        percent: goal.targetAmount > 0 ? Math.round((goal.currentAmount / goal.targetAmount) * 100) : 0,
      })),
      financialHealth: {
        availablePercent: realIncome > 0 ? Math.round(((realIncome - totalExpenses) / realIncome) * 100) : 0,
        totalSpentPercent: realIncome > 0 ? Math.round((totalExpenses / realIncome) * 100) : 0,
        baseIncome: settings.monthlyIncome,
        extraIncome: extraIncomeTotal,
      },
      closedAt: new Date().toISOString(),
    });
    setMonthlySnapshots((prev) => [snapshot, ...prev]);
    return snapshot;
  };

  const setActiveCycleCtx = async (cycle: { month: number; year: number }) => {
    if (!household?.id) throw new Error("Casa não encontrada");
    await financeService.upsertHouseholdFinanceState(household.id, cycle.month, cycle.year);
    setActiveCycle(cycle);
  };

  const openNextMonthCtx = async () => {
    await setActiveCycleCtx(nextCycle(activeCycle));
  };

  const reopenMonthCtx = async (snapshot: MonthlySnapshotModel) => {
    await financeService.deleteMonthlySnapshot(snapshot.id);
    setMonthlySnapshots((prev) => prev.filter((item) => item.id !== snapshot.id));
    await setActiveCycleCtx({ month: snapshot.month, year: snapshot.year });
  };

  const deleteMonthlySnapshotCtx = async (id: string) => {
    await financeService.deleteMonthlySnapshot(id);
    setMonthlySnapshots((prev) => prev.filter((snapshot) => snapshot.id !== id));
  };

  const value = useMemo(
    () => ({
      expenses,
      household,
      installments,
      financialCommitments,
      incomeEntries,
      fixedExpenses,
      fixedExpenseMonthlyValues,
      categories,
      paymentMethods,
      monthlySnapshots,
      activeCycle,
      settings,
      loading,
      error,
      addExpense,
      updateExpense,
      deleteExpense,
      addInstallment,
      updateInstallment,
      deleteInstallment,
      addFinancialCommitment: addFinancialCommitmentCtx,
      updateFinancialCommitment: updateFinancialCommitmentCtx,
      deleteFinancialCommitment: deleteFinancialCommitmentCtx,
      addIncomeEntry: addIncomeEntryCtx,
      updateIncomeEntry: updateIncomeEntryCtx,
      deleteIncomeEntry: deleteIncomeEntryCtx,
      addFixedExpense,
      updateFixedExpense,
      deleteFixedExpense,
      upsertFixedExpenseMonthlyValue: upsertFixedExpenseMonthlyValueCtx,
      updateSettings,
      updateHouseholdAvatar: updateHouseholdAvatarCtx,
      addPaymentMethod: addPaymentMethodCtx,
      updatePaymentMethod: updatePaymentMethodCtx,
      deletePaymentMethod: deletePaymentMethodCtx,
      closeMonth: closeMonthCtx,
      openNextMonth: openNextMonthCtx,
      reopenMonth: reopenMonthCtx,
      deleteMonthlySnapshot: deleteMonthlySnapshotCtx,
      addCategory: addCategoryCtx,
      updateCategory: updateCategoryCtx,
      deleteCategory: deleteCategoryCtx,
    }),
    [household, expenses, installments, financialCommitments, incomeEntries, fixedExpenses, fixedExpenseMonthlyValues, categories, paymentMethods, monthlySnapshots, activeCycle, settings, loading, error],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance must be used within FinanceProvider");
  }
  return context;
}

export const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
