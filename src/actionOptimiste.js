import { useCallback, useRef } from 'react';
import { useToast } from './context/ToastContext';

/* LE TOUCHER CHANGE L'ÉCRAN TOUT DE SUITE, LE SERVEUR SUIT (fondateur, 2026-10-23 : « app lente », des taps qui attendent le
 * serveur). Jusqu'ici un cœur, un « épuisé », une pause du commerce ou du livreur attendaient la réponse — souvent suivie
 * d'un rechargement complet — avant de bouger : 0,3 à 1,5 s en 4G pendant lesquelles le bouton restait gris ou affichait
 * « … », et on retouchait en croyant que rien ne s'était passé.
 *
 * `agir(cle, { appliquer, envoyer, annuler, confirmer, rafraichir })` :
 *   - `appliquer()` change l'écran MAINTENANT et rend l'état d'avant (ce qu'il faudra remettre) ;
 *   - `envoyer()` fait l'appel (api(...)) et promet la réponse ;
 *   - en cas d'échec, `annuler(etatAvant)` remet l'écran tel que le serveur le connaît, avec le toast rouge habituel
 *     (useToast()(err.message, 'erreur')) ;
 *   - `confirmer(reponse)` reçoit la réponse du serveur quand ce tap est le dernier (sa vérité remplace ce qu'on avait deviné) ;
 *   - `rafraichir()` (facultatif) relit en arrière-plan, UNE fois, quand plus aucune action de ce composant n'est en vol :
 *     une relecture lancée entre deux taps rapides montrerait un instant l'état d'avant le second.
 * Rend une promesse qui ne rejette jamais : { ok, reponse?, erreur?, depasse? } (`depasse` : un tap plus récent a pris la main).
 *
 * UNE CLÉ = UN RÉGLAGE dont chaque envoi porte la valeur ENTIÈRE (« favori : oui », « en rupture : non ») — jamais un
 * « bascule » relatif. C'est ce qui permet la règle « le dernier tap gagne » :
 *   - les envois d'une même clé partent L'UN APRÈS L'AUTRE, dans l'ordre des taps (deux requêtes parallèles peuvent arriver
 *     au serveur dans le désordre, et l'écran dirait « oui » quand le serveur garde « non ») ;
 *   - un tap encore en file quand un plus récent arrive n'est pas envoyé du tout : le plus récent le remplace ;
 *   - la réponse ou l'échec d'un tap dépassé ne touche pas l'écran ; seul le dernier décide. S'il échoue, l'écran revient
 *     à l'état que le serveur a vraiment (celui d'avant le premier tap de la rafale, ou après le dernier envoi réussi).
 *
 * Les boutons concernés ne sont JAMAIS désactivés pendant l'envoi : c'est tout l'intérêt. Ce qui doit rester confirmé par le
 * serveur avant de bouger (payer, pourboire, codes, refus ou annulation d'une commande, prise d'une course que d'autres
 * livreurs visent aussi…) n'utilise pas ce crochet. */
export function useActionOptimiste() {
  const toast = useToast();
  const files = useRef(new Map()); // cle → { dernier, sur, avant: Map(n → etatAvant), chaine, enVol }
  const enVolTotal = useRef(0);
  const relecture = useRef(null);

  return useCallback((cle, { appliquer, envoyer, annuler, confirmer, rafraichir } = {}) => {
    const etatAvant = appliquer ? appliquer() : undefined;
    let f = files.current.get(cle);
    // Premier tap d'une rafale : l'état d'avant est celui que le serveur connaît (`sur`).
    if (!f) { f = { dernier: 0, sur: etatAvant, avant: new Map(), chaine: Promise.resolve(), enVol: 0 }; files.current.set(cle, f); }
    const n = ++f.dernier;
    f.avant.set(n, etatAvant);
    f.enVol += 1;
    enVolTotal.current += 1;
    if (rafraichir) relecture.current = rafraichir;

    const tour = f.chaine.then(async () => {
      if (n !== f.dernier) return { ok: true, depasse: true }; // remplacé avant d'être parti : rien n'est envoyé
      try {
        const reponse = await envoyer();
        if (n === f.dernier) { confirmer?.(reponse); return { ok: true, reponse }; }
        // Réussi mais dépassé : le serveur est maintenant dans l'état que ce tap visait, soit l'« avant » du tap suivant.
        f.sur = f.avant.get(n + 1);
        return { ok: true, reponse, depasse: true };
      } catch (erreur) {
        if (n !== f.dernier) return { ok: false, erreur, depasse: true }; // le serveur n'a pas bougé : `sur` reste juste
        annuler?.(f.sur);
        toast(erreur?.message, 'erreur');
        return { ok: false, erreur };
      }
    }).finally(() => {
      f.avant.delete(n);
      f.enVol -= 1;
      if (!f.enVol && files.current.get(cle) === f) files.current.delete(cle);
      enVolTotal.current -= 1;
      if (!enVolTotal.current && relecture.current) {
        const relire = relecture.current;
        relecture.current = null;
        try { Promise.resolve(relire()).catch(() => {}); } catch { /* relecture de confort : le sondage régulier rattrapera */ }
      }
    });
    f.chaine = tour.catch(() => {});
    return tour;
  }, [toast]);
}
