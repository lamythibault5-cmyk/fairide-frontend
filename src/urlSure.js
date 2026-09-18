/* Une adresse qu'on accepte de poser dans un href.
 *
 * POURQUOI CE FICHIER. React échappe le texte, mais PAS les attributs href : `<a href={u}>` avec
 * u = « javascript:… » produit un lien qui exécute du script au clic. Plusieurs href de l'application
 * reçoivent une valeur qui ne vient pas de nous — le site d'un commerce (saisi par le restaurateur),
 * l'adresse trouvée par la recherche OpenStreetMap à l'inscription (modifiable par n'importe qui sur
 * OSM), l'adresse d'une carte à importer collée par un restaurateur et relue dans la console admin.
 *
 * Aujourd'hui rien de tout cela n'est exploitable, et c'est la Content-Security-Policy qui l'empêche :
 * `script-src 'self' …` sans `'unsafe-inline'` bloque l'exécution d'une URI « javascript: ». Mais la
 * CSP est alors le SEUL rempart, et elle vit dans vercel.json — un fichier de déploiement, pas de
 * code. Le jour où une ligne y est assouplie pour une raison sans rapport, la faille se rouvre en
 * silence, loin d'ici. Le contrôle appartient donc aussi à l'endroit qui pose le lien.
 *
 * Renvoie undefined plutôt qu'une chaîne vide quand l'adresse est refusée : un href absent rend un
 * <a> non cliquable, là où href="" rechargerait la page courante.
 */
const SCHEMAS_AUTORISES = ['http:', 'https:', 'mailto:', 'tel:'];

export default function urlSure(brut) {
  const s = String(brut || '').trim();
  if (!s) return undefined;
  // Adresse interne (« /restaurants », « #ancre ») : pas de schéma, donc rien à contrôler.
  if (s.startsWith('/') || s.startsWith('#')) return s;
  try {
    // base : permet de juger une adresse relative sans la rejeter, et impose un schéma connu au reste.
    const u = new URL(s, window.location.origin);
    return SCHEMAS_AUTORISES.includes(u.protocol) ? s : undefined;
  } catch {
    return undefined;
  }
}
