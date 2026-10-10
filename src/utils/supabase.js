import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = Boolean(supabase)

export function getAuthRedirectUrl() {
  if (import.meta.env.VITE_SITE_URL) {
    return import.meta.env.VITE_SITE_URL.replace(/\/+$/, '')
  }
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')) {
    return window.location.origin
  }
  return 'https://my-expense-tracker-peach.vercel.app'
}
