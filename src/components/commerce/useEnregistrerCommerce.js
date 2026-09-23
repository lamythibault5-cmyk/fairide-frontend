import { useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

// Enregistrement d'un sous-écran de « Mon commerce » : un PATCH qui ne porte QUE les champs de ce
// sous-écran, puis relecture du tableau de bord et fermeture.
//
// Pourquoi un envoi partiel plutôt que tout le commerce comme avant : l'ancien formulaire unique
// renvoyait ses 25 champs à chaque clic sur Enregistrer, et refusait donc de sauver un simple changement
// d'horaires tant que le n° de TVA n'était pas rempli. Le serveur accepte un corps partiel (chaque champ
// n'est écrit que s'il est présent, voir PATCH /restaurants/:id) ; chaque écran ne valide donc que ce
// qu'il montre.
export default function useEnregistrerCommerce({ restoId, loadDashboard, onFermer }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(body) {
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}`, { method: 'PATCH', token, body });
      await loadDashboard(restoId);
      toast(t('editResto.toastUpdated'));
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  return { enregistrer, enCours };
}
