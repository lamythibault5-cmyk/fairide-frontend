import { useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import SousEcran from '../SousEcran';
import OpeningHoursEditor from '../OpeningHoursEditor';
import BoutonEnregistrer from './BoutonEnregistrer';
import useEnregistrerCommerce from './useEnregistrerCommerce';

// Mon commerce › Horaires : les créneaux de la semaine. Au moins un créneau est exigé — le commerce
// n'est visible des clients que pendant ses horaires.
export default function EcranHoraires({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [horaires, setHoraires] = useState(restaurant.hours || null);
  const { enregistrer, enCours } = useEnregistrerCommerce({ restoId, loadDashboard, onFermer });

  function valider() {
    if (!horaires || !Object.values(horaires).some((creneaux) => Array.isArray(creneaux) && creneaux.length)) {
      toast(t('editResto.toastHoursRequired'));
      return;
    }
    enregistrer({ hours: horaires });
  }

  return (
    <SousEcran titre={t('editResto.openingHours')} onFermer={onFermer} pied={<BoutonEnregistrer enCours={enCours} onClick={valider} />}>
      <OpeningHoursEditor value={horaires} onChange={setHoraires} />
    </SousEcran>
  );
}
