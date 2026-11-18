import { supabase } from './supabase.js'

// Couche d'accès aux données : tout ce qui parle à Supabase (table + photos) est ici.
// Les composants React n'appellent jamais Supabase directement.

const BUCKET = 'receipts'
const COLUMNS =
  'id, user_email, merchant, receipt_date, amount_ht, amount_vat, amount_ttc, category, image_path, source, status, created_at'

const toNumber = (value) => (value === null || value === undefined ? null : Number(value))

function normalize(row) {
  return {
    ...row,
    amount_ht: toNumber(row.amount_ht),
    amount_vat: toNumber(row.amount_vat),
    amount_ttc: toNumber(row.amount_ttc),
  }
}

// Le bucket est privé : pour AFFICHER une photo, on demande des URLs signées temporaires (1 h).
async function attachImageUrls(rows) {
  const paths = rows.map((r) => r.image_path).filter(Boolean)
  if (paths.length === 0) return rows.map((r) => ({ ...r, image_url: null }))

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]))
  return rows.map((r) => ({ ...r, image_url: urls.get(r.image_path) ?? null }))
}

// La RLS filtre côté base : on ne reçoit que les notes de l'employé connecté.
export async function listReceipts() {
  const { data, error } = await supabase
    .from('receipts')
    .select(COLUMNS)
    .order('receipt_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return attachImageUrls(data.map(normalize))
}

// 1) on envoie la photo, 2) on enregistre la ligne. Si l'étape 2 échoue, on retire la photo orpheline.
// On n'envoie JAMAIS user_id ni user_email : c'est la base qui les impose (traçabilité).
export async function createReceipt(fields, imageBlob, userId) {
  const id = crypto.randomUUID()
  let imagePath = null

  if (imageBlob) {
    imagePath = `${userId}/${id}.jpg` // le dossier = l'identifiant de l'employé (voir les policies Storage)
    const { error } = await supabase.storage.from(BUCKET).upload(imagePath, imageBlob, { contentType: 'image/jpeg' })
    if (error) throw error
  }

  const { data, error } = await supabase
    .from('receipts')
    .insert({ id, ...fields, image_path: imagePath })
    .select(COLUMNS)
    .single()

  if (error) {
    if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath])
    throw error
  }
  const [receipt] = await attachImageUrls([normalize(data)])
  return receipt
}

export async function deleteReceipt(receipt) {
  const { data, error } = await supabase.from('receipts').delete().eq('id', receipt.id).select('id')
  if (error) throw error
  // La RLS ne signale pas d'erreur quand elle bloque : elle supprime simplement 0 ligne (ex. note déjà envoyée).
  if (data.length === 0) throw new Error('Suppression refusée.')
  if (receipt.image_path) await supabase.storage.from(BUCKET).remove([receipt.image_path])
}

// Écoute en direct les changements de statut des notes de l'employé (Supabase Realtime).
// La RLS s'applique aussi ici : on ne reçoit que SES notes. Retourne une fonction pour se désabonner.
export function subscribeToReceiptUpdates(userId, onUpdate) {
  const channel = supabase
    .channel(`receipts-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'receipts', filter: `user_id=eq.${userId}` }, (payload) => onUpdate(payload.new))
    .subscribe()
  return () => supabase.removeChannel(channel)
}

// Relit uniquement le statut de quelques notes (contrôle de secours, très léger).
export async function fetchStatuses(ids) {
  const { data, error } = await supabase.from('receipts').select('id, status, sent_at').in('id', ids)
  if (error) throw error
  return data
}
