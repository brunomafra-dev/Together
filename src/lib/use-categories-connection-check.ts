import { useEffect, useState } from 'react'
import { fetchCategories, type CategoryRecord } from './categories-service'

type ConnectionState = {
  loading: boolean
  error: string | null
  categories: CategoryRecord[]
}

export function useCategoriesConnectionCheck() {
  const [state, setState] = useState<ConnectionState>({
    loading: true,
    error: null,
    categories: [],
  })

  useEffect(() => {
    let cancelled = false

    async function runCheck() {
      console.info('[Supabase] Loading categories...')

      const { data, error } = await fetchCategories()

      if (cancelled) {
        return
      }

      if (error) {
        console.error('[Supabase] Failed to load categories:', error.message)
        setState({ loading: false, error: error.message, categories: [] })
        return
      }

      console.info('[Supabase] Categories loaded:', data)
      setState({ loading: false, error: null, categories: data })
    }

    runCheck()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}

