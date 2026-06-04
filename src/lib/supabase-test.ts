import { supabase } from './supabase'

export async function testSupabaseConnection() {
  const { error } = await supabase.auth.getSession()

  return {
    ok: !error,
    error: error?.message ?? null,
  }
}
