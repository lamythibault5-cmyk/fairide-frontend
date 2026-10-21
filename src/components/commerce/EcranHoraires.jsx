import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import OpeningHoursEditor from '../OpeningHoursEditor';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';

// Mon commerce › Horaires : les créneaux de la semaine. Au moins un créneau est exigé — les clients ne peuvent commander
// que pendant ces créneaux (le commerce reste dans la liste en dehors, marqué fermé : audit du 19/10, shop-323).
export default function EcranHoraires({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [horaires, setHoraires] = useState(restaurant.hours || null);
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  function valider() {
    if (!horaires || !Object.values(horaires).some((creneaux) => Array.isArray(creneaux) && creneaux.length)) {
      toast(t('editResto.toastHoursRequired'), 'erreur');
      return;
    }
    // Une heure vidée : on le dit ici, sous le créneau en rouge (OpeningHoursEditor), plutôt que le message du serveur
    // « indique au moins un jour » (audit du 19/10, shop-313).
    if (Object.values(horaires).some((creneaux) => Array.isArray(creneaux) && creneaux.some((c) => !c?.open || !c?.close))) {
      toast(t('editResto.toastHoursMissingTime'), 'erreur');
      return;
    }
    enregistrer({ hours: horaires });
  }

  return (
    <SousEcran titre={t('editResto.openingHours')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}
      modifie={JSON.stringify(horaires || null) !== JSON.stringify(restaurant.hours || null)}>
      <OpeningHoursEditor value={horaires} onChange={setHoraires} />
    </SousEcran>
  );
}
