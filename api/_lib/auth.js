// Vérifie qu'une requête vient bien d'un employé connecté.
// Le navigateur envoie son jeton de session : « Authorization: Bearer <jeton> ».
// On demande à Supabase si ce jeton est valide : il renvoie l'utilisateur, ou une erreur.
export async function verifyUser(authorization, env = process.env, fetchImpl = fetch) {
  const token = typeof authorization === 'string' && authorization.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) return null

  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null

  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, '')}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    const user = await response.json()
    return user?.id ? user : null
  } catch {
    return null
  }
}
