import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { cuisinesCommerce, regimesDe } from '../../specialites';
import SousEcran from '../SousEcran';
import ChoixSpecialites from './ChoixSpecialites';

/* Mon commerce › Ce que tu vends. LE MÊME ÉCRAN QU'À L'INSCRIPTION (fondateur, 2026-10-22, maquettes/categories-commerce :
 * « faire bien en sorte qu'ils puissent changer ça quand ils veulent dans les settings de la même manière »).
 *
 * Il remplace les deux réglages d'avant : « Type de commerce » (une liste déroulante, plus « Autre » à préciser) et
 * « Autres types de cuisine » (6 pastilles en plus). Les spécialités choisies, dans l'ordre : la première est le type
 * principal, les autres les types en plus, enregistrés en une fois (PATCH /:id/specialites).
 *
 * Aucun code demandé, et la carte ne change pas : changer de type ne touche qu'à l'affichage et aux filtres depuis le
 * verrou de la carte (audit du 19/10, shop-317). Pour changer de carte, le commerce passe par Ma carte › demande de
 * modification. */
export default function EcranTypeCommerce({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  // Un commerce encore en « Autre » (texte libre vide d'avant) n'a rien de choisi : il part d'une liste vide.
  const [valeurs, setValeurs] = useState(() => cuisinesCommerce(restaurant).filter((c) => c !== 'Autre'));
  const [erreur, setErreur] = useState(null);
  // Toute ta carte est… ? (RegimesCommerce.jsx) : enregistré avec les spécialités, seulement s'il a changé (PATCH /:id/diet).
  const regimesDepart = regimesDe(restaurant);
  const [regimes, setRegimes] = useState(regimesDepart);
  const [enCours, setEnCours] = useState(false);

  async function enregistrer() {
    if (enCours) return;
    if (!valeurs.length) { setErreur(t('specialites.aucune')); return; }
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/specialites`, { method: 'PATCH', token, body: { cuisines: valeurs } });
      if (JSON.stringify(regimes) !== JSON.stringify(regimesDepart)) await api(`/restaurants/${restoId}/diet`, { method: 'PATCH', token, body: regimes });
      await loadDashboard?.(restoId);
      toast(t('specialites.enregistre'), 'succes');
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
      setEnCours(false);
    }
  }

  const pied = (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={enregistrer}>{enCours ? '…' : t('specialites.enregistrer')}</button>
  );

  return (
    <SousEcran titre={t('specialites.groupe')} onFermer={onFermer} pied={pied}>
      <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{t('specialites.aideReglages')}</p>
      <ChoixSpecialites valeurs={valeurs} onChange={(v) => { setValeurs(v); setErreur(null); }} erreur={erreur} regimes={regimes} onRegimes={setRegimes} />
    </SousEcran>
  );
}
