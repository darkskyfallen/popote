// Client Supabase. Sans configuration, l'appli tourne en mode local (données dans le navigateur).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const hasSupabase = Boolean(url && key)
export const supabase = hasSupabase
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'popote-auth' } })
  : null
