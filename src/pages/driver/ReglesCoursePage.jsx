import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import PageLivreur from '../../components/livreur/PageLivreur';
import { ATTENTE_COMPTOIR, ATTENTE_PORTE_MIN } from '../../conformite';
import { euros } from '../../prixPlat';

/* « ATTENTE, ANNULATIONS, DÉTOURS » (Owen, 12/11/2026). Un livreur écrivait : « je ne vois pas où sont reprises les
 * informations sur les temps d'attente ». Les règles existaient dans le code et le contrat, mais nulle part lisibles d'un coup
 * d'œil. Cette page les dit, en cinq blocs, avec les montants que le serveur applique (/couriers/options › pricing :
 * waiting et cancellationPay ; à défaut, les valeurs de conformite.js, qui reprennent celles du serveur) :
 *   - au commerce : attente payée après le délai de grâce, compteur arrêté par le « Prête » du commerce (attenteComptoir.js) ;
 *   - chez le client : 10 min et deux appels, puis « client absent », course payée en entier ;
 *   - annulation : déplacement payé avant le retrait, course entière après (annulationLivreur.js) ;
 *   - détour : changement d'adresse seulement avant le retrait, le prix le plus haut gardé (changementAdresse.js) ;
 *   - tarifs : son minimum à lui, et des tarifs réexaminés au moins tous les six mois (contrat 2026.10).
 * Pas de bouton d'action : il n'y a rien à faire ici, seulement à savoir. */
export default function ReglesCoursePage() {
  const { t } = useLanguage();
  const [tarifs, setTarifs] = useState(null);
  useEffect(() => { api('/couriers/options').then((o) => setTarifs(o?.pricing || null)).catch(() => {}); }, []);
  const at = tarifs?.waiting || ATTENTE_COMPTOIR;
  const deplacement = tarifs?.cancellationPay ?? (tarifs?.deliveryBaseFee ? tarifs.deliveryBaseFee * 0.9 : 5.22);
  const blocs = [
    ['commerce', { grace: at.graceMin, parMin: euros(at.perMinute), plafond: euros(at.cap) }],
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
          <h2 className="ecl-titre-sec">{t(`reglesCourse.${cle}T`)}</h2>
          <p>{t(`reglesCourse.${cle}`, valeurs)}</p>
        </section>
      ))}
    </PageLivreur>
  );
}
