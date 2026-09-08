// Lecture des horaires OpenStreetMap (tag « opening_hours », ex. « Mo-Fr 11:30-14:30,18:00-22:30; Sa 18:00-23:00;
// Su off ») vers la structure Fairide { mon: [{ open, close }], … } utilisée par OpeningHoursEditor.
// Volontairement tolérant : ce qu'on ne comprend pas (jours fériés « PH », semaines, mois, « sunset »…) est
// ignoré plutôt que de tout rejeter — le restaurateur corrige ensuite jour par jour dans l'éditeur.
const JOURS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
const CLES = { mo: 'mon', tu: 'tue', we: 'wed', th: 'thu', fr: 'fri', sa: 'sat', su: 'sun' };

function joursDepuis(texte) {
  const jours = new Set();
  for (const part of texte.toLowerCase().split(',')) {
    const p = part.trim().replace(/\./g, '');
    if (!p) continue;
    const m = p.match(/^(mo|tu|we|th|fr|sa|su)\s*-\s*(mo|tu|we|th|fr|sa|su)$/);
    if (m) {
      let i = JOURS.indexOf(m[1]); const fin = JOURS.indexOf(m[2]);
      for (let k = 0; k < 7; k++) { jours.add(JOURS[i]); if (i === fin) break; i = (i + 1) % 7; }
    } else if (JOURS.includes(p)) jours.add(p);
    // « PH », « SH » et autres : ignorés.
  }
  return [...jours];
}

const heure = (h) => { const m = h.match(/^(\d{1,2})[:h.]?(\d{2})?$/); if (!m) return null; const hh = Math.min(24, Number(m[1])); const mm = m[2] ? Number(m[2]) : 0; if (mm > 59) return null; return `${String(hh === 24 ? 24 : hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };

function creneauxDepuis(texte) {
  const cren = [];
  for (const part of texte.split(',')) {
    const m = part.trim().match(/^(\d{1,2}(?:[:h.]\d{2})?)\s*-\s*(\d{1,2}(?:[:h.]\d{2})?)\+?$/);
    if (!m) continue;
    const open = heure(m[1]); let close = heure(m[2]);
    if (!open || !close) continue;
    if (close === '24:00' || close === '00:00') close = '23:59';
    cren.push({ open, close });
  }
  return cren;
}

// Renvoie la structure horaires, ou null si rien d'exploitable.
export function horairesDepuisOsm(chaine) {
  const s = String(chaine || '').trim();
  if (!s) return null;
  const res = {};
  if (/^24\s*\/\s*7$/.test(s)) { for (const j of JOURS) res[CLES[j]] = [{ open: '00:00', close: '23:59' }]; return res; }
  let trouve = false;
  for (const regle of s.split(';')) {
    const r = regle.trim(); if (!r) continue;
    // Séparer la partie « jours » (lettres, virgules, tirets) de la partie « heures ».
    const m = r.match(/^([A-Za-z,\-\s.]*?)\s*((?:\d{1,2}(?:[:h.]\d{2})?\s*-\s*\d{1,2}(?:[:h.]\d{2})?\+?\s*,?\s*)+|off|closed)$/i);
    if (!m) continue;
    const jours = m[1].trim() ? joursDepuis(m[1]) : JOURS.slice();
    if (!jours.length) continue;
    const ferme = /^(off|closed)$/i.test(m[2].trim());
    const cren = ferme ? [] : creneauxDepuis(m[2]);
    if (!ferme && !cren.length) continue;
    for (const j of jours) res[CLES[j]] = cren.map((c) => ({ ...c }));
    trouve = true;
  }
  return trouve ? res : null;
}

// Au moins un jour ouvert ?
export function horairesNonVides(h) {
  return !!h && Object.values(h).some((c) => Array.isArray(c) && c.length > 0);
}
