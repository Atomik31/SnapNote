import { verifyUser } from './_lib/auth.js'
import { extractReceipt } from './_lib/extract.js'

// POST /api/extract — fonction serverless (Vercel). C'est notre BACKEND.
// Le navigateur envoie une photo ; ici, et seulement ici, on utilise la clé secrète de l'IA.
const MAX_IMAGE_CHARS = 4_000_000 // Vercel limite le corps d'une requête à ~4,5 Mo
const IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' })

  // 1. Qui es-tu ? Sans session valide, on refuse (sinon n'importe qui pourrait consommer notre clé IA).
  const user = await verifyUser(req.headers.authorization)
  if (!user) return res.status(401).json({ error: 'Session expirée : reconnecte-toi.' })

  // 2. L'image est-elle acceptable ? On ne fait jamais confiance à ce que le client envoie.
  const image = req.body?.image
  if (typeof image !== 'string' || image.length > MAX_IMAGE_CHARS || !IMAGE_PATTERN.test(image)) {
    return res.status(400).json({ error: 'Image invalide (formats acceptés : JPEG, PNG, WebP).' })
  }

  // 3. Lecture par l'IA. Les détails techniques restent dans les logs serveur, pas chez l'utilisateur.
  try {
    const result = await extractReceipt(image)
    return res.status(200).json(result)
  } catch (error) {
    console.error('[api/extract]', error.message)
    return res.status(502).json({ error: 'La lecture automatique a échoué.' })
  }
}
