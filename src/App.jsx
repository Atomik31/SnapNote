import { useEffect, useRef, useState } from 'react'
import Hero from './components/Hero.jsx'
import Login from './components/Login.jsx'
import ReceiptForm from './components/ReceiptForm.jsx'
import ReceiptList from './components/ReceiptList.jsx'
import Topbar from './components/Topbar.jsx'
import { createReceipt, deleteReceipt, listReceipts } from './lib/receipts.js'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'
import { useSendStatus } from './lib/useSendStatus.js'
import { useSession } from './lib/useSession.js'

export default function App() {
  const { session, loading } = useSession()

  // 1. Variables d'environnement manquantes : on l'explique au lieu d'afficher une page blanche.
  if (!isSupabaseConfigured) {
    return (
      <main className="notice">
        <h1>Configuration manquante</h1>
        <p>
          Ajoutez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> dans le fichier <code>.env</code>, puis relancez{' '}
          <code>npm run dev</code>.
        </p>
      </main>
    )
  }

  // 2. On vérifie s'il existe déjà une session (évite un flash de la page de connexion).
  if (loading) return <p className="notice muted">Chargement…</p>

  // 3. Pas connecté : page de connexion. Connecté : l'application.
  if (!session) return <Login />
  return <Notes user={session.user} accessToken={session.access_token} />
}

// Les notes vivent dans Supabase, rattachées à l'employé connecté.
function Notes({ user, accessToken }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(null) // catégorie sélectionnée dans la carte du total (null = toutes)
  const toggleFilter = (name) => setFilter((current) => (current === name ? null : name))
  const [sheetOpen, setSheetOpen] = useState(false) // mobile : feuille « Nouvelle note »
  const formRef = useRef(null)

  // Ordinateur : « Scanner » ouvre d'abord le panneau (on y choisit la photo ou on saisit à la main).
  // Téléphone : « Scanner » ouvre directement l'appareil photo.
  function handleScan() {
    if (window.matchMedia('(min-width: 900px)').matches) setSheetOpen(true)
    else formRef.current?.pickPhoto()
  }

  // La touche Échap ferme le panneau.
  useEffect(() => {
    if (!sheetOpen) return
    const onKey = (event) => event.key === 'Escape' && setSheetOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  // Les notes « Envoi en cours » passent à « Envoyée » toutes seules, sans recharger la page.
  useSendStatus(user.id, receipts, setReceipts)

  // Au chargement : on lit les notes de l'employé dans Supabase (filtrées par la RLS).
  useEffect(() => {
    listReceipts()
      .then(setReceipts)
      .catch(() => setError('Impossible de charger vos notes. Vérifiez que la table a bien été créée (supabase/001_receipts.sql).'))
      .finally(() => setLoading(false))
  }, [])

  // Si l'enregistrement échoue, l'erreur remonte au formulaire, qui garde la saisie.
  async function addReceipt({ imageBlob, ...fields }) {
    const created = await createReceipt(fields, imageBlob, user.id)
    setReceipts((current) => [created, ...current])
    setSheetOpen(false)
  }

  async function removeReceipt(receipt) {
    try {
      await deleteReceipt(receipt)
      setReceipts((current) => current.filter((r) => r.id !== receipt.id))
    } catch {
      setError('Suppression impossible : seules les notes non envoyées peuvent être supprimées.')
    }
  }

  return (
    <>
      <Topbar user={user} onSignOut={() => supabase.auth.signOut()} />
      <main className="board">
        <div className="col-main">
          <Hero receipts={receipts} onScan={handleScan} activeCategory={filter} onFilter={toggleFilter} />
          {error && (
            <p className="alert" role="alert">
              {error}
            </p>
          )}
          <ReceiptList category={filter} onClearFilter={() => setFilter(null)} receipts={receipts} loading={loading} onRemove={removeReceipt} />
        </div>
        <ReceiptForm
          ref={formRef}
          open={sheetOpen}
          onFilePicked={() => setSheetOpen(true)}
          onClose={() => setSheetOpen(false)}
          onAdd={addReceipt}
          accessToken={accessToken}
        />
      </main>
      {sheetOpen && <div className="scrim" onClick={() => setSheetOpen(false)} aria-hidden="true" />}
    </>
  )
}
