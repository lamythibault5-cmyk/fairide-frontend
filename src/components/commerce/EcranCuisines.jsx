import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { RESTAURANT_TYPES, restaurantTypeLabel } from '../../menuCategories';
import SousEcran from '../SousEcran';

// Mon commerce › Autres types de cuisine (fondateur, 2026-09-30) : jusqu'à 7 types au total — le type principal
// (qui décide de la carte modèle, voir EcranTypeCommerce) et 6 autres. Ceux-ci ne touchent pas à la carte : ils
// servent à l'affichage et aux filtres de la liste, donc pas de code de validation (PATCH /:id/extra-cuisines).
export const MAX_CUISINES = 7;

export default function EcranCuisines({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const principal = restaurant.cuisine || '';
  const [choix, setChoix] = useState(() => (restaurant.extraCuisines || []).filter((c) => c !== principal));
  const [enCours, setEnCours] = useState(false);
  const plein = choix.length >= MAX_CUISINES - 1;

  function basculer(v) {
    setChoix((c) => (c.includes(v) ? c.filter((x) => x !== v) : c.length >= MAX_CUISINES - 1 ? c : [...c, v]));
  }
  async function enregistrer() {
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/extra-cuisines`, { method: 'PATCH', token, body: { cuisines: choix } });
      await loadDashboard?.(restoId);
      toast(t('editResto.cuisinesSaved'));
      onFermer();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  const pied = (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={enregistrer}>
      {enCours ? '…' : t('editResto.cuisinesSave')}
    </button>
  );
  return (
    <SousEcran titre={t('editResto.rowCuisines')} onFermer={onFermer} pied={pied}>
      <p className="small" style={{ marginTop: 0 }}>{t('editResto.cuisinesHelp', { main: restaurantTypeLabel(principal, t) || principal })}</p>
      <p className="small" style={{ fontWeight: 700 }}>{t('editResto.cuisinesCount', { n: choix.length + 1, max: MAX_CUISINES })}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label={t('editResto.rowCuisines')}>
        {RESTAURANT_TYPES.filter((c) => c.value !== principal && c.value !== 'Autre').map((c) => {
          const actif = choix.includes(c.value);
          return (
            <button key={c.value} type="button" className={`cuisine-chip${actif ? ' active' : ''}`} aria-pressed={actif} disabled={!actif && plein} onClick={() => basculer(c.value)}>
              <span className="emoji">{c.emoji}</span><span>{restaurantTypeLabel(c.value, t)}</span>
            </button>
          );
        })}
      </div>
      {plein && <p className="small" style={{ color: 'var(--ink-faint)' }}>{t('editResto.cuisinesMax', { max: MAX_CUISINES })}</p>}
    </SousEcran>
  );
}
