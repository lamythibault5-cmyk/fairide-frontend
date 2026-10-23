import { useEffect, useRef } from 'react';

/* Pose un bloc <script type="application/ld+json"> dans le <head>, et le retire au démontage.

   Un seul bloc par page, identifié par `id`, pour qu'une navigation vers une autre fiche
   remplace le précédent au lieu d'en empiler deux : deux blocs Restaurant contradictoires dans
   le même document et Google n'en retient aucun.

   L'injection a lieu après hydratation. Google exécute le JavaScript, donc les données
   structurées sont bien lues, simplement au second passage d'indexation. La Phase E déplacera
   le même JSON, produit par les mêmes fonctions, dans la réponse HTML initiale. */
export default function useJsonLd(data, id = 'ld-page') {
  // LE TEXTE N'EST REFAIT QUE SI L'OBJET CHANGE (2026-10-23, app iPhone lente). JSON.stringify servait de dépendance à chaque
  // rendu : sur une fiche, la carte entière (des dizaines de Ko) repassait en texte à chaque ajout au panier, chaque lettre
  // tapée dans la recherche, chaque tic de l'horloge. Les appelants passent maintenant un objet mémorisé (useMemo) pour les
  // gros blocs : même objet, même texte, rien à refaire. Un petit objet recréé à chaque rendu (fil d'Ariane) reste comparé
  // par son texte, comme avant.
  const memoire = useRef({ data: undefined, texte: null });
  if (memoire.current.data !== data) memoire.current = { data, texte: data ? JSON.stringify(data) : null };
  const texte = memoire.current.texte;

  useEffect(() => {
    if (!texte) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    el.textContent = texte;

    document.getElementById(id)?.remove();
    document.head.appendChild(el);

    return () => el.remove();
  }, [texte, id]);
}
