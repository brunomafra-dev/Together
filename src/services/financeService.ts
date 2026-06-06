import { supabase } from "../lib/supabase";
import type { TableInsert, TableRow } from "../lib/database.types";

type ExpenseRow = TableRow<"expenses">;
type InstallmentRow = TableRow<"installments">;
type CardRow = TableRow<"cards">;
type HouseholdRow = TableRow<"households">;
type FixedExpenseRow = TableRow<"fixed_expenses">;
type ProfileRow = TableRow<"profiles">;

export interface ExpenseModel {
  id: string;
  amount: number;
  categoryId: string;
  description: string;
  date: string;
  createdBy: string;
  cardId?: string | null;
  notes?: string;
}

export interface InstallmentModel {
  id: string;
  name: string;
  totalAmount: number;
  monthlyAmount: number;
  remainingMonths: number;
  totalMonths: number;
  categoryId: string;
  expenseId?: string | null;
}

export interface CategoryModel {
  id: string;
  name: string;
}

export interface FixedExpenseModel {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDate: number;
}

export interface PaymentMethodModel {
  id: string;
  name: string;
  limitAmount: number | null;
}

export interface HouseholdModel {
  id: string;
  name: string;
  monthlyIncome: number;
  partnerNames: [string, string];
}

const toNumber = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const toString = (value: unknown) => (typeof value === "string" ? value : "");
const throwIfError = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    throw new Error(String((error as { message?: string }).message || "Supabase error"));
  }
};

// Obter household_id do usuário atual
export async function getUserHouseholdId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: members, error } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("profile_id", user.id)
    .single();
  
  throwIfError(error);
  return members?.household_id || null;
}

const mapExpenseRow = (row: any): ExpenseModel => ({
  id: row.id,
  amount: toNumber(row.amount),
  categoryId: toString(row.category_id),
  description: toString(row.description),
  date: toString(row.purchase_date),
  createdBy: toString(row.created_by),
  cardId: row.card_id,
  notes: toString(row.notes),
});

const mapInstallmentRow = (row: any): InstallmentModel => ({
  id: row.id,
  name: `Parcela ${row.installment_number ?? 1}`,
  totalAmount: toNumber(row.amount) * toNumber(row.total_installments),
  monthlyAmount: toNumber(row.amount),
  remainingMonths: Math.max((toNumber(row.total_installments) || 0) - (toNumber(row.installment_number) || 0), 0),
  totalMonths: toNumber(row.total_installments),
  categoryId: toString(row.expenses?.category_id),
  expenseId: row.expense_id,
});

const mapCategoryRow = (row: TableRow<"categories">): CategoryModel => ({
  id: row.id,
  name: toString(row.name),
});

const mapPaymentMethodRow = (row: CardRow): PaymentMethodModel => ({
  id: row.id,
  name: toString(row.name),
  limitAmount: row.limit_amount ?? null,
});

const mapFixedExpenseRow = (row: FixedExpenseRow): FixedExpenseModel => ({
  id: row.id,
  name: toString(row.name),
  amount: toNumber(row.amount),
  category: toString(row.category),
  dueDate: toNumber(row.due_day),
});

const mapHouseholdRow = (row: HouseholdRow, partnerNames: [string, string]): HouseholdModel => ({
  id: row.id,
  name: toString(row.name),
  monthlyIncome: toNumber(row.limit_amount),
  partnerNames,
});

export async function fetchExpenses(householdId: string): Promise<ExpenseModel[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("household_id", householdId)
    .order("purchase_date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapExpenseRow);
}

export async function fetchInstallments(householdId: string): Promise<InstallmentModel[]> {
  const { data, error } = await supabase
    .from("installments")
    .select("*, expenses!inner(household_id, category_id)")
    .eq("expenses.household_id", householdId)
    .order("due_month", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapInstallmentRow);
}

export async function fetchCategories(householdId: string): Promise<CategoryModel[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("name");
  throwIfError(error);
  return (data ?? []).map(mapCategoryRow);
}

export async function fetchPaymentMethods(householdId: string): Promise<PaymentMethodModel[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("household_id", householdId)
    .order("name");
  throwIfError(error);
  return (data ?? []).map(mapPaymentMethodRow);
}

export async function fetchFixedExpenses(householdId: string): Promise<FixedExpenseModel[]> {
  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .eq("household_id", householdId)
    .order("due_day");
  if (error) {
    if (String(error.message || "").includes("schema cache")) return [];
    throwIfError(error);
  }
  return (data ?? []).map(mapFixedExpenseRow);
}

export async function addFixedExpense(
  fixedExpense: Omit<FixedExpenseModel, "id"> & { householdId: string },
): Promise<FixedExpenseModel> {
  const { data, error } = await supabase
    .from("fixed_expenses")
    .insert({
      household_id: fixedExpense.householdId,
      name: fixedExpense.name,
      amount: fixedExpense.amount,
      category: fixedExpense.category,
      due_day: fixedExpense.dueDate,
    })
    .select("*")
    .single();
  throwIfError(error);
  return mapFixedExpenseRow(data as FixedExpenseRow);
}

export async function updateFixedExpense(
  id: string,
  changes: Partial<Omit<FixedExpenseModel, "id">>,
): Promise<FixedExpenseModel> {
  const { data, error } = await supabase
    .from("fixed_expenses")
    .update({
      name: changes.name,
      amount: changes.amount,
      category: changes.category,
      due_day: changes.dueDate,
    })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return mapFixedExpenseRow(data as FixedExpenseRow);
}

export async function deleteFixedExpense(id: string): Promise<void> {
  const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
  throwIfError(error);
}

export async function fetchHousehold(householdId: string): Promise<HouseholdModel | null> {
  const { data: households, error: householdError } = await supabase
    .from("households")
    .select("*")
    .eq("id", householdId)
    .limit(1);
  throwIfError(householdError);
  const householdRow = households?.[0];
  if (!householdRow) return null;
  
  const activeHouseholdId = householdRow.id;
  const { data: members, error: memberError } = await supabase.from("household_members").select("profile_id").eq("household_id", activeHouseholdId);
  throwIfError(memberError);

  const profileIds = (members ?? []).map((member) => member.profile_id).filter(Boolean) as string[];
  let partnerNames: [string, string] = ["", ""];

  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase.from("profiles").select("id, name").in("id", profileIds);
    throwIfError(profileError);
    partnerNames = [
      toString((profiles?.[0] as ProfileRow | undefined)?.name),
      toString((profiles?.[1] as ProfileRow | undefined)?.name),
    ];
  }

  return mapHouseholdRow(householdRow, partnerNames);
}

export async function addExpense(expense: Omit<ExpenseModel, "id"> & { householdId: string }): Promise<ExpenseModel> {
  const payload: TableInsert<"expenses"> = {
    household_id: expense.householdId,
    category_id: expense.categoryId || null,
    card_id: expense.cardId || null,
    description: expense.description,
    amount: expense.amount,
    purchase_date: expense.date,
    created_by: expense.createdBy || null,
    notes: (expense as any).notes,
  };
  const { data, error } = await supabase.from("expenses").insert(payload).select("*").single();
  throwIfError(error);
  return mapExpenseRow(data as ExpenseRow);
}

export async function updateExpense(id: string, changes: Partial<Omit<ExpenseModel, "id">>): Promise<ExpenseModel> {
  const payload: Partial<TableInsert<"expenses">> = {};
  if (changes.amount !== undefined) payload.amount = changes.amount;
  if (changes.categoryId !== undefined) payload.category_id = changes.categoryId || null;
  if (changes.description !== undefined) payload.description = changes.description;
  if (changes.date !== undefined) payload.purchase_date = changes.date;
  if (changes.createdBy !== undefined) payload.created_by = changes.createdBy || null;
  if (changes.cardId !== undefined) payload.card_id = changes.cardId || null;
  const { data, error } = await supabase.from("expenses").update(payload).eq("id", id).select("*").single();
  throwIfError(error);
  return mapExpenseRow(data as ExpenseRow);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  throwIfError(error);
}

export async function addInstallment(installment: Omit<InstallmentModel, "id"> & { householdId: string }): Promise<InstallmentModel> {
  const payload: TableInsert<"installments"> = {
    expense_id: installment.expenseId || null,
    installment_number: 1,
    total_installments: installment.totalMonths,
    amount: installment.monthlyAmount,
    due_month: new Date().toISOString().slice(0, 10),
  };
  const { data, error } = await supabase.from("installments").insert(payload).select("*").single();
  throwIfError(error);
  return mapInstallmentRow(data as InstallmentRow);
}

export async function updateInstallment(id: string, changes: Partial<Omit<InstallmentModel, "id">>): Promise<InstallmentModel> {
  const payload: Partial<TableInsert<"installments">> = {};
  if (changes.monthlyAmount !== undefined) payload.amount = changes.monthlyAmount;
  if (changes.totalMonths !== undefined) payload.total_installments = changes.totalMonths;
  if (changes.expenseId !== undefined) payload.expense_id = changes.expenseId || null;
  const { data, error } = await supabase.from("installments").update(payload).eq("id", id).select("*").single();
  throwIfError(error);
  return mapInstallmentRow(data as InstallmentRow);
}

export async function deleteInstallment(id: string): Promise<void> {
  const { error } = await supabase.from("installments").delete().eq("id", id);
  throwIfError(error);
}

export async function addCategory(name: string, householdId: string): Promise<CategoryModel> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name, household_id: householdId })
    .select("*")
    .single();
  throwIfError(error);
  return mapCategoryRow(data as TableRow<"categories">);
}

export async function updateCategory(id: string, changes: Partial<Omit<CategoryModel, "id">>): Promise<CategoryModel> {
  const { data, error } = await supabase
    .from("categories")
    .update({ name: changes.name })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return mapCategoryRow(data as TableRow<"categories">);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  throwIfError(error);
}

export async function addPaymentMethod(name: string, limitAmount?: number, householdId?: string): Promise<PaymentMethodModel> {
  const payload: any = { name, limit_amount: limitAmount ?? null };
  if (householdId) payload.household_id = householdId;
  const { data, error } = await supabase
    .from("cards")
    .insert(payload)
    .select("*")
    .single();
  throwIfError(error);
  return mapPaymentMethodRow(data as CardRow);
}

export async function updatePaymentMethod(id: string, name: string, limitAmount?: number): Promise<PaymentMethodModel> {
  const { data, error } = await supabase
    .from("cards")
    .update({ name, limit_amount: limitAmount ?? null })
    .eq("id", id)
    .select("*")
    .single();
  throwIfError(error);
  return mapPaymentMethodRow(data as CardRow);
}

export async function deletePaymentMethod(id: string): Promise<void> {
  const { error } = await supabase.from("cards").delete().eq("id", id);
  throwIfError(error);
}

export async function updateHouseholdSettings(householdId: string, monthlyIncome: number, partnerNames: [string, string]): Promise<HouseholdModel | null> {
  const { data, error } = await supabase
    .from("households")
    .update({
      limit_amount: monthlyIncome,
      name: partnerNames.filter(Boolean).join(" e ") || "Household",
    })
    .eq("id", householdId)
    .select("*")
    .single();
  throwIfError(error);
  return mapHouseholdRow(data as HouseholdRow, partnerNames);
}
