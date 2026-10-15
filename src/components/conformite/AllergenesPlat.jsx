import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { CODES_ALLERGENES } from '../../allergenes';

/* Déclarer les allergènes d'UN plat, depuis « Ma carte et mes engagements » (audit UX du 15/10/2026).
 *
 * La carte est verrouillée (MENU_LOCKED) et sa signature refusée tant qu'un plat n'a pas ses allergènes : le commerce
 * restait bloqué, sans rien pouvoir corriger lui-même. Le serveur lui ouvre maintenant cette seule porte
 * (PATCH /restaurants/:id/menu/:itemId/allergens, comme le taux de TVA) ; c'est lui qui en répond, il les signe ensuite.
 * Même choix que l'éditeur de plat (ChampsConformitePlat) : les 14 allergènes, OU « aucun des 14 ». */
export default function AllergenesPlat({ restoId, token, plat, onEnregistre }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [ouvert, setOuvert] = useState(false);
  const [codes, setCodes] = useState(() => new Set());
  const [aucun, setAucun] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const basculer = (c) => {
    setCodes((prev) => { const n = new Set(prev); if (n.has(c)) n.delete(c); else n.add(c); return n; });
    setAucun(false);
  };

  async function enregistrer() {
    setOccupe(true);
    try {
      await api(`/restaurants/${restoId}/menu/${plat.itemId}/allergens`, { method: 'PATCH', token, body: { allergens: [...codes].sort((a, b) => a - b), allergensDeclaredNone: aucun && codes.size === 0 } });
      toast(t('conformite.dishAllergensSaved', { name: plat.name }), 'succes');
      setOuvert(false);
      onEnregistre?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  if (!ouvert) {
    return <button type="button" className="btn-outline btn-sm" style={{ marginLeft: 6 }} onClick={() => setOuvert(true)}>{t('conformite.dishAllergensDeclare')}</button>;
  }
  return (
    <div className="allergenes-plat">
      <div className="grille-allergenes">
        {CODES_ALLERGENES.map((c) => (
          <label key={c} className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={codes.has(c)} onChange={() => basculer(c)} />
            <span className="small">{t(`conformite.allergen${c}`)}</span>
          </label>
        ))}
      </div>
      <label className="row" style={{ gap: 6, cursor: 'pointer', marginTop: 6 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={aucun && codes.size === 0} onChange={(e) => { setAucun(e.target.checked); if (e.target.checked) setCodes(new Set()); }} />
        <span className="small">{t('conformite.dishAllergensNone')}</span>
      </label>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-teal btn-sm" disabled={occupe || (codes.size === 0 && !aucun)} onClick={enregistrer}>{occupe ? '…' : t('conformite.dishAllergensSave')}</button>
        <button type="button" className="btn-ghost btn-sm" disabled={occupe} onClick={() => setOuvert(false)}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
