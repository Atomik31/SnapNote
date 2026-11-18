import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { computeVat, formatEuro, parseAmount, toInput } from '../lib/amounts.js'
import { CATEGORIES, CATEGORY_NAMES } from '../lib/categories.js'
import { resizeImage } from '../lib/image.js'
import { extractFromBlob } from '../lib/receiptApi.js'
import Icon from './Icons.jsx'
import Select from './Select.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const IDLE = { status: 'idle', message: '', warnings: [] }
// Étapes affichées pendant la lecture : rassure l'utilisateur sans prétendre mesurer l'avancement réel.
const SCAN_STEPS = ['Analyse de l’image…', 'Lecture du texte…', 'Repérage des montants…', 'Vérification…']

function ScanStatus() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 1500)
    return () => clearInterval(id)
  }, [])
  return (
    <p className="ai-note scan-status" role="status">
      <i />
      <span key={step} className="scan-step">
        {SCAN_STEPS[step]}
      </span>
      <b className="scan-bar" aria-hidden="true" />
    </p>
  )
}

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.name, label: c.name, icon: c.icon, tone: c.tone }))

// Panneau « Nouvelle note » : fixe sur ordinateur, feuille qui remonte du bas sur mobile.
const ReceiptForm = forwardRef(function ReceiptForm({ onAdd, onFilePicked, onClose, accessToken, open }, ref) {
  const inputRef = useRef(null)
  const requestId = useRef(0) // ignore la réponse d'une ancienne photo si on en prend une autre

  const [file, setFile] = useState(null)
  const [imageBlob, setImageBlob] = useState(null) // la photo réduite : lue par l'IA puis stockée
  const [preview, setPreview] = useState(null)
  const [merchant, setMerchant] = useState('')
  const [date, setDate] = useState(today())
  const [ht, setHt] = useState('')
  const [ttc, setTtc] = useState('')
  const [category, setCategory] = useState(CATEGORY_NAMES[0])

  const [ai, setAi] = useState(IDLE) // 'idle' | 'loading' | 'done' | 'error'
  const [readFields, setReadFields] = useState(new Set()) // champs remplis par l'IA et pas encore modifiés
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Le bouton « Scanner » de la page ouvre l'appareil photo via cette méthode.
  useImperativeHandle(ref, () => ({ pickPhoto: () => inputRef.current?.click() }))

  // Aperçu de la photo (URL locale temporaire, libérée quand elle change).
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const htValue = parseAmount(ht)
  const ttcValue = parseAmount(ttc)
  const vat = computeVat(htValue, ttcValue)

  // Un champ que l'employé corrige n'est plus « lu automatiquement ».
  function touch(name) {
    setReadFields((current) => {
      if (!current.has(name)) return current
      const next = new Set(current)
      next.delete(name)
      return next
    })
  }
  function edit(name, setter) {
    return (event) => {
      setter(event.target.value)
      touch(name)
    }
  }

  async function handleFile(event) {
    const picked = event.target.files[0] ?? null
    setFile(picked)
    setImageBlob(null)
    setReadFields(new Set())
    setSaveError('')
    const id = ++requestId.current
    if (!picked) return setAi(IDLE)

    onFilePicked?.()
    setAi({ status: 'loading', message: '', warnings: [] })
    try {
      const blob = await resizeImage(picked)
      if (id !== requestId.current) return
      setImageBlob(blob)

      const { data, warnings } = await extractFromBlob(blob, accessToken)
      if (id !== requestId.current) return

      // On pré-remplit uniquement ce que l'IA a lu : l'employé garde la main sur tous les champs.
      const filled = new Set()
      if (data.merchant) (setMerchant(data.merchant), filled.add('merchant'))
      if (data.date) (setDate(data.date), filled.add('date'))
      if (data.amount_ht !== null) (setHt(toInput(data.amount_ht)), filled.add('ht'))
      if (data.amount_ttc !== null) (setTtc(toInput(data.amount_ttc)), filled.add('ttc'))
      setCategory(data.category)
      filled.add('category')
      setReadFields(filled)
      setAi({ status: 'done', message: '', warnings })
    } catch (error) {
      if (id !== requestId.current) return
      setAi({ status: 'error', message: error.message, warnings: [] })
    }
  }

  function reset() {
    requestId.current++
    if (inputRef.current) inputRef.current.value = '' // permet de reprendre la même photo
    setFile(null)
    setImageBlob(null)
    setMerchant('')
    setDate(today())
    setHt('')
    setTtc('')
    setCategory(CATEGORY_NAMES[0])
    setReadFields(new Set())
    setAi(IDLE)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!merchant.trim() || !date || ttcValue === null) return

    setSaving(true)
    setSaveError('')
    try {
      await onAdd({
        merchant: merchant.trim(),
        receipt_date: date,
        amount_ht: htValue,
        amount_vat: vat,
        amount_ttc: ttcValue,
        category,
        source: readFields.size > 0 || ai.status === 'done' ? 'ai' : 'manual',
        imageBlob,
      })
      reset()
    } catch {
      setSaveError('Enregistrement impossible. Vérifiez votre connexion et réessayez.')
    } finally {
      setSaving(false)
    }
  }

  const readClass = (name) => `input${readFields.has(name) ? ' read' : ''}`

  return (
    <form className={`panel${open ? ' open' : ''}`} onSubmit={handleSubmit} aria-label="Nouvelle note">
      <div className="panel-grab" aria-hidden="true" />
      <div className="panel-head">
        <h2>Nouvelle note</h2>
        <button type="button" className="circle sm panel-close" onClick={onClose} aria-label="Fermer">
          <Icon name="x" />
        </button>
      </div>

      {/* capture="environment" ouvre l'appareil photo arrière sur mobile (HTTPS requis). */}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />

      <div className={`vf${ai.status === 'loading' ? ' scanning' : ''}${ai.status === 'done' ? ' done' : ''}`}>
        {preview ? (
          <>
            <img src={preview} alt="Aperçu du justificatif" />
            <button type="button" className="vf-retake" onClick={() => inputRef.current?.click()}>
              Reprendre
            </button>
          </>
        ) : (
          <button type="button" className="vf-empty" onClick={() => inputRef.current?.click()}>
            <Icon name="camera" />
            <span>Photographier le justificatif</span>
            <small>ou choisir une image</small>
          </button>
        )}
        <i className="cn a" />
        <i className="cn b" />
        <i className="cn c" />
        <i className="cn d" />
        <div className="scangrid" aria-hidden="true" />
        <div className="scanbeam" aria-hidden="true" />
        {ai.status === 'done' && (
          <span className="vf-ok" aria-hidden="true">
            <Icon name="check-circle" />
          </span>
        )}
      </div>

      {ai.status === 'loading' && <ScanStatus />}
      {ai.status === 'done' && (
        <div className="ai-note" role="status">
          <p>
            <i /> {ai.warnings.length ? 'Lu par l’IA, à vérifier :' : 'Lu par l’IA. Vérifiez les champs avant d’enregistrer.'}
          </p>
          {ai.warnings.length > 0 && (
            <ul>
              {ai.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {ai.status === 'error' && (
        <p className="ai-note warn" role="alert">
          {ai.message} Saisissez les informations à la main.
        </p>
      )}

      <div className="fields">
        <label className="field">
          <span>Enseigne</span>
          <input className={readClass('merchant')} value={merchant} onChange={edit('merchant', setMerchant)} placeholder="Brasserie du Coin" required />
        </label>

        <div className="two">
          <label className="field">
            <span>Date</span>
            <input className={`${readClass('date')} num`} type="date" value={date} onChange={edit('date', setDate)} required />
          </label>
          <div className="field">
            <span id="category-label">Catégorie</span>
            <Select
              labelId="category-label"
              className={readFields.has('category') ? 'read' : ''}
              value={category}
              onChange={(value) => {
                setCategory(value)
                touch('category')
              }}
              options={CATEGORY_OPTIONS}
            />
          </div>
        </div>

        <div className="two">
          <label className="field">
            <span>Montant HT</span>
            <input className={`${readClass('ht')} num`} inputMode="decimal" value={ht} onChange={edit('ht', setHt)} placeholder="20,00" />
          </label>
          <label className="field">
            <span>Montant TTC</span>
            <input className={`${readClass('ttc')} num`} inputMode="decimal" value={ttc} onChange={edit('ttc', setTtc)} placeholder="24,00" required />
          </label>
        </div>

        {vat !== null && (
          <div className="sumline">
            <span>TVA calculée</span>
            <b className="num">{formatEuro(vat)}</b>
          </div>
        )}

        {saveError && (
          <p className="alert" role="alert">
            {saveError}
          </p>
        )}

        <button type="submit" className="btn btn-orange btn-block" disabled={ai.status === 'loading' || saving}>
          <Icon name="check" />
          {saving ? 'Enregistrement…' : 'Enregistrer et envoyer'}
        </button>
      </div>
    </form>
  )
})

export default ReceiptForm
