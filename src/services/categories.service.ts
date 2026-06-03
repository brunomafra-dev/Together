import { supabase } from '../lib/supabase'
import type { Category, TableRow } from '../lib/database.types'

export type CategoryRow = TableRow<'categories'>

export interface CategoriesServiceResult {
  data: CategoryRow[]
  loading: boolean
  error: string | null
}

export async function getCategories(): Promise<CategoriesServiceResult> {
  const loading = true

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('id')

  if (error) {
    return {
      data: [],
      loading: false,
      error: error.message,
    }
  }

  return {
    data: (data ?? []) as Category[],
    loading: false,
    error: null,
  }
}

