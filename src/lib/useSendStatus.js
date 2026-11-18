import { useEffect, useState } from 'react'
import { fetchStatuses, subscribeToReceiptUpdates } from './receipts.js'
import { sendState } from './status.js'

const POLL_MS = 4000

// Met à jour les notes « en cours d'envoi » SANS recharger la page :
//  1. Supabase Realtime pousse le changement dès que n8n passe la note à « envoyée » ;
//  2. un contrôle toutes les 4 secondes sert de filet de sécurité tant qu'une note est en cours d'envoi
//     (connexion temps réel coupée, onglet endormi…). Il s'arrête tout seul dès qu'il n'y a plus rien à suivre.
export function useSendStatus(userId, receipts, setReceipts) {
  const [now, setNow] = useState(() => Date.now())

  // Applique de nouveaux statuts aux notes déjà affichées.
  const apply = (rows) =>
    setReceipts((current) =>
      current.map((receipt) => {
        const row = rows.find((r) => r.id === receipt.id)
        return row && row.status !== receipt.status ? { ...receipt, status: row.status, sent_at: row.sent_at } : receipt
      }),
    )

  useEffect(() => subscribeToReceiptUpdates(userId, (row) => apply([row])), [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendingKey = receipts
    .filter((r) => sendState(r, now) === 'sending')
    .map((r) => r.id)
    .join(',')

  useEffect(() => {
    if (!sendingKey) return
    const ids = sendingKey.split(',')
    const timer = setInterval(async () => {
      setNow(Date.now()) // fait aussi basculer une note trop ancienne vers « non envoyée »
      try {
        apply(await fetchStatuses(ids))
      } catch {
        /* on réessaie au prochain passage */
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [sendingKey]) // eslint-disable-line react-hooks/exhaustive-deps
}
