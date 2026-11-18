// Code du nœud « Préparer la note » (workflow n8n « SnapNote - Note de frais vers comptable »).
// Entrée : le payload du webhook Supabase ($json.body.record = la note enregistrée).
// Sortie : sujet et HTML de l'email, et l'indication de photo à télécharger.
// Design : même identité que l'app (noir, orange, montant géant). Les clients mail ne chargent pas toujours
// les polices web : on garde donc une pile de secours. Le HTML est écrit « à l'ancienne » (tableaux, styles
// en ligne) parce que c'est la seule mise en page fiable dans Gmail, Outlook et Apple Mail.
const body = $json.body || {};
const r = body.record || {};

// Tout ce qui vient de l'IA ou de l'utilisateur est échappé : une enseigne ne doit jamais pouvoir injecter du HTML.
const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\x22/g, '&quot;');
const eur = (v) => (v === null || v === undefined || v === '') ? 'n/c' : Number(v).toFixed(2).replace('.', ',') + ' €';
const day = (v) => v ? String(v).split('-').reverse().join('/') : 'n/c';
const scannedAt = r.created_at ? DateTime.fromISO(r.created_at).setZone('Europe/Paris').toFormat('dd/MM/yyyy à HH:mm') : 'n/c';

const COLORS = { Restaurant: '#d9602b', Transport: '#2f6fd0', Carburant: '#1a9aa6', Fournitures: '#7e9a2e', 'Hébergement': '#b24c6b', Autre: '#5f5a55' };
const merchant = esc(r.merchant || 'Enseigne inconnue');
const author = esc(r.user_email || 'inconnu');
const category = esc(r.category || 'Autre');
const dot = COLORS[r.category] || COLORS.Autre;
const ref = String(r.id || '').slice(0, 8).toUpperCase();
// Pas de guillemets dans la pile de polices : ils fermeraient l'attribut style='…' du HTML.
const font = `font-family:Geist,-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;`;

const row = (label, value) => `<tr><td style='padding:14px 0;border-bottom:1px solid #2a2a2a;color:#9a938b;font-size:14px;${font}'>${label}</td><td align='right' style='padding:14px 0;border-bottom:1px solid #2a2a2a;color:#f6f2ec;font-size:14.5px;font-weight:500;${font}'>${value}</td></tr>`;
const badge = r.source === 'ai'
  ? `<span style='display:inline-block;padding:4px 12px;border-radius:999px;background:#3a2214;color:#ff9a62;font-size:12.5px;font-weight:600'>Lecture automatique (IA)</span>`
  : `<span style='display:inline-block;padding:4px 12px;border-radius:999px;background:#242424;color:#c9c3bb;font-size:12.5px;font-weight:600'>Saisie manuelle</span>`;
const strip = r.image_path ? 'Le justificatif est joint à cet email' : 'Aucune photo jointe à cette note';

const html = `<div style='display:none;max-height:0;overflow:hidden;opacity:0'>${merchant} - ${eur(r.amount_ttc)} - note de frais de ${author}</div>
<table role='presentation' width='100%' cellpadding='0' cellspacing='0' bgcolor='#0a0a0a' style='background:#0a0a0a'><tr><td align='center' style='padding:28px 12px'>
<table role='presentation' width='560' cellpadding='0' cellspacing='0' style='width:100%;max-width:560px'>
<tr><td style='padding:0 6px 18px'><table role='presentation' cellpadding='0' cellspacing='0'><tr><td width='34' height='34' align='center' style='background:#ffffff;border-radius:50%;color:#0a0a0a;font-weight:700;font-size:16px;${font}'>S</td><td style='padding-left:10px;color:#f6f2ec;font-size:18px;font-weight:500;${font}'>SnapNote</td></tr></table></td></tr>
<tr><td bgcolor='#161616' align='center' style='background:#161616;background-image:linear-gradient(180deg,#0f0f0f 0%,#161616 50%,#2b150b 85%,#80380f 100%);border-radius:28px;padding:30px 28px 28px;${font}'>
<div style='color:#ff9a62;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600'>Nouvelle note de frais</div>
<div style='color:#f6f2ec;font-size:22px;font-weight:500;margin-top:10px'>${merchant}</div>
<div style='color:#ffffff;font-size:54px;font-weight:300;letter-spacing:-.04em;line-height:1.1;margin:8px 0 10px'>${eur(r.amount_ttc)}</div>
<div style='color:#9a938b;font-size:14px'>HT ${eur(r.amount_ht)} &nbsp;·&nbsp; TVA ${eur(r.amount_vat)}</div>
</td></tr>
<tr><td style='padding:0 14px'><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr><td bgcolor='#d9602b' align='center' style='background:#d9602b;background-image:linear-gradient(180deg,#ee7a3f,#c9531f);border-radius:0 0 22px 22px;padding:14px 16px;color:#ffffff;font-size:14.5px;font-weight:500;${font}'>${strip}</td></tr></table></td></tr>
<tr><td style='padding-top:18px'><table role='presentation' width='100%' cellpadding='0' cellspacing='0'><tr><td bgcolor='#121212' style='background:#121212;border-radius:22px;padding:6px 22px'>
<table role='presentation' width='100%' cellpadding='0' cellspacing='0'>
${row('Catégorie', `<span style='display:inline-block;width:9px;height:9px;border-radius:50%;background:${dot};margin-right:8px'></span>${category}`)}
${row('Date du justificatif', day(r.receipt_date))}
${row('Scanné par', `<a href='mailto:${author}' style='color:#ff9a62;text-decoration:none'>${author}</a>`)}
${row('Scanné le', scannedAt)}
${row('Saisie', badge)}
</table></td></tr></table></td></tr>
<tr><td align='center' style='padding:18px 8px 0;color:#6f6963;font-size:12px;${font}'>Email envoyé automatiquement par SnapNote · Référence ${ref}</td></tr>
</table></td></tr></table>`;

const subject = ('Note de frais - ' + (r.merchant || 'sans enseigne') + ' - ' + eur(r.amount_ttc) + ' (' + (r.user_email || 'inconnu') + ')').replace(/[\r\n]+/g, ' ');
return { json: { receiptId: r.id, subject: subject, html: html, hasImage: !!r.image_path, imagePath: r.image_path || '' } };
