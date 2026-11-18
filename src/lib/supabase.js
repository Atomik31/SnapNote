import { createClient } from '@supabase/supabase-js'

// Ces deux variables sont PUBLIQUES (préfixe VITE_ : Vite les injecte dans le navigateur).
// La clé "publishable" (ex-"anon") est faite pour être exposée : c'est la RLS qui protège les données.
// Ne jamais mettre ici la clé "service_role" ou "secret".
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

// Si le .env est incomplet, on ne plante pas : l'app affichera un message explicite.
export const supabase = isSupabaseConfigured ? createClient(url, key) : null
