// Logique pure : traduit les erreurs Supabase en messages clairs pour l'employé.
// Facile à tester à l'étape CI.
export function authErrorMessage(error) {
  const message = (error?.message ?? '').toLowerCase()

  if (message.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (message.includes('email not confirmed')) return "Ton compte n'est pas encore activé. Contacte l'administrateur."
  if (message.includes('rate limit') || error?.status === 429) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (message.includes('failed to fetch') || message.includes('network')) return 'Connexion impossible. Vérifie ton réseau.'

  return 'Connexion impossible. Réessaie ou contacte l\'administrateur.'
}
