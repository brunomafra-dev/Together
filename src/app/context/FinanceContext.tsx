import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import type { TableInsert, TableRow } from "../../lib/database.types";

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: string;
  card?: string | null;
  installments?: number | null;
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
  cards: string[];
}

interface FinanceContextType {
  expenses: Expense[];
  installments: Installment[];
  fixedExpenses: FixedExpense[];
  settings: BudgetSettings;
  loading: boolean;
  error: string | null;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  addInstallment: (installment: Omit<Installment, "id">) => Promise<void>;
  addFixedExpense: (expense: Omit<FixedExpense, "id">) => Promise<void>;
  updateSettings: (settings: BudgetSettings) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteInstallment: (id: string) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const EMPTY_SETTINGS: BudgetSettings = {
  monthlyIncome: 0,
  partnerNames: ["", ""],
  cards: [],
};

const mapExpenseRow = (row: TableRow<"expenses">): Expense => ({
  id: row.id,
  amount: row.amount,
  category: row.category_id ?? "",
  description: row.description,
  date: row.spent_at,
  paidBy: row.profile_id ?? "",
  card: row.card_id,
  installments: row.installments_count,
});

const mapInstallmentRow = (row: TableRow<"installments">): Installment => ({
  id: row.id,
  name: row.description,
  totalAmount: row.total_amount,
  monthlyAmount: row.monthly_amount,
  remainingMonths: row.remaining_months,
  currentMonth: row.total_months - row.remaining_months,
  category: row.category_id ?? "",
});

const loadErrorMessage = "Não foi possível carregar os dados do Supabase.";

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    setLoading(true);
    setError(null);

    const [expensesRes, installmentsRes] = await Promise.all([
      supabase.from("expenses").select("*").order("spent_at", { ascending: false }),
      supabase.from("installments").select("*").order("created_at", { ascending: false }),
    ]);

    if (expensesRes.error || installmentsRes.error) {
      setError(
        expensesRes.error?.message ||
          installmentsRes.error?.message ||
          loadErrorMessage,
      );
    }

    setExpenses((expensesRes.data ?? []).map(mapExpenseRow));
    setInstallments((installmentsRes.data ?? []).map(mapInstallmentRow));
    setFixedExpenses([]);
    setLoading(false);
  };

  useEffect(() => {
    void refreshData();
  }, []);

  const updateSettings = async (newSettings: BudgetSettings) => {
    setSettings(newSettings);
  };

  const addExpense = async (expense: Omit<Expense, "id">) => {
    const payload: TableInsert<"expenses"> = {
      amount: expense.amount,
      category_id: expense.category || null,
      description: expense.description,
      spent_at: expense.date,
      profile_id: expense.paidBy || null,
      card_id: expense.card || null,
      installments_count: expense.installments ?? null,
    };

    const { data, error } = await supabase.from("expenses").insert(payload).select("*").single();
    if (error || !data) {
      throw new Error(error?.message || "Falha ao salvar gasto.");
    }
    setExpenses((prev) => [mapExpenseRow(data), ...prev]);
  };

  const addInstallment = async (installment: Omit<Installment, "id">) => {
    const payload: TableInsert<"installments"> = {
      description: installment.name,
      total_amount: installment.totalAmount,
      monthly_amount: installment.monthlyAmount,
      remaining_months: installment.remainingMonths,
      total_months: installment.currentMonth + installment.remainingMonths,
      starts_at: new Date().toISOString().slice(0, 10),
      household_id: "",
      category_id: installment.category || null,
      expense_id: null,
      ends_at: null,
    };

    const { data, error } = await supabase.from("installments").insert(payload).select("*").single();
    if (error || !data) {
      throw new Error(error?.message || "Falha ao salvar parcela.");
    }
    setInstallments((prev) => [mapInstallmentRow(data), ...prev]);
  };

  const addFixedExpense = async (expense: Omit<FixedExpense, "id">) => {
    setFixedExpenses((prev) => [
      ...prev,
      { ...expense, id: crypto.randomUUID() },
    ]);
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const deleteInstallment = async (id: string) => {
    const { error } = await supabase.from("installments").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
    setInstallments((prev) => prev.filter((i) => i.id !== id));
  };

  const deleteFixedExpense = async (id: string) => {
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  const value = useMemo(
    () => ({
      expenses,
      installments,
      fixedExpenses,
      settings,
      loading,
      error,
      addExpense,
      addInstallment,
      addFixedExpense,
      updateSettings,
      deleteExpense,
      deleteInstallment,
      deleteFixedExpense,
    }),
    [expenses, installments, fixedExpenses, settings, loading, error],
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
