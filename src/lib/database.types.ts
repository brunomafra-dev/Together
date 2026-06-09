export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface TimestampedRow {
  created_at: string
}

export interface Profile extends TimestampedRow {
  id: string
  name: string | null
  email: string | null
}

export interface Household extends TimestampedRow {
  id: string
  name: string | null
  monthly_income: number | null
  partner_1_name: string | null
  partner_2_name: string | null
  avatar_url: string | null
}

export interface HouseholdMember extends TimestampedRow {
  id: string
  household_id: string | null
  profile_id: string | null
}

export interface Card extends TimestampedRow {
  id: string
  household_id: string | null
  name: string | null
  limit_amount: number | null
  type: 'credit_card' | 'debit' | 'pix' | 'cash' | null
  closing_day: number | null
  due_day: number | null
}

export interface MonthlySnapshot extends TimestampedRow {
  id: string
  household_id: string | null
  month: number | null
  year: number | null
  monthly_income: number | null
  total_expenses: number | null
  fixed_expenses_total: number | null
  installment_expenses_total: number | null
  remaining_balance: number | null
  category_totals: Json | null
  card_totals: Json | null
  goal_progress: Json | null
  financial_health: Json | null
  closed_at: string | null
}

export interface Category extends TimestampedRow {
  id: string
  household_id: string | null
  name: string | null
}

export interface Expense extends TimestampedRow {
  id: string
  household_id: string | null
  category_id: string | null
  card_id: string | null
  description: string | null
  amount: number | null
  purchase_date: string | null
  created_by: string | null
  paid_by: string | null
}

export interface Installment extends TimestampedRow {
  id: string
  expense_id: string | null
  installment_number: number | null
  total_installments: number | null
  amount: number | null
  due_month: string | null
}

export interface FixedExpense extends TimestampedRow {
  id: string
  household_id: string | null
  name: string | null
  amount: number | null
  category: string | null
  due_day: number | null
}

export interface Goal extends TimestampedRow {
  id: string
  household_id: string | null
  title: string | null
  label: string | null
  current_amount: number | null
  target_amount: number | null
  updated_at: string | null
}

export interface GoalPlanItem extends TimestampedRow {
  id: string
  goal_id: string | null
  name: string | null
  share: string | null
  amount: number | null
  tone: string | null
}

export interface GoalProgressRow extends TimestampedRow {
  id: string
  goal_id: string | null
  name: string | null
  planned: number | null
  realized: number | null
  status: string | null
}

export interface FinancialCommitment extends TimestampedRow {
  id: string
  household_id: string | null
  payment_method_id: string | null
  item_name: string | null
  installment_value: number | null
  current_installment: number | null
  total_installments: number | null
  responsible_person: string | null
  notes: string | null
  started_at: string | null
  status: string | null
  updated_at: string | null
}

type RowShape = {
  id?: string
  created_at?: string
}

type TableDef<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
}

type NewRow<T extends RowShape> = Partial<T> & Pick<T, 'id'>
type PatchRow<T extends RowShape> = Partial<T>

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, NewRow<Profile>, PatchRow<Profile>>
      households: TableDef<Household, NewRow<Household>, PatchRow<Household>>
      household_members: TableDef<HouseholdMember, NewRow<HouseholdMember>, PatchRow<HouseholdMember>>
      cards: TableDef<Card, NewRow<Card>, PatchRow<Card>>
      monthly_snapshots: TableDef<MonthlySnapshot, NewRow<MonthlySnapshot>, PatchRow<MonthlySnapshot>>
      categories: TableDef<Category, NewRow<Category>, PatchRow<Category>>
      expenses: TableDef<Expense, NewRow<Expense>, PatchRow<Expense>>
      installments: TableDef<Installment, NewRow<Installment>, PatchRow<Installment>>
      fixed_expenses: TableDef<FixedExpense, NewRow<FixedExpense>, PatchRow<FixedExpense>>
      goals: TableDef<Goal, NewRow<Goal>, PatchRow<Goal>>
      goal_plan_items: TableDef<GoalPlanItem, NewRow<GoalPlanItem>, PatchRow<GoalPlanItem>>
      goal_progress_rows: TableDef<GoalProgressRow, NewRow<GoalProgressRow>, PatchRow<GoalProgressRow>>
      financial_commitments: TableDef<FinancialCommitment, NewRow<FinancialCommitment>, PatchRow<FinancialCommitment>>
    }
    Views: Record<string, never>
    Functions: {
      bootstrap_current_user_household: {
        Args: Record<string, never>
        Returns: string
      }
      delete_current_user: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type PublicSchema = Database['public']
export type TableName = keyof PublicSchema['Tables']
export type TableRow<T extends TableName> = PublicSchema['Tables'][T]['Row']
export type TableInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update']
