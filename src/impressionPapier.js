import { qrSvgPath } from './components/qr';

// Imprime un ticket du terminal Fairide SUR PAPIER, depuis n'importe quel appareil (boîte d'impression du système) :
// ordinateur, tablette, ou navigateur du terminal Goodcom s'il expose son imprimante intégrée comme service
// d'impression Android. Mêmes lignes que l'imprimante du terminal (backend ticketTerminal.js) : colonne de 58 mm,
// texte en double taille, blanc sur noir, QR code.
//
// Dans une iframe à part : la page d'impression ne dépend ni du CSS du site ni de ce qui est ouvert à l'écran.
const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function versHtml(lignes, colonnes) {
  return lignes.map((x) => {
    if (x.t === 'rule') return `<div class="l trait">${echapper(x.char.repeat(colonnes))}</div>`;
    if (x.t === 'feed') return `<div style="height:${x.lines * 1.2}em"></div>`;
    if (x.t === 'qr') {
      const qr = qrSvgPath(x.data);
      return `<div class="qr">${qr ? `<svg viewBox="${qr.viewBox}" width="110" height="110"><path d="${qr.d}" fill="#000"/></svg>` : ''}<div>${echapper(x.caption)}</div></div>`;
    }
    const cls = ['l', `a-${x.align}`, x.size === 2 ? 'g' : '', x.bold ? 'b' : '', x.inverse ? 'i' : ''].filter(Boolean).join(' ');
    return `<div class="${cls}">${echapper(x.text) || '&nbsp;'}</div>`;
  }).join('');
}

export function imprimerTicketPapier(lignes, colonnes = 32, titre = 'Ticket Fairide') {
  if (!Array.isArray(lignes) || !lignes.length) return false;
  const largeurMm = colonnes > 32 ? 72 : 48; // zone imprimable d'un rouleau de 58 mm (80 mm pour 48 colonnes)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${echapper(titre)}</title><style>
    @page { size: ${colonnes > 32 ? 80 : 58}mm auto; margin: 3mm 5mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    .t { width: ${largeurMm}mm; font-family: 'Courier New', ui-monospace, Menlo, Consolas, monospace; font-size: ${(largeurMm / colonnes / 0.6).toFixed(2)}mm; line-height: 1.2; white-space: pre; }
    .l { overflow: hidden; } .a-center { text-align: center; } .a-right { text-align: right; }
    .b { font-weight: 700; } .g { font-size: 2em; line-height: 1.1; } .i { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .trait { color: #000; } .qr { text-align: center; padding-top: 2mm; font-size: .9em; }
  </style></head><body><div class="t">${versHtml(lignes, colonnes)}</div></body></html>`;
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(cadre);
  const doc = cadre.contentDocument;
  doc.open(); doc.write(html); doc.close();
  const lancer = () => {
    try { cadre.contentWindow.focus(); cadre.contentWindow.print(); } catch { /* impression refusée */ }
    setTimeout(() => cadre.remove(), 60000);
  };
  // Laisser le temps au contenu (SVG) d'être mis en page avant d'ouvrir la boîte d'impression.
  setTimeout(lanceur => lanceur(), 250, lancer);
  return true;
}
