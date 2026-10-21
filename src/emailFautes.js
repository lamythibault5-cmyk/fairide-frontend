/* « TU VOULAIS DIRE …@GMAIL.COM ? » (fondateur, 2026-10-18).
 *
 * Une faute de frappe dans l'adresse e-mail à l'inscription (gmial.com, hotmial.com, gmail.con) envoie tout chez un
 * inconnu : la confirmation de l'adresse, puis le lien « mot de passe oublié », avec lequel il pourrait prendre le compte.
 * On la rattrape là où elle naît, sous le champ (EmailDomainChips.jsx) : une seule proposition, un geste pour l'accepter,
 * jamais de correction d'office.
 *
 * Prudente exprès : seulement les grands fournisseurs, une ou deux lettres de différence dans le nom (lettres inversées
 * comprises), ou une extension mal tapée (.con, .cmo, .bee). Une adresse d'entreprise (@monresto.be) ou une vraie autre
 * extension d'un fournisseur (hotmail.fr, live.be) ne déclenche rien. */

// Proton : .ch existe aussi (audit du 19/10, auth-36 : une vraie adresse @protonmail.ch se voyait proposer « .com »).
// Fournisseur → ses extensions réelles. La première sert de correction quand l'extension tapée n'existe pas chez lui.
const FOURNISSEURS = {
  gmail: ['com'], googlemail: ['com'], hotmail: ['com', 'be', 'fr', 'nl'], outlook: ['com', 'be', 'fr'], live: ['com', 'be', 'fr', 'nl'],
  icloud: ['com'], me: ['com'], yahoo: ['com', 'fr'], proton: ['me', 'ch'], protonmail: ['com', 'ch'], skynet: ['be'], telenet: ['be'],
  msn: ['com'], gmx: ['com', 'fr', 'de'], orange: ['fr'], free: ['fr'], scarlet: ['be'], voo: ['be'], proximus: ['be']
};
// Extensions mal tapées, et ce qu'elles voulaient dire.
const EXTENSIONS = { con: 'com', cmo: 'com', ocm: 'com', comm: 'com', vom: 'com', xom: 'com', cm: 'com', om: 'com', co: 'com', bee: 'be', eb: 'be', bw: 'be', frr: 'fr', fe: 'fr' };

// Distance d'édition, une inversion de deux lettres voisines comptant pour une seule faute (« gmial » → « gmail »).
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

// Rend l'adresse corrigée (« lou@gmail.com »), ou null quand rien ne semble mal tapé.
export function suggestionEmail(adresse) {
  const v = String(adresse || '').trim().toLowerCase();
  const m = v.match(/^([^\s@]+)@([^\s@]+)\.([a-z]{1,6})$/);
  if (!m) return null;
  const [, local, nom, ext] = m;
  if (nom.includes('.')) return null; // sous-domaines (mail.monresto.be) : on ne devine pas
  // Nom connu : seule l'extension peut être fausse.
  if (FOURNISSEURS[nom]) {
    if (FOURNISSEURS[nom].includes(ext)) return null;
    const voulue = EXTENSIONS[ext];
    if (voulue && FOURNISSEURS[nom].includes(voulue)) return `${local}@${nom}.${voulue}`;
    // Extension qui n'existe pas chez ce fournisseur (gmail.be) : sa seule extension, s'il n'en a qu'une.
    return FOURNISSEURS[nom].length === 1 ? `${local}@${nom}.${FOURNISSEURS[nom][0]}` : null;
  }
  // Nom proche d'un fournisseur : une faute (deux pour un nom long), et une extension qui lui va, ou une extension mal tapée.
  let meilleur = null; let ecart = Infinity;
  for (const f of Object.keys(FOURNISSEURS)) {
    if (f.length < 5) continue; // « me », « msn », « gmx », « voo », « free » : trop courts pour deviner sans se tromper
    const x = distance(nom, f);
    if (x < ecart) { ecart = x; meilleur = f; }
  }
  if (!meilleur || ecart > (meilleur.length >= 7 ? 2 : 1)) return null;
  const extVoulue = FOURNISSEURS[meilleur].includes(ext) ? ext : FOURNISSEURS[meilleur].includes(EXTENSIONS[ext]) ? EXTENSIONS[ext] : FOURNISSEURS[meilleur][0];
  return `${local}@${meilleur}.${extVoulue}`;
}
