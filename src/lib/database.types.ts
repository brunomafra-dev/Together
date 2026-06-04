export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface TimestampedRow {
  created_at: string
  updated_at: string
}

export interface Profile extends TimestampedRow {
  id: string
  full_name: string | null
  avatar_url: string | null
}

export interface Household extends TimestampedRow {
  id: string
  name: string
  owner_id: string
}

export interface HouseholdMember extends TimestampedRow {
  id: string
  household_id: string
  profile_id: string
  role: string
}

export interface Card extends TimestampedRow {
  id: string
  household_id: string | null
  profile_id: string | null
  name: string
  brand: string | null
  last_four: string | null
  closing_day: number | null
  due_day: number | null
}

export interface Category extends TimestampedRow {
  id: string
  household_id: string | null
  name: string
  color: string | null
  icon: string | null
  is_system: boolean
}

export interface Expense extends TimestampedRow {
  id: string
  household_id: string
  profile_id: string | null
  card_id: string | null
  category_id: string | null
  description: string
  amount: number
  spent_at: string
  installments_count: number | null
}

export interface Installment extends TimestampedRow {
  id: string
  household_id: string
  expense_id: string | null
  category_id: string | null
  description: string
  total_amount: number
  monthly_amount: number
  total_months: number
  remaining_months: number
  starts_at: string
  ends_at: string | null
}

type RowShape = {
  id?: string
  created_at?: string
  updated_at?: string
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
      categories: TableDef<Category, NewRow<Category>, PatchRow<Category>>
      expenses: TableDef<Expense, NewRow<Expense>, PatchRow<Expense>>
      installments: TableDef<Installment, NewRow<Installment>, PatchRow<Installment>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type PublicSchema = Database['public']
export type TableName = keyof PublicSchema['Tables']
export type TableRow<T extends TableName> = PublicSchema['Tables'][T]['Row']
export type TableInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert']
export type TableUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update']

