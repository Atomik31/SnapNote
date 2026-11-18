// Une photo de smartphone pèse plusieurs Mo : trop lourd à stocker, à envoyer, et coûteux pour l'IA.
// On la réduit dans le navigateur (≈ 200-400 Ko, largement lisible). La même image réduite sert
// à la lecture par l'IA ET au stockage dans Supabase.

export const MAX_SIDE = 1600

// Logique pure : dimensions réduites en gardant les proportions (jamais d'agrandissement).
export function fitSize(width, height, maxSide = MAX_SIDE) {
  const ratio = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

// Fichier image → Blob JPEG réduit.
export async function resizeImage(file) {
  const bitmap = await createImageBitmap(file) // respecte l'orientation EXIF des photos de téléphone
  const { width, height } = fitSize(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image illisible.'))), 'image/jpeg', 0.85)
  })
}

// Blob → data URL (format attendu par l'API de l'IA).
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Image illisible.'))
    reader.readAsDataURL(blob)
  })
}
