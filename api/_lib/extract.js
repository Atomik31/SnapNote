import { parseModelJson, sanitizeExtraction } from './sanitize.js'

// Le « prompt système » est le cahier des charges donné à l'IA : on lui impose le format de sortie.
export const SYSTEM_PROMPT = [
  'Tu lis des tickets de caisse et des factures françaises.',
  'Réponds UNIQUEMENT avec un objet JSON de cette forme :',
  '{"merchant": string|null, "date": "YYYY-MM-DD"|null, "amount_ht": number|null,',
  '"amount_vat": number|null, "amount_ttc": number|null,',
  '"category": "Restaurant"|"Transport"|"Carburant"|"Fournitures"|"Hébergement"|"Autre"}.',
  'Carburant : station-service (essence, gazole, GPL, recharge électrique). Transport : train, taxi, avion, péage, parking.',
  'Montants en euros, nombres décimaux avec un point.',
  "Si une valeur est illisible ou absente, mets null. N'invente rien.",
].join(' ')

// Appelle le modèle de vision (API compatible OpenAI) et renvoie { data, warnings }.
// Exécuté UNIQUEMENT côté serveur : la clé n'arrive jamais dans le navigateur.
export async function extractReceipt(imageDataUrl, env = process.env, fetchImpl = fetch) {
  const apiKey = env.JEDHA_AI_API_KEY
  const rawBase = env.JEDHA_AI_BASE_URL
  if (!apiKey || !rawBase) throw new Error('IA non configurée côté serveur')

  const baseUrl = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '')
  const model = env.JEDHA_AI_MODEL || 'openai/gpt-4.1-mini'

  const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extrais les informations de ce justificatif.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) throw new Error(`Erreur du modèle IA (${response.status})`)

  const payload = await response.json()
  const parsed = parseModelJson(payload.choices?.[0]?.message?.content)
  if (!parsed) throw new Error('Réponse du modèle illisible')

  return sanitizeExtraction(parsed)
}
