import { RESTAURANT_TYPES } from '../menuCategories';

/* VISUEL DE MARQUE quand un commerce n'a pas de photo (ou que sa photo ne charge pas).
   Un bloc gris ressemblait à une image cassée ; ici c'est un aplat Fairide — iris, iris pressé,
   lime ou gris doux, choisi d'après le nom pour que deux commerces voisins ne se ressemblent pas —
   avec la première lettre du nom en grand et l'emoji de sa cuisine. Aplats seulement, pas d'ombre
   (règles de la marque, voir client-ui.css). */
const PALETTES = 4;
export function paletteDe(nom) {
  let h = 0;
  for (const c of String(nom || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % PALETTES;
}

export default function VisuelVide({ nom, cuisine, className = '', taille = 'carte' }) {
  const emoji = RESTAURANT_TYPES.find((c) => c.value === cuisine)?.emoji;
  const initiale = String(nom || '').trim().charAt(0).toUpperCase();
  return (
    <span className={`visuel-vide visuel-vide--p${paletteDe(nom)} visuel-vide--${taille} ${className}`.trim()} aria-hidden="true">
      <span className="visuel-vide-cercle" />
      {initiale && <span className="visuel-vide-initiale">{initiale}</span>}
      {emoji && <span className="visuel-vide-emoji">{emoji}</span>}
    </span>
  );
}
