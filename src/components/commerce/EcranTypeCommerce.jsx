import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { RESTAURANT_TYPES, restaurantTypeLabel } from '../../menuCategories';
import SousEcran from '../SousEcran';

/* Mon commerce › Type de commerce. UN SEUL TEMPS DEPUIS L'AUDIT DU 19/10 (shop-317).
 *
 * Avant : le nouveau type, puis « que faire de ta carte » (garder, ou remplacer par les plats types), puis un code reçu par
 * e-mail. Mais depuis le verrou de la carte (2026-10-01), « remplacer » ne faisait plus rien pour un commerce (MENU_LOCKED,
 * avalé) alors que l'écran disait « Type mis à jour » ; et le code, envoyé au commerce lui-même, ne protégeait plus rien :
 * changer de type ne touche qu'à l'affichage, comme « Autres types de cuisine ». Le serveur ne demande plus de code pour ce
 * geste (PATCH /cuisine). Pour changer de carte, le commerce passe par Ma carte › demande de modification. Les types sont
 * affichés dans la langue choisie (restaurantTypeLabel) ; la valeur envoyée reste la valeur française de la table. */
export default function EcranTypeCommerce({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const connu = RESTAURANT_TYPES.some((c) => c.value === restaurant.cuisine);
  const [type, setType] = useState(connu ? restaurant.cuisine : 'Autre');
  const [autre, setAutre] = useState(connu ? '' : (restaurant.cuisine || ''));
  const [enCours, setEnCours] = useState(false);

  async function confirmer() {
    if (enCours) return;
    const final = type === 'Autre' ? autre.trim() || 'Autre' : type;
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/cuisine`, { method: 'PATCH', token, body: { cuisine: final } });
      await loadDashboard(restoId);
      toast(t('editResto.toastTypeUpdated'), 'succes');
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
      setEnCours(false);
    }
  }

  const pied = (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={confirmer}>{enCours ? '…' : t('editResto.confirmChange')}</button>
  );

  return (
    <SousEcran titre={t('editResto.rowType')} onFermer={onFermer} pied={pied}>
      <div className="field">
        <label htmlFor={ids + '-type'}>{t('editResto.newType')}</label>
        <select id={ids + '-type'} value={type} onChange={(e) => setType(e.target.value)}>
          {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{restaurantTypeLabel(c.value, t)}</option>)}
        </select>
      </div>
      {type === 'Autre' && (
        <div className="field"><label htmlFor={ids + '-autre'}>{t('editResto.specifyType')}</label><input id={ids + '-autre'} value={autre} onChange={(e) => setAutre(e.target.value)} placeholder={t('editResto.phType')} /></div>
      )}
      <p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>{t('editResto.typeKeepsMenu')}</p>
    </SousEcran>
  );
}
