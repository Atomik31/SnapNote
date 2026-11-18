import { blobToDataUrl } from './image.js'

// Envoie la photo (déjà réduite) à NOTRE backend (/api/extract), jamais directement à l'IA.
// Renvoie { data, warnings } ou lève une Error dont le message est affichable tel quel.
export async function extractFromBlob(blob, accessToken) {
  const image = await blobToDataUrl(blob)

  let response
  try {
    response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ image }),
    })
  } catch {
    throw new Error('Connexion impossible.')
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'La lecture automatique a échoué.')
  return body
}
