import { qrMatrix } from './components/qr';

// Imprimante intégrée du terminal Goodcom (GT81H), pilotée DEPUIS LE NAVIGATEUR.
//
// Goodcom fournit un « Web Printer SDK » (github.com/goodcom6/HtmlPrinterDemo) : sur le terminal tourne le « service
// d'impression Goodcom », qui écoute un WebSocket local (ws://localhost:62769, sous-protocole « printer »). On lui
// envoie un ticket (HTML, PDF ou image en base64) ; il répond « 0 » en cas d'échec. Leur script ne fait que ça, en une
// vingtaine de lignes : on le réécrit ici plutôt que de charger du code tiers sur fairide.be, et on y ajoute un délai
// maximal et la détection du service.
//
// Le ticket est envoyé en IMAGE, dessinée à partir des mêmes lignes que partout ailleurs (backend ticketTerminal.js) :
// accents, texte inversé, double taille et QR code sortent à l'identique, quelle que soit la police de l'imprimante.
//
// Nécessite, côté site, que la politique de sécurité autorise ws://localhost:62769 (connect-src de vercel.json).
const URL_SERVICE = 'ws://localhost:62769';
const LARGEUR_POINTS = 384; // rouleau de 58 mm à 203 ppp
const DELAI_MS = 15000;

function envoyer(requete, donnees, delai = DELAI_MS) {
  return new Promise((resolve, reject) => {
    let ws;
    try { ws = new WebSocket(URL_SERVICE + requete, 'printer'); } catch (e) { reject(Object.assign(new Error(e.message), { code: 'printer_offline' })); return; }
    const minuterie = setTimeout(() => { try { ws.close(); } catch { /* rien */ } reject(Object.assign(new Error('Délai dépassé'), { code: 'printer_busy' })); }, delai);
    ws.onopen = () => ws.send(donnees);
    ws.onmessage = (m) => {
      clearTimeout(minuterie);
      try { ws.close(); } catch { /* rien */ }
      if (m.data === '0') reject(Object.assign(new Error('Impression refusée par le terminal'), { code: 'unknown' }));
      else resolve(true);
    };
    ws.onerror = () => { clearTimeout(minuterie); reject(Object.assign(new Error('Service d\'impression Goodcom injoignable'), { code: 'printer_offline' })); };
  });
}

// Le service d'impression Goodcom répond-il ? (connexion ouverte puis refermée aussitôt, sans rien imprimer)
let dernierTest = { at: 0, ok: false };
export function serviceGoodcomDisponible({ delai = 1500, forcer = false } = {}) {
  if (!forcer && Date.now() - dernierTest.at < 30000) return Promise.resolve(dernierTest.ok);
  return new Promise((resolve) => {
    let fini = false;
    const conclure = (ok) => { if (fini) return; fini = true; dernierTest = { at: Date.now(), ok }; resolve(ok); };
    let ws;
    try { ws = new WebSocket(URL_SERVICE + '?f=0', 'printer'); } catch { conclure(false); return; }
    const m = setTimeout(() => { try { ws.close(); } catch { /* rien */ } conclure(false); }, delai);
    ws.onopen = () => { clearTimeout(m); try { ws.close(); } catch { /* rien */ } conclure(true); };
    ws.onerror = () => { clearTimeout(m); conclure(false); };
  });
}

// Lignes du ticket (backend) → image PNG en base64, 384 points de large.
export function ticketEnImage(lignes, colonnes = 32) {
  const C = colonnes;
  const marge = 8;
  const largeurUtile = LARGEUR_POINTS - marge * 2;
  const pas = largeurUtile / C; // largeur d'une colonne en points
  const police = Math.floor(pas / 0.6); // une police à chasse fixe fait ~0,6 em de large
  const hLigne = Math.round(police * 1.25);
  // Hauteur : on la calcule d'abord, puis on dessine.
  let h = marge;
  for (const x of lignes) {
    if (x.t === 'feed') h += x.lines * hLigne;
    else if (x.t === 'qr') h += 180 + hLigne;
    else if (x.t === 'text' && x.size === 2) h += hLigne * 2;
    else h += hLigne;
  }
  h += marge;
  const canvas = document.createElement('canvas');
  canvas.width = LARGEUR_POINTS; canvas.height = Math.ceil(h);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.textBaseline = 'top';
  let y = marge;
  const fonte = (taille, gras) => `${gras ? '700 ' : ''}${taille}px "Courier New", Courier, monospace`;
  for (const x of lignes) {
    if (x.t === 'feed') { y += x.lines * hLigne; continue; }
    if (x.t === 'rule') {
      g.fillStyle = '#000'; g.font = fonte(police, false); g.textAlign = 'left';
      g.fillText(x.char.repeat(C), marge, y, largeurUtile); y += hLigne; continue;
    }
    if (x.t === 'qr') {
      const qr = qrMatrix(x.data);
      if (qr) {
        const taille = 160; const mod = Math.floor(taille / qr.size); const dx = Math.round((LARGEUR_POINTS - mod * qr.size) / 2);
        g.fillStyle = '#000';
        for (let r = 0; r < qr.size; r++) for (let c = 0; c < qr.size; c++) if (qr.modules[r][c]) g.fillRect(dx + c * mod, y + 10 + r * mod, mod, mod);
      }
      y += 180;
      g.font = fonte(police, false); g.textAlign = 'center'; g.fillText(x.caption || '', LARGEUR_POINTS / 2, y, largeurUtile);
      y += hLigne; continue;
    }
    const grand = x.size === 2;
    const taille = grand ? police * 2 : police;
    const hauteur = grand ? hLigne * 2 : hLigne;
    if (x.inverse) { g.fillStyle = '#000'; g.fillRect(marge, y, largeurUtile, hauteur); }
    g.fillStyle = x.inverse ? '#fff' : '#000';
    g.font = fonte(taille, x.bold);
    g.textAlign = x.align === 'center' ? 'center' : x.align === 'right' ? 'right' : 'left';
    const ax = x.align === 'center' ? LARGEUR_POINTS / 2 : x.align === 'right' ? LARGEUR_POINTS - marge : marge;
    g.fillText(x.text || '', ax, y + (grand ? 2 : 1), largeurUtile);
    y += hauteur;
  }
  return canvas.toDataURL('image/png').split(',')[1];
}

// Imprime un ticket (lignes du backend) sur l'imprimante du Goodcom. Lève une erreur portant `code`
// (printer_offline, printer_busy, unknown) — les mêmes codes que ceux que le serveur connaît (impressions.js).
export async function imprimerSurGoodcom(lignes, colonnes = 32) {
  const image = ticketEnImage(lignes, colonnes);
  await envoyer('?f=1&t=base&time=10', image);
  return true;
}
