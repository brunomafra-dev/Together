import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  paidBy: string;
  card?: string;
  installments?: number;
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
  addExpense: (expense: Omit<Expense, "id">) => void;
  addInstallment: (installment: Omit<Installment, "id">) => void;
  addFixedExpense: (expense: Omit<FixedExpense, "id">) => void;
  updateSettings: (settings: BudgetSettings) => void;
  deleteExpense: (id: string) => void;
  deleteInstallment: (id: string) => void;
  deleteFixedExpense: (id: string) => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const MOCK_DATA = {
  expenses: [
    {
      id: "1",
      amount: 245.5,
      category: "Mercado",
      description: "Compras da semana",
      date: "2026-06-01",
      paidBy: "Ana",
      card: "Nubank",
      installments: 1,
    },
    {
      id: "2",
      amount: 132.0,
      category: "Restaurante",
      description: "Jantar no japonês",
      date: "2026-06-02",
      paidBy: "Pedro",
      card: "Itaú",
      installments: 1,
    },
    {
      id: "3",
      amount: 320.0,
      category: "Transporte",
      description: "Combustível",
      date: "2026-06-02",
      paidBy: "Ana",
      card: "Nubank",
      installments: 1,
    },
    {
      id: "4",
      amount: 89.9,
      category: "Lazer",
      description: "Cinema",
      date: "2026-06-03",
      paidBy: "Pedro",
      card: "Itaú",
      installments: 1,
    },
  ] as Expense[],
  installments: [
    {
      id: "1",
      name: "Sofá da sala",
      totalAmount: 2400,
      monthlyAmount: 400,
      remainingMonths: 4,
      currentMonth: 2,
      category: "Casa",
    },
    {
      id: "2",
      name: "Notebook",
      totalAmount: 4800,
      monthlyAmount: 600,
      remainingMonths: 6,
      currentMonth: 2,
      category: "Eletrônicos",
    },
    {
      id: "3",
      name: "Viagem Bariloche",
      totalAmount: 3600,
      monthlyAmount: 300,
      remainingMonths: 10,
      currentMonth: 2,
      category: "Viagem",
    },
  ] as Installment[],
  fixedExpenses: [
    { id: "1", name: "Aluguel", amount: 2800, category: "Moradia", dueDate: 5 },
    { id: "2", name: "Internet", amount: 120, category: "Contas", dueDate: 15 },
    { id: "3", name: "Academia", amount: 180, category: "Saúde", dueDate: 1 },
    { id: "4", name: "Streaming", amount: 89, category: "Lazer", dueDate: 10 },
    { id: "5", name: "Luz", amount: 220, category: "Contas", dueDate: 20 },
  ] as FixedExpense[],
  settings: {
    monthlyIncome: 12000,
    partnerNames: ["Ana", "Pedro"] as [string, string],
    cards: ["Nubank", "Itaú", "Dinheiro"],
  },
};

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [settings, setSettings] = useState<BudgetSettings>(MOCK_DATA.settings);

  useEffect(() => {
    const stored = localStorage.getItem("financeData");
    if (stored) {
      const data = JSON.parse(stored);
      setExpenses(data.expenses || MOCK_DATA.expenses);
      setInstallments(data.installments || MOCK_DATA.installments);
      setFixedExpenses(data.fixedExpenses || MOCK_DATA.fixedExpenses);
      setSettings({ ...MOCK_DATA.settings, ...(data.settings || {}) });
    } else {
      setExpenses(MOCK_DATA.expenses);
      setInstallments(MOCK_DATA.installments);
      setFixedExpenses(MOCK_DATA.fixedExpenses);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "financeData",
      JSON.stringify({ expenses, installments, fixedExpenses, settings })
    );
  }, [expenses, installments, fixedExpenses, settings]);

  const addExpense = (expense: Omit<Expense, "id">) => {
    setExpenses((prev) => [...prev, { ...expense, id: Date.now().toString() }]);
  };

  const addInstallment = (installment: Omit<Installment, "id">) => {
    setInstallments((prev) => [
      ...prev,
      { ...installment, id: Date.now().toString() },
    ]);
  };

  const addFixedExpense = (expense: Omit<FixedExpense, "id">) => {
    setFixedExpenses((prev) => [
      ...prev,
      { ...expense, id: Date.now().toString() },
    ]);
  };

  const updateSettings = (newSettings: BudgetSettings) => {
    setSettings(newSettings);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const deleteInstallment = (id: string) => {
    setInstallments((prev) => prev.filter((i) => i.id !== id));
  };

  const deleteFixedExpense = (id: string) => {
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <FinanceContext.Provider
      value={{
        expenses,
        installments,
        fixedExpenses,
        settings,
        addExpense,
        addInstallment,
        addFixedExpense,
        updateSettings,
        deleteExpense,
        deleteInstallment,
        deleteFixedExpense,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
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
