import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

/* Bandeau « Ta carte attend ta validation » (CODE-3, DEC-25), en haut de tout l'espace commerce — donc aussi sur le
 * terminal, qui affiche cet espace en permanence. Un seul bouton : il fabrique un lien de validation pour le
 * propriétaire (POST /restaurants/:id/menu-validation-link) et ouvre la page « C'est bon » (/carte/valider/:token),
 * la même que celle envoyée par SMS ou WhatsApp. Une seule page de validation, quel que soit le chemin.
 * Rien pour un commerce vitrine (il ne vend pas), ni pour une démo, ni tant que la carte est vide. */
export default function CarteAValider({ restaurant, restoId, token }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  if (!restaurant || restaurant.menuSigned || restaurant.isDemo || restaurant.vitrine || !(restaurant.menu || []).length) return null;
  async function ouvrir() {
    setEnCours(true); setErreur('');
    try {
      const l = await api(`/restaurants/${restoId}/menu-validation-link`, { method: 'POST', token });
      navigate(`/carte/valider/${l.token}`);
    } catch (e) { setErreur(e.message); } finally { setEnCours(false); }
  }
  return (
    <div className="agir-bandeau" role="status">
      <span>{t('validerCarte.bannerText')}</span>
      <button type="button" className="btn-teal" onClick={ouvrir} disabled={enCours}>{t('validerCarte.bannerButton')}</button>
      {erreur && <span className="small" style={{ color: 'var(--red)' }}>{erreur}</span>}
    </div>
  );
}
