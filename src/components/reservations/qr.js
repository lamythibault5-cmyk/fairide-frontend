// Générateur de QR code minimal, sans dépendance : mode octets, niveau de correction M, versions 1 à 10
// (jusqu'à 213 octets — un lien de réservation en fait une soixantaine). Écrit pour l'onglet
// « Intégration » du module Réservations : le restaurateur imprime le QR sur sa carte ou sa vitrine.
// Implémentation directe de la norme ISO 18004 (Reed-Solomon sur GF(256), placement en zigzag, choix
// du masque par pénalité). Résultat : une matrice de booléens, rendue en SVG par qrSvgPath().

// Par version (niveau M) : nombre de mots de correction par bloc, puis la taille en données de chaque bloc.
const EC_M = {
  1: [10, [16]], 2: [16, [28]], 3: [26, [44]], 4: [18, [32, 32]], 5: [24, [43, 43]],
  6: [16, [27, 27, 27, 27]], 7: [18, [31, 31, 31, 31]], 8: [22, [38, 38, 39, 39]],
  9: [22, [36, 36, 36, 37, 37]], 10: [26, [43, 43, 43, 43, 44]]
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };

// Corps de Galois GF(256), polynôme 0x11d.
const EXP = new Uint8Array(512); const LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}());
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function genPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
function rsEncode(data, n) {
  const g = genPoly(n);
  const res = new Array(n).fill(0);
  for (const d of data) {
    const f = d ^ res[0];
    res.shift(); res.push(0);
    if (f) for (let j = 0; j < n; j++) res[j] ^= mul(g[j + 1], f);
  }
  return res;
}

function choisirVersion(nbOctets) {
  for (let v = 1; v <= 10; v++) {
    const capacite = EC_M[v][1].reduce((a, b) => a + b, 0) * 8;
    if (4 + (v < 10 ? 8 : 16) + nbOctets * 8 <= capacite) return v;
  }
  return null;
}

function motsDeCode(octets, v) {
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0b0100, 4);
  push(octets.length, v < 10 ? 8 : 16);
  for (const o of octets) push(o, 8);
  const capacite = EC_M[v][1].reduce((a, b) => a + b, 0) * 8;
  push(0, Math.min(4, capacite - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xEC; data.length < capacite / 8; pad ^= 0xEC ^ 0x11) data.push(pad);
  // Blocs + correction, puis entrelacement.
  const [nEc, tailles] = EC_M[v];
  const blocs = []; let pos = 0;
  for (const t of tailles) { const d = data.slice(pos, pos + t); pos += t; blocs.push({ d, ec: rsEncode(d, nEc) }); }
  const out = [];
  const maxD = Math.max(...tailles);
  for (let i = 0; i < maxD; i++) for (const b of blocs) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < nEc; i++) for (const b of blocs) out.push(b.ec[i]);
  return out;
}

// Construit la matrice complète pour un texte. Renvoie { size, modules } (modules[y][x] = true si sombre).
export function qrMatrix(text) {
  const octets = Array.from(new TextEncoder().encode(String(text)));
  const v = choisirVersion(octets.length);
  if (!v) return null;
  const size = 17 + 4 * v;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fonction = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, val) => { modules[y][x] = !!val; fonction[y][x] = true; };

  // Motifs de repérage (3 coins) avec séparateurs.
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx; const y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  // Motifs d'alignement.
  const pos = ALIGN[v];
  for (const cy of pos) for (const cx of pos) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // Lignes de synchronisation.
  for (let i = 8; i < size - 8; i++) { if (!fonction[6][i]) set(i, 6, i % 2 === 0); if (!fonction[i][6]) set(6, i, i % 2 === 0); }
  // Zones réservées (format, version) et module sombre.
  for (let i = 0; i < 9; i++) { if (!fonction[8][i]) set(i, 8, false); if (!fonction[i][8]) set(8, i, false); }
  for (let i = 0; i < 8; i++) { set(size - 1 - i, 8, false); set(8, size - 1 - i, false); }
  set(8, size - 8, true);
  if (v >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const b = Math.floor(i / 3); set(a, b, false); set(b, a, false); }

  // Données en zigzag, en évitant la colonne 6.
  const data = motsDeCode(octets, v);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fonction[y][x] && i < data.length * 8) {
          modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
          i++;
        }
      }
    }
  }

  // Choix du masque par pénalité (les quatre règles de la norme).
  const MASQUES = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ];
  const appliquer = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fonction[y][x] && MASQUES[m](x, y)) modules[y][x] = !modules[y][x]; };
  const format = (m) => {
    const dataBits = (0b00 << 3) | m; // niveau M
    let rem = dataBits;
    for (let k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((dataBits << 10) | rem) ^ 0x5412;
    const b = (k) => ((bits >>> k) & 1) === 1;
    for (let k = 0; k <= 5; k++) modules[k][8] = b(k);
    modules[7][8] = b(6); modules[8][8] = b(7); modules[8][7] = b(8);
    for (let k = 9; k < 15; k++) modules[8][14 - k] = b(k);
    for (let k = 0; k < 8; k++) modules[8][size - 1 - k] = b(k);
    for (let k = 8; k < 15; k++) modules[size - 15 + k][8] = b(k);
    modules[size - 8][8] = true;
  };
  const penalite = () => {
    let p = 0;
    const ligne = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1; let hist = [];
        for (let b = 0; b < size; b++) {
          const val = get(a, b);
          if (b > 0 && val === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p += 1; } else run = 1;
          hist.push(val ? 1 : 0);
        }
        const s = hist.join('');
        p += 40 * ((s.match(/1011101(0000)/g) || []).length + (s.match(/(0000)1011101/g) || []).length);
      }
    };
    ligne((y, x) => modules[y][x]); ligne((x, y) => modules[y][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) p += 3;
    }
    let sombres = 0; for (const row of modules) for (const m of row) if (m) sombres++;
    p += 10 * Math.floor(Math.abs(sombres * 20 - size * size * 10) / (size * size));
    return p;
  };
  let meilleur = 0; let min = Infinity;
  for (let m = 0; m < 8; m++) { appliquer(m); format(m); const p = penalite(); if (p < min) { min = p; meilleur = m; } appliquer(m); }
  appliquer(meilleur); format(meilleur);
  if (v >= 7) {
    let rem = v;
    for (let k = 0; k < 12; k++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bits = (v << 12) | rem;
    for (let k = 0; k < 18; k++) { const bit = ((bits >>> k) & 1) === 1; const a = size - 11 + (k % 3); const b = Math.floor(k / 3); modules[b][a] = bit; modules[a][b] = bit; }
  }
  return { size, modules };
}

// Chemin SVG (un rectangle par module sombre, fusionné par ligne) et boîte de vue, marge de 4 modules.
export function qrSvgPath(text) {
  const qr = qrMatrix(text);
  if (!qr) return null;
  const marge = 4; let d = '';
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) { x++; continue; }
      let fin = x; while (fin < qr.size && qr.modules[y][fin]) fin++;
      d += `M${x + marge} ${y + marge}h${fin - x}v1h-${fin - x}z`;
      x = fin;
    }
  }
  return { d, viewBox: `0 0 ${qr.size + marge * 2} ${qr.size + marge * 2}`, size: qr.size };
}
