// Logique pure (sans réseau) : on ne fait JAMAIS confiance à la réponse brute d'une IA.
// On la lit, on la nettoie, on la valide, puis on signale ce qui semble douteux.

export const CATEGORIES = ['Restaurant', 'Transport', 'Carburant', 'Fournitures', 'Hébergement', 'Autre']

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Le modèle renvoie normalement du JSON pur, mais il peut l'entourer de texte ou de ```json.
export function parseModelJson(text) {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function toAmount(value) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? round2(n) : null
}

function toDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : null
}

// Retourne { data, warnings } : data est toujours bien formé, warnings explique les doutes.
export function sanitizeExtraction(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}

  const merchant = typeof source.merchant === 'string' && source.merchant.trim() ? source.merchant.trim().slice(0, 120) : null
  const data = {
    merchant,
    date: toDate(source.date),
    amount_ht: toAmount(source.amount_ht),
    amount_vat: toAmount(source.amount_vat),
    amount_ttc: toAmount(source.amount_ttc),
    category: CATEGORIES.includes(source.category) ? source.category : 'Autre',
  }

  const warnings = []
  if (!data.merchant) warnings.push("L'enseigne n'a pas été lue.")
  if (!data.date) warnings.push("La date n'a pas été lue.")
  if (data.amount_ttc === null) warnings.push("Le montant TTC n'a pas été lu : saisis-le à la main.")
  if (data.amount_ht !== null && data.amount_ttc !== null && data.amount_ht > data.amount_ttc) {
    warnings.push('Le montant HT est supérieur au TTC : vérifie les montants.')
  }
  const { amount_ht: ht, amount_vat: vat, amount_ttc: ttc } = data
  if (ht !== null && vat !== null && ttc !== null && Math.abs(ht + vat - ttc) > 0.02) {
    warnings.push('HT + TVA ne donne pas le TTC : vérifie les montants.')
  }

  return { data, warnings }
}
