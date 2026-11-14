import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import PageLivreur from '../../components/livreur/PageLivreur';
import { ATTENTE_PORTE_MIN } from '../../conformite';
import useAttentePayee from '../../attentePayee';
import { euros } from '../../prixPlat';

/* « ATTENTE, ANNULATIONS, DÉTOURS » (Owen, 12/11/2026). Un livreur écrivait : « je ne vois pas où sont reprises les
 * informations sur les temps d'attente ». Les règles existaient dans le code et le contrat, mais nulle part lisibles d'un coup
 * d'œil. Cette page les dit, en cinq blocs, avec les montants que le serveur applique (/couriers/options › pricing :
 * waiting et cancellationPay) :
 *   - au commerce : L'ATTENTE PAYÉE EST EN PAUSE (Owen, 14/11/2026 ; src/attentePayee.js) : le bloc dit seulement que
 *     « J'attends au commerce » prévient le commerce et qu'on peut rendre la course (reglesCourse.commerceSansPaie). Quand le
 *     serveur la dit active : attente payée après le délai de grâce, compteur arrêté par le « Prête » du commerce
 *     (attenteComptoir.js), aux montants du serveur, jamais d'une constante d'ici (reglesCourse.commerce) ;
 *   - chez le client : 10 min et deux appels, puis « client absent », course payée en entier ;
 *   - annulation : déplacement payé avant le retrait, course entière après (annulationLivreur.js) ;
 *   - détour : changement d'adresse seulement avant le retrait, le prix le plus haut gardé (changementAdresse.js) ;
 *   - tarifs : son minimum à lui, et des tarifs réexaminés au moins tous les six mois (contrat, depuis 2026.10).
 * Pas de bouton d'action : il n'y a rien à faire ici, seulement à savoir. */
export default function ReglesCoursePage() {
  const { t } = useLanguage();
  const [tarifs, setTarifs] = useState(null);
  useEffect(() => { api('/couriers/options').then((o) => setTarifs(o?.pricing || null)).catch(() => {}); }, []);
  const at = useAttentePayee();
  const deplacement = tarifs?.cancellationPay ?? (tarifs?.deliveryBaseFee ? tarifs.deliveryBaseFee * 0.9 : 5.22);
  const blocs = [
    at ? ['commerce', { grace: at.graceMin, parMin: euros(at.perMinute), plafond: euros(at.cap) }] : ['commerceSansPaie', {}],
    ['client', { min: ATTENTE_PORTE_MIN }],
    ['annul', { deplacement: euros(deplacement) }],
    ['detour', {}],
    ['tarif', {}],
    ['autre', {}]
  ];
  return (
    <PageLivreur classe="ecl-regles-course" bandeauApp retourCompte titre={t('reglesCourse.titre')} sous={t('reglesCourse.sous')}>
      {blocs.map(([cle, valeurs]) => (
        <section key={cle} className="ecl-regles-bloc">
          <h2 className="ecl-titre-sec">{t(`reglesCourse.${cle === 'commerceSansPaie' ? 'commerce' : cle}T`)}</h2>
          <p>{t(`reglesCourse.${cle}`, valeurs)}</p>
        </section>
      ))}
    </PageLivreur>
  );
}
