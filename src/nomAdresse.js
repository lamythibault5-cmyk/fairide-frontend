/* LE NOM D'UNE ADRESSE DU CARNET (fondateur, 2026-11-08, maquette retours-08-11). Le serveur écrit `maison` et `travail`
 * (un seul de chaque par compte, routes/auth.js du backend) ; on les montre dans la langue de l'écran. Tout autre nom est
 * celui que le client a tapé, montré tel quel. Vide : pas de nom, l'écran montre la rue. */
export const LIBELLES_RESERVES = ['maison', 'travail'];

export function nomAdresse(a, t) {
  const l = String(a?.label || '').trim();
  if (l === 'maison') return t('adresses.home');
  if (l === 'travail') return t('adresses.work');
  return l;
}

/** « Rue de Ribaucourt 40, Molenbeek-Saint-Jean » */
export function rueAdresse(a) {
  return `${a?.street || ''} ${a?.number || ''}, ${a?.city || ''}`.replace(' ,', ',').replace(/^[\s,]+|[\s,]+$/g, '');
}

/** L'entrée du carnet qui est l'adresse choisie sur le compte (mêmes rue et numéro), ou null. */
export function adresseEnCours(adresses, user) {
  if (!user || !Array.isArray(adresses)) return null;
  const rue = (user.addressStreet || '').toLowerCase();
  const num = (user.addressNumber || '').toLowerCase();
  return adresses.find((a) => (a.street || '').toLowerCase() === rue && (a.number || '').toLowerCase() === num) || null;
}
