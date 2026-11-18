import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

// Suit la session de l'employé connecté.
// - loading : true tant qu'on ne sait pas encore s'il y a une session
// - session : l'objet session Supabase (session.user.email, session.user.id…) ou null
export function useSession() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return

    // Session déjà présente (stockée par Supabase dans le navigateur) ?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Réagit aux connexions et déconnexions.
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
