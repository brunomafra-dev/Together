import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import * as financeService from "../../services/financeService";
import type {
  CategoryModel,
  FixedExpenseModel,
  HouseholdModel,
  PaymentMethodModel,
} from "../../services/financeService";

export type { CategoryModel, HouseholdModel, PaymentMethodModel };

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
}

export interface BudgetSettings {
  monthlyIncome: number;
  partnerNames: [string, string];
}

interface FinanceContextType {
  household: HouseholdModel | null;
  expenses: Expense[];
  installments: Installment[];
  fixedExpenses: FixedExpense[];
  categories: CategoryModel[];
  paymentMethods: PaymentMethodModel[];
  settings: BudgetSettings;
  loading: boolean;
  error: string | null;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  updateExpense: (id: string, changes: Partial<Omit<Expense, "id">>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addInstallment: (installment: Omit<Installment, "id">) => Promise<void>;
  updateInstallment: (id: string, changes: Partial<Omit<Installment, "id">>) => Promise<void>;
  deleteInstallment: (id: string) => Promise<void>;
  addFixedExpense: (expense: Omit<FixedExpense, "id">) => Promise<void>;
  updateFixedExpense: (id: string, changes: Partial<Omit<FixedExpense, "id">>) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  updateSettings: (settings: BudgetSettings) => Promise<void>;
  addPaymentMethod: (name: string) => Promise<void>;
  updatePaymentMethod: (id: string, name: string) => Promise<void>;
  deletePaymentMethod: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  updateCategory: (id: string, changes: Partial<Omit<CategoryModel, "id">>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const EMPTY_SETTINGS: BudgetSettings = {
  monthlyIncome: 0,
  partnerNames: ["", ""],
};

const DEFAULT_PAYMENT_METHOD_NAMES = ["Pix", "Dinheiro", "Débito"];
const DEFAULT_CATEGORY_NAMES = ["Moradia", "Alimentação", "Gasolina", "Lazer", "Saúde", "Investimentos", "Outros"];

const loadErrorMessage = "Não foi possível carregar os dados do Supabase.";

/**
 * FinanceProvider manages the global financial state and Supabase synchronization.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [household, setHousehold] = useState<HouseholdModel | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodModel[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const refreshData = async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        expensesRes,
        installmentsRes,
        categoriesRes,
        paymentMethodsRes,
        fixedExpensesRes,
        householdRes,
      ] = await Promise.all([
        financeService.fetchExpenses(householdId),
        financeService.fetchInstallments(householdId),
        financeService.fetchCategories(householdId),
        financeService.fetchPaymentMethods(householdId),
        financeService.fetchFixedExpenses(householdId),
        financeService.fetchHousehold(householdId),
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
      setPaymentMethods(paymentMethodsRes);
      setFixedExpenses(
        fixedExpensesRes.map((expense: FixedExpenseModel) => ({
          id: expense.id,
          name: expense.name,
          amount: expense.amount,
          category: expense.category,
          dueDate: expense.dueDate,
        })),
      );
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
        }

        if (paymentMethodsRes.length === 0) {
          const seededMethods = await Promise.all(
            DEFAULT_PAYMENT_METHOD_NAMES.map((name) => financeService.addPaymentMethod(name, 0, householdId)),
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
      { id: data.id, name: data.name, amount: data.amount, category: data.category, dueDate: data.dueDate },
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
    } : f)));
  };

  const deleteFixedExpense = async (id: string) => {
    await financeService.deleteFixedExpense(id);
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  const updateExpense = async (id: string, changes: Partial<Omit<Expense, "id">>) => {
    const updated = await financeService.updateExpense(id, {
      amount: changes.amount,
      description: changes.description,
      date: changes.date,
      categoryId: changes.category,
      createdBy: changes.paidBy,
      cardId: changes.card
    });
    
    setExpenses((prev) => prev.map((e) => (e.id === id ? {
      ...e,
      amount: updated.amount,
      category: updated.categoryId,
      description: updated.description,
      date: updated.date,
      paidBy: updated.createdBy,
      card: updated.cardId,
      notes: updated.notes
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

  const addCategoryCtx = async (name: string) => {
    if (!householdId) throw new Error("Household ID não encontrado");
    const newCat = await financeService.addCategory(name, householdId);
    setCategories((prev) => [...prev, newCat]);
  };

  const updateCategoryCtx = async (id: string, changes: Partial<Omit<CategoryModel, "id">>) => {
    const updated = await financeService.updateCategory(id, changes);
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCategoryCtx = async (id: string) => {
    await financeService.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const addPaymentMethodCtx = async (name: string) => {
    if (!householdId) throw new Error("Household ID não encontrado");
    const newMethod = await financeService.addPaymentMethod(name, undefined, householdId);
    setPaymentMethods((prev) => [...prev, newMethod]);
  };

  const updatePaymentMethodCtx = async (id: string, name: string) => {
    const updated = await financeService.updatePaymentMethod(id, name);
    setPaymentMethods((prev) => prev.map((m) => (m.id === id ? updated : m)));
  };

  const deletePaymentMethodCtx = async (id: string) => {
    await financeService.deletePaymentMethod(id);
    setPaymentMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const value = useMemo(
    () => ({
      expenses,
      household,
      installments,
      fixedExpenses,
      categories,
      paymentMethods,
      settings,
      loading,
      error,
      addExpense,
      updateExpense,
      deleteExpense,
      addInstallment,
      updateInstallment,
      deleteInstallment,
      addFixedExpense,
      updateFixedExpense,
      deleteFixedExpense,
      updateSettings,
      addPaymentMethod: addPaymentMethodCtx,
      updatePaymentMethod: updatePaymentMethodCtx,
      deletePaymentMethod: deletePaymentMethodCtx,
      addCategory: addCategoryCtx,
      updateCategory: updateCategoryCtx,
      deleteCategory: deleteCategoryCtx,
    }),
    [household, expenses, installments, fixedExpenses, categories, paymentMethods, settings, loading, error],
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
