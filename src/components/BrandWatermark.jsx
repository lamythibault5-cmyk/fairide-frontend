import BrandMark from './BrandMark';

// Petit repère "Fairide" fixé en haut à droite de l'écran, sur toutes les pages et pour tous les rôles
// (client, restaurateur, livreur, admin) — utile pour la création de contenu (capture/partage d'écran) :
// la marque reste identifiable même sur une page qui n'affiche pas le grand logo du header public
// (c'est le cas de presque tout le site une fois connecté, voir Layout.jsx/DashboardSidebar.jsx qui
// masque son propre logo sous 900px de large). Non cliquable et imperméable aux clics (pointer-events:
// none) : jamais un obstacle aux vrais boutons de la page, juste un filigrane visuel.
export default function BrandWatermark() {
  return (
    <div className="brand-watermark" aria-hidden="true">
      <BrandMark size={18} />
      <span>fairide</span>
    </div>
  );
}
