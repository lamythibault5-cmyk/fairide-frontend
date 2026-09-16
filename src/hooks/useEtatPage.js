import { useCallback, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/* useState QUI SURVIT À UN RAFRAÎCHISSEMENT (F5) — et à un retour sur la page dans le même onglet.
 *
 * POURQUOI. Un filtre, un onglet ou une recherche vivaient dans un simple useState : au moindre F5, la
 * page repartait de son état par défaut. L'admin qui regardait « vrais comptes » se retrouvait sur « tous
 * les comptes », et il fallait refaire les mêmes clics. La position de défilement, elle, était déjà
 * restaurée (voir ScrollRestorer.jsx) : on la complète ici par l'état de la page.
 *
 * OÙ. sessionStorage, propre à l'ONGLET : rouvrir le site plus tard part d'une page propre, mais tant que
 * l'onglet vit, recharger ne perd rien. Clé = adresse de la page + nom donné ici, donc deux listes
 * différentes ne se marchent pas dessus.
 *
 * `forcer` sert aux états qui viennent de l'ADRESSE ou d'un lien (`?status=open`, presetSearch) : ce que
 * demande le lien l'emporte sur ce qui était mémorisé, sinon un lien ciblé ouvrirait la page sur l'ancien
 * filtre. Les filtres déjà portés par l'adresse (useSearchParams) n'ont pas besoin de ce hook : ils
 * survivent au rafraîchissement par l'adresse elle-même.
 */
const PREFIXE = 'fairide_ui:';

function lire(cle) {
  try {
    const brut = sessionStorage.getItem(cle);
    return brut === null ? undefined : JSON.parse(brut);
  } catch { return undefined; }
}

export default function useEtatPage(nom, initial, { forcer = false } = {}) {
  const { pathname } = useLocation();
  const cle = `${PREFIXE}${pathname}:${nom}`;
  const cleRef = useRef(cle);
  cleRef.current = cle;
  const [valeur, setValeur] = useState(() => {
    const defaut = typeof initial === 'function' ? initial() : initial;
    if (forcer) return defaut;
    const memorisee = lire(cle);
    return memorisee === undefined ? defaut : memorisee;
  });
  const changer = useCallback((maj) => {
    setValeur((precedente) => {
      const suivante = typeof maj === 'function' ? maj(precedente) : maj;
      try { sessionStorage.setItem(cleRef.current, JSON.stringify(suivante)); } catch { /* sans stockage */ }
      return suivante;
    });
  }, []);
  return [valeur, changer];
}
