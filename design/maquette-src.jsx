// Source de la maquette : on fait rendre les VRAIS composants de l'app en HTML statique,
// pour que la maquette soit toujours fidèle au code. Régénérer avec : node design/build-maquette.mjs
import { renderToStaticMarkup } from 'react-dom/server'
import Hero from '../src/components/Hero.jsx'
import ReceiptList from '../src/components/ReceiptList.jsx'
import ReceiptViewer from '../src/components/ReceiptViewer.jsx'
import Topbar from '../src/components/Topbar.jsx'
import Login from '../src/components/Login.jsx'
import Splash from '../src/components/Splash.jsx'
import Icon from '../src/components/Icons.jsx'
import Select from '../src/components/Select.jsx'
import { CATEGORIES } from '../src/lib/categories.js'

const noop = () => {}
const user = { email: 'camille.martin@entreprise.fr', user_metadata: { full_name: 'Camille Martin' } }
const TICKET = '../../public/samples/ticket-restaurant.png'
const now = new Date().toISOString()
const who = 'camille.martin@entreprise.fr'

const receipts = [
  { id: '1', merchant: 'Brasserie Le Petit Zinc', receipt_date: '2026-11-12', category: 'Restaurant', amount_ttc: 30, status: 'sent', image_url: TICKET, user_email: who, created_at: '2026-11-12T13:20:00Z', source: 'ai' },
  { id: '2', merchant: 'Station Total', receipt_date: '2026-11-10', category: 'Carburant', amount_ttc: 88, status: 'sent', image_url: TICKET, user_email: who, created_at: '2026-11-10T08:05:00Z', source: 'ai' },
  { id: '3', merchant: 'Papeterie Durand', receipt_date: '2026-11-09', category: 'Fournitures', amount_ttc: 42.9, status: 'draft', user_email: who, created_at: now, source: 'ai' },
  { id: '4', merchant: 'SNCF Voyageurs', receipt_date: '2026-11-04', category: 'Transport', amount_ttc: 54, status: 'draft', user_email: who, created_at: '2026-11-04T07:40:00Z' },
]

const OPTIONS = CATEGORIES.map((c) => ({ value: c.name, label: c.name, icon: c.icon, tone: c.tone }))

// Panneau « Nouvelle note » : même structure que ReceiptForm.jsx, avec un état figé (idle | scanning | done).
function Panel({ state }) {
  const filled = state === 'done'
  const read = filled ? ' read' : ''
  return (
    <form className="panel open" aria-label="Nouvelle note">
      <div className="panel-grab" aria-hidden="true" />
      <div className="panel-head">
        <h2>Nouvelle note</h2>
        <button type="button" className="circle sm panel-close" aria-label="Fermer">
          <Icon name="x" />
        </button>
      </div>
      <div className={`vf${state === 'scanning' ? ' scanning' : ''}${filled ? ' done' : ''}`}>
        <img src={TICKET} alt="Aperçu du justificatif" />
        <button type="button" className="vf-retake">Reprendre</button>
        <i className="cn a" />
        <i className="cn b" />
        <i className="cn c" />
        <i className="cn d" />
        <div className="scangrid" />
        <div className="scanbeam" style={{ animationDelay: '-0.9s' }} />
      </div>
      {state === 'scanning' && (
        <p className="ai-note scan-status" role="status">
          <i />
          <span className="scan-step">Lecture du texte…</span>
          <b className="scan-bar" />
        </p>
      )}
      {filled && (
        <div className="ai-note" role="status">
          <p>
            <i /> Lu par l’IA. Vérifiez les champs avant d’enregistrer.
          </p>
        </div>
      )}
      <div className="fields">
        <label className="field">
          <span>Enseigne</span>
          <input className={`input${read}`} defaultValue={filled ? 'Brasserie Le Petit Zinc' : ''} placeholder="Brasserie du Coin" />
        </label>
        <div className="two">
          <label className="field">
            <span>Date</span>
            <input className={`input${read} num`} type="date" defaultValue="2026-11-12" />
          </label>
          <div className="field">
            <span>Catégorie</span>
            <Select labelId="x" className={filled ? 'read' : ''} value="Restaurant" onChange={noop} options={OPTIONS} />
          </div>
        </div>
        <div className="two">
          <label className="field">
            <span>Montant HT</span>
            <input className={`input${read} num`} defaultValue={filled ? '27,27' : ''} placeholder="20,00" />
          </label>
          <label className="field">
            <span>Montant TTC</span>
            <input className={`input${read} num`} defaultValue={filled ? '30,00' : ''} placeholder="24,00" />
          </label>
        </div>
        {filled && (
          <div className="sumline">
            <span>TVA calculée</span>
            <b className="num">2,73 €</b>
          </div>
        )}
        <button type="button" className="btn btn-orange btn-block">
          <Icon name="check" />
          Enregistrer et envoyer
        </button>
      </div>
    </form>
  )
}

function Board({ filter = null, panel = null, scrim = false, extra = null }) {
  const list = filter ? receipts.filter((r) => r.category === filter) : receipts
  return (
    <>
      <Topbar user={user} onSignOut={noop} />
      <main className="board">
        <div className="col-main">
          <Hero receipts={receipts} onScan={noop} activeCategory={filter} onFilter={noop} />
          <ReceiptList receipts={list} category={filter} onClearFilter={noop} onRemove={noop} />
        </div>
        {panel && <Panel state={panel} />}
      </main>
      {scrim && <div className="scrim" aria-hidden="true" />}
      {extra}
    </>
  )
}

export const screens = {
  accueil: () => <Board />,
  filtre: () => <Board filter="Carburant" />,
  scan: () => <Board panel="scanning" scrim />,
  lecture: () => <Board panel="done" scrim />,
  justificatif: () => <Board extra={<ReceiptViewer receipt={receipts[0]} onClose={noop} />} />,
  connexion: () => <Login />,
  intro: () => <Splash />,
}

export const render = (name) => renderToStaticMarkup(screens[name]())

// Planche de composants : les vrais composants, à l'état de repos, avec leurs variantes.
function Specimen() {
  return (
    <div className="mq-spec">
      <div className="mq-box">
        <h4>Boutons</h4>
        <div className="mq-line">
          <button type="button" className="btn btn-orange"><Icon name="check" />Enregistrer et envoyer</button>
          <button type="button" className="btn btn-white">Se connecter</button>
          <button type="button" className="circle sm" aria-label="Fermer"><Icon name="x" /></button>
          <button type="button" className="circle lg white" aria-label="Scanner"><Icon name="camera" /></button>
        </div>
      </div>
      <div className="mq-box">
        <h4>Champs</h4>
        <div className="mq-col">
          <label className="field"><span>Enseigne</span><input className="input" placeholder="Brasserie du Coin" readOnly /></label>
          <label className="field"><span>Montant TTC — lu par l’IA</span><input className="input read num" defaultValue="30,00" readOnly /></label>
          <div className="field"><span>Catégorie</span><Select labelId="s1" value="Carburant" onChange={noop} options={OPTIONS} /></div>
        </div>
      </div>
      <div className="mq-box">
        <h4>Pastilles de catégories (filtre)</h4>
        <div className="stack filtering" style={{ marginBottom: 14 }}>
          {CATEGORIES.map((c, i) => (
            <span key={c.name} className={`circle tone-${c.tone}${i === 2 ? ' active' : ''}`}><Icon name={c.icon} /></span>
          ))}
        </div>
        <span className="filter-chip" style={{ margin: 0 }}>Carburant<Icon name="x" /></span>
      </div>
      <div className="mq-box">
        <h4>Messages</h4>
        <div className="mq-col">
          <p className="ai-note scan-status"><i /><span className="scan-step">Lecture du texte…</span><b className="scan-bar" /></p>
          <div className="ai-note"><p><i /> Lu par l’IA. Vérifiez les champs avant d’enregistrer.</p></div>
          <p className="ai-note warn">Lecture impossible. Saisissez les informations à la main.</p>
        </div>
      </div>
      <div className="mq-box wide">
        <h4>Notes et statuts</h4>
        <ReceiptList receipts={receipts} onRemove={noop} />
      </div>
    </div>
  )
}
export const renderSpecimen = () => renderToStaticMarkup(<Specimen />)
export const renderIcons = (names) => renderToStaticMarkup(<>{names.map((n) => <figure key={n}><Icon name={n} /><figcaption>{n}</figcaption></figure>)}</>)
export const renderHero = () => renderToStaticMarkup(<Hero receipts={receipts} onScan={noop} activeCategory="Carburant" onFilter={noop} />)
