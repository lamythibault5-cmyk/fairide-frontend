import { useLanguage } from '../../context/LanguageContext';

// Le pied de chaque sous-écran de « Mon commerce » : un seul bouton, pleine largeur, 48px de haut —
// même gabarit que le pied des sous-écrans du paiement (Checkout.jsx).
export default function BoutonEnregistrer({ enCours, onClick }) {
  const { t } = useLanguage();
  return (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={onClick}>
      {enCours ? '…' : t('editResto.save')}
    </button>
  );
}
