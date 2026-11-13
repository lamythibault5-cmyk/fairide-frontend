import { useLayoutEffect } from 'react';

/* SUR LE SITE, LA PHOTO D'UNE FICHE VA D'UN BORD À L'AUTRE DE LA ZONE DE LA PAGE (sorti de RestaurantMenu.jsx le 2026-11-12,
 * pour que le squelette de la fiche, SqueletteFiche, se pose exactement là où la fiche arrivera). La page est rendue dans la
 * colonne principale (.dashboard-main, connecté) ou dans le .wrap de 960px (visiteur), chacun avec sa marge intérieure : on
 * MESURE de combien sortir de chaque côté au lieu de recopier ces marges ici — elles changent avec la largeur de l'écran, et
 * vivent dans styles.css. Connecté : jusqu'aux bords de la colonne principale (la barre latérale reste à gauche) ; visiteur :
 * jusqu'aux bords de la fenêtre. Mesuré avant l'affichage (pas de saut), puis à chaque changement de taille. Le résultat est
 * posé sur l'élément en --fiche-bord-g / -d / -h, que ses marges négatives lisent (site-fiche.css, styles.css).
 * `actif` : faux dans l'app (la fiche y est déjà plein écran) ; `cle` : remesurer quand le contenu change (une autre fiche). */
export function useBordAbord(ref, actif, cle = null) {
  useLayoutEffect(() => {
    const racine = ref.current;
    if (!actif || !racine) return undefined;
    const zone = racine.closest('main');
    if (!zone) return undefined;
    const tableau = zone.classList.contains('dashboard-main');
    const cadre = tableau ? zone : (zone.parentElement || zone);
    // La place « naturelle » de la page = sa boîte actuelle plus les débords déjà appliqués. Pas la boîte de son parent : la
    // marge négative du haut fusionne avec celle du parent (même bord, ni padding ni bordure), qui remonte avec elle — la
    // mesure retombait à 0 au tour suivant, et la page sautait de 24px en boucle.
    const applique = (nom) => parseFloat(racine.style.getPropertyValue(nom)) || 0;
    function poser(nom, valeur) {
      const v = `${Math.max(0, Math.round(valeur))}px`;
      if (racine.style.getPropertyValue(nom) !== v) racine.style.setProperty(nom, v);
    }
    function mesurer() {
      const r = racine.getBoundingClientRect();
      const c = cadre.getBoundingClientRect();
      const gauche = r.left + applique('--fiche-bord-g');
      const droite = r.right - applique('--fiche-bord-d');
      const haut = r.top + applique('--fiche-bord-h');
      poser('--fiche-bord-g', tableau ? gauche - c.left : gauche);
      poser('--fiche-bord-d', tableau ? c.right - droite : document.documentElement.clientWidth - droite);
      poser('--fiche-bord-h', haut - c.top);
    }
    mesurer();
    window.addEventListener('resize', mesurer);
    const obs = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mesurer);
    obs?.observe(cadre);
    return () => { window.removeEventListener('resize', mesurer); obs?.disconnect(); };
  }, [ref, actif, cle]);
}
