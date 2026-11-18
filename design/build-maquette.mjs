// Génère la maquette HTML (design/maquette/) à partir des vrais composants et de src/styles.css.
// Usage : node design/build-maquette.mjs   (puis ouvrir design/maquette/index.html)
import { build } from 'esbuild'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'design/maquette')
mkdirSync(out, { recursive: true })

// Le composant Login importe Supabase : on le remplace par une coquille vide, sans réseau.
const stubSupabase = {
  name: 'stub-supabase',
  setup(b) {
    b.onResolve({ filter: /lib\/supabase\.js$/ }, () => ({ path: 'supabase-stub', namespace: 'stub' }))
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = {}; export const isSupabaseConfigured = false', loader: 'js' }))
  },
}
// Le rendu se fait dans Node : on simule le minimum de `window` dont certains composants ont besoin.
globalThis.window = { matchMedia: () => ({ matches: false }) }
const bundle = resolve(out, '.bundle.mjs')
await build({
  entryPoints: [resolve(root, 'design/maquette-src.jsx')],
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/server'], plugins: [stubSupabase], logLevel: 'error',
  nodePaths: [resolve(root, 'node_modules')],
})
const { render, renderSpecimen, renderIcons, renderHero } = await import(pathToFileURL(bundle).href + '?t=' + Date.now())

// Feuille de style de l'app, avec les chemins d'images/polices adaptés à ce dossier.
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8').replaceAll("url('/", "url('../../public/")
const pages = ['accueil', 'filtre', 'scan', 'lecture', 'justificatif', 'connexion', 'intro']
const screenHtml = Object.fromEntries(pages.map((name) => [name, render(name)]))

// ---------- Page d'ensemble : tokens, composants, mouvement et tous les écrans ----------
const root_vars = [...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()])
const val = (n) => root_vars.find(([k]) => k === n)?.[1]
const swatch = (name, usage) => `<div class="mq-sw"><i style="background:var(${name})"></i><b>${name}</b><code>${val(name)}</code><span>${usage}</span></div>`
const colors = [
  ['--bg', 'Fond de page'], ['--sheet', 'Feuilles, cartes'], ['--sheet-2', 'Champs, tuiles'], ['--sheet-3', 'Boutons ronds'], ['--line', 'Bordures fines'],
  ['--text', 'Texte principal'], ['--muted', 'Texte secondaire'], ['--dim', 'Texte discret'],
  ['--orange', 'Actions et lecture IA'], ['--orange-2', 'Bas du dégradé d’action'], ['--orange-soft', 'Texte orange'],
  ['--ok', 'Coche et « Envoyée » uniquement'], ['--danger', 'Erreurs, « Non envoyée »'],
  ['--c-resto', 'Restaurant'], ['--c-trans', 'Transport'], ['--c-fuel', 'Carburant'], ['--c-fourn', 'Fournitures'], ['--c-heb', 'Hébergement'], ['--c-other', 'Autre'],
].map(([n, u]) => swatch(n, u)).join('')
const iconNames = [...readFileSync(resolve(root, 'src/components/Icons.jsx'), 'utf8').matchAll(/^  '?([a-z-]+)'?: /gm)].map((m) => m[1])
const mobile = [
  ['intro', 'Intro', 'Premier chargement : logo, onde orange, barre de chargement.'],
  ['connexion', 'Connexion', 'Photo en fond, carte de connexion, pas d’inscription.'],
  ['accueil', 'Accueil', 'Total du mois, pastilles de catégories, notes et statuts.'],
  ['filtre', 'Filtre', 'Un clic sur une pastille ne garde que cette catégorie.'],
  ['scan', 'Scan en cours', 'Faisceau, quadrillage, coins orange, étapes de lecture.'],
  ['lecture', 'Lu par l’IA', 'Coins verrouillés, champs préremplis cerclés d’orange.'],
  ['justificatif', 'Justificatif', 'Fenêtre sur la même page : photo, montant, traçabilité.'],
]
const desktop = [['connexion', 'Connexion'], ['accueil', 'Accueil'], ['lecture', 'Panneau « Nouvelle note »'], ['justificatif', 'Justificatif']]
const phones = mobile.map(([n, t, d]) => `<figure><div class="phone"><iframe data-screen="${n}" title="${t}" loading="lazy"></iframe></div><figcaption><b>${t}</b><span>${d}</span></figcaption></figure>`).join('')
const desks = desktop.map(([n, t]) => `<figure><div class="desk"><iframe data-screen="${n}" title="${t}" loading="lazy"></iframe></div><figcaption><b>${t} — ordinateur</b></figcaption></figure>`).join('')
const motion = [
  ['Intro', 'Logo qui apparaît, onde orange, barre ; une fois par chargement'],
  ['Total du mois', 'Compte jusqu’à sa valeur quand une note s’ajoute'],
  ['Tuiles', 'Apparition en cascade ; liseré orange qui respire pendant l’envoi'],
  ['Scan', 'Faisceau + quadrillage, étapes de lecture, coins verrouillés, coche'],
  ['Champs lus par l’IA', 'Illumination orange, un par un'],
  ['Boutons', 'Léger enfoncement au toucher, éclaircissement au survol'],
  ['Mouvement réduit', 'Toutes les animations sont coupées si le système le demande'],
].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')

writeFileSync(resolve(out, 'index.html'), `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>SnapNote — Maquette</title><link rel="icon" href="../../public/favicon.svg" /><style id="app-css">${css}</style>
<style>
body{padding:56px 24px 96px;font-size:15px}
.mq{max-width:1280px;margin:0 auto}
.mq h1{font-size:44px;font-weight:300;letter-spacing:-.035em;line-height:1.05}
.mq h1 em{font-style:normal;color:var(--orange)}
.mq .lead{margin-top:14px;max-width:660px;color:var(--muted);line-height:1.55}
.mq>h2{margin:72px 0 6px;font-size:13px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--orange-soft)}
.mq>h2+p{margin:0 0 28px;color:var(--muted);max-width:680px}
.mq h4{margin:0 0 14px;font-size:13px;font-weight:500;color:var(--muted)}
.mq-sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.mq-sw{display:grid;gap:3px;padding:12px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--sheet)}
.mq-sw i{height:54px;border-radius:10px;border:1px solid var(--line);margin-bottom:8px}
.mq-sw b{font-weight:500;font-size:13.5px}.mq-sw code{color:var(--muted);font-size:12.5px}.mq-sw span{color:var(--dim);font-size:12.5px}
.mq-type{display:grid;gap:18px;padding:28px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--sheet)}
.mq-type div{display:flex;align-items:baseline;gap:24px;flex-wrap:wrap}.mq-type small{width:170px;color:var(--dim);font-size:12.5px}
.mq-radii{display:flex;gap:16px;flex-wrap:wrap;margin-top:18px}
.mq-radii span{display:grid;place-items:center;width:120px;height:72px;background:var(--sheet-2);border:1px solid var(--line);color:var(--muted);font-size:12.5px}
.mq-spec{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.mq-box{padding:22px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--sheet)}
.mq-box.wide{grid-column:1/-1}.mq-line{display:flex;gap:14px;flex-wrap:wrap;align-items:center}.mq-col{display:grid;gap:12px}
.mq-icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
.mq-icons figure{display:grid;justify-items:center;gap:8px;margin:0;padding:16px 6px;border:1px solid var(--line);border-radius:var(--r-md);background:var(--sheet)}
.mq-icons .icon{width:26px;height:26px}.mq-icons figcaption{color:var(--dim);font-size:12px}
.mq-hero{max-width:520px;padding-bottom:36px}
.mq table{width:100%;max-width:760px;border-collapse:collapse}.mq td{padding:12px 4px;border-bottom:1px solid var(--line);vertical-align:top}.mq td:first-child{width:210px;font-weight:500}.mq td:last-child{color:var(--muted)}
.mq-row{display:flex;flex-wrap:wrap;gap:40px 28px}.mq figure{display:grid;gap:14px;align-content:start;margin:0}
.phone{width:390px;height:800px;border-radius:44px;border:1px solid var(--line);background:#000;padding:10px;box-shadow:0 30px 70px rgba(0,0,0,.5)}
.phone iframe{width:100%;height:100%;border:0;border-radius:34px;background:var(--bg)}
.desk{width:720px;height:456px;border-radius:14px;border:1px solid var(--line);overflow:hidden;background:#000}
.desk iframe{width:1200px;height:760px;border:0;transform:scale(.6);transform-origin:0 0}
.mq figcaption{display:grid;gap:3px;max-width:390px;font-size:14px}.mq figcaption span{color:var(--muted)}
.mq-note{margin-top:56px;color:var(--dim);font-size:13px}
</style></head><body><div class="mq">
<header><h1>SnapNote<br /><em>sombre et chaleureux.</em></h1>
<p class="lead">Maquette d’ensemble de l’application : couleurs, typographie, composants, mouvement et tous les écrans sur une seule page. Les composants et les écrans sont les vrais, rendus avec la vraie feuille de style : la maquette reste fidèle au code.</p></header>

<h2>Couleurs</h2><p>Une seule couleur vive : l’orange. Le vert n’existe que pour la coche et « Envoyée ». Aucune couleur écrite en dur dans un composant : toujours une variable.</p>
<div class="mq-sws">${colors}</div>

<h2>Typographie</h2><p>Geist, auto-hébergée. Le chiffre d’abord : le total du mois est l’élément le plus grand de l’écran.</p>
<div class="mq-type">
<div><small>Total — 72 px, graisse 300</small><span style="font-size:72px;font-weight:300;letter-spacing:-.04em;line-height:1">214,90 €</span></div>
<div><small>Titre — 26 px, graisse 500</small><span style="font-size:26px;font-weight:500;letter-spacing:-.03em">Dernières notes</span></div>
<div><small>Texte — 15 px</small><span>Brasserie Le Petit Zinc · 12 nov. 2026</span></div>
<div><small>Secondaire — 13 px</small><span style="font-size:13px;color:var(--muted)">Scanné par camille.martin@entreprise.fr</span></div>
</div>

<h2>Formes</h2><p>Grands arrondis, boutons en pilule, cercles pour les icônes.</p>
<div class="mq-radii"><span style="border-radius:var(--r-md)">16 px — champs</span><span style="border-radius:var(--r-lg)">22 px — tuiles</span><span style="border-radius:var(--r-xl)">32 px — cartes</span><span style="border-radius:999px">pilule — boutons</span><span style="border-radius:50%;width:72px">cercle</span></div>

<h2>Carte du total</h2><p>Le total du mois, les catégories cliquables (filtre) et le bouton « Scanner ».</p>
<div class="mq-hero">${renderHero()}</div>

<h2>Composants</h2><p>États de repos et variantes.</p>
${renderSpecimen()}

<h2>Icônes</h2><p>Jeu d’icônes en trait fin, intégré (aucune dépendance).</p>
<div class="mq-icons">${renderIcons(iconNames)}</div>

<h2>Mouvement</h2><p>Discret, utile, désactivable.</p>
<table>${motion}</table>

<h2>Écrans — téléphone</h2><p>Du premier chargement à la consultation d’un justificatif.</p>
<div class="mq-row">${phones}</div>

<h2>Écrans — ordinateur</h2><p>Le panneau « Nouvelle note » devient un tiroir à droite ; la connexion garde sa carte centrée.</p>
<div class="mq-row">${desks}</div>

${pages.map((n) => `<template id="screen-${n}">${screenHtml[n]}</template>`).join('')}
<script>
// Chaque écran est rendu dans un iframe isolé (pour que les tailles d'écran soient celles d'un téléphone ou d'un ordinateur),
// avec la même feuille de style que la page : un seul fichier suffit.
const css = document.getElementById('app-css').textContent
document.querySelectorAll('iframe[data-screen]').forEach((f) => {
  const html = document.getElementById('screen-' + f.dataset.screen).innerHTML
  f.srcdoc = '<!doctype html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>' + css + '</style></head><body><div id="root">' + html + '</div></body></html>'
})
</script>
<p class="mq-note">Générée par <code>node design/build-maquette.mjs</code> — à relancer après un changement d’interface.</p>
</div></body></html>`)
rmSync(bundle) // fichier temporaire
for (const f of readdirSync(out)) if (f !== 'index.html') rmSync(resolve(out, f)) // un seul fichier : index.html
console.log('Maquette générée dans', out)
