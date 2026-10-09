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
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
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
