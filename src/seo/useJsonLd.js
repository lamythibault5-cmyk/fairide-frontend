import { useEffect } from 'react';

/* Pose un bloc <script type="application/ld+json"> dans le <head>, et le retire au démontage.

   Un seul bloc par page, identifié par `id`, pour qu'une navigation vers une autre fiche
   remplace le précédent au lieu d'en empiler deux : deux blocs Restaurant contradictoires dans
   le même document et Google n'en retient aucun.

   L'injection a lieu après hydratation. Google exécute le JavaScript, donc les données
   structurées sont bien lues, simplement au second passage d'indexation. La Phase E déplacera
   le même JSON, produit par les mêmes fonctions, dans la réponse HTML initiale. */
export default function useJsonLd(data, id = 'ld-page') {
  useEffect(() => {
    if (!data) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    el.textContent = JSON.stringify(data);

    document.getElementById(id)?.remove();
    document.head.appendChild(el);

    return () => el.remove();
    // JSON.stringify comme dépendance : `data` est un objet recréé à chaque rendu, le comparer
    // par référence relancerait l'effet en boucle.
  }, [JSON.stringify(data), id]);
}
