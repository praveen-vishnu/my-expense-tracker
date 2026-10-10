import { useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../utils/supabase.js'

export function useAuth() {
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthUser({ id: 'local-user' })
      setAuthReady(true)
      return undefined
    }

    let active = true

    // Check if user landed from a Supabase recovery email link
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || ''
      const search = window.location.search || ''
      if (
        hash.includes('type=recovery') ||
        search.includes('type=recovery') ||
        hash.includes('error=') ||
        search.includes('error=')
      ) {
        if (hash.includes('type=recovery') || search.includes('type=recovery')) {
          setPasswordRecovery(true)
        }
      }
    }

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return
      const user = sessionData.session?.user
      if (user?.is_anonymous) {
        supabase.auth.signOut()
        setAuthUser(null)
      } else {
        setAuthUser(user || null)
      }
      setAuthReady(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      setAuthUser(session?.user?.is_anonymous ? null : session?.user || null)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut()
      setAuthUser(null)
    }
  }, [])

  return {
    authReady,
    authUser,
    setAuthUser,
    passwordRecovery,
    setPasswordRecovery,
    signOut,
    isCloudActive: isSupabaseConfigured && Boolean(authUser && authUser.id !== 'local-user'),
  }
}
