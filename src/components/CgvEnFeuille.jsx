import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { experienceApp } from '../natif';
import SousEcran from './SousEcran';
import { TexteCgv } from '../pages/legal/Terms';
import { TexteConfidentialite } from '../pages/legal/Privacy';

/* LE LIEN « CONDITIONS GÉNÉRALES » AU MOMENT D'ACCEPTER (2026-10-15).
 *
 * Sur le site, un nouvel onglet (on garde le formulaire ouvert). Dans l'application, un nouvel onglet n'existe pas : le
 * lien ouvrait le navigateur sur fairide.be — le site au milieu de l'app — ou quittait l'inscription / le paiement en
 * cours. Ici, les conditions s'ouvrent dans une feuille par-dessus l'écran, et l'on revient exactement où l'on était. */
export default function LienCgv({ children, cible = '_blank' }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  if (!experienceApp()) return <Link to="/cgv" target={cible === '_blank' ? '_blank' : undefined} rel="noopener">{children}</Link>;
  return (
    <>
      <button type="button" className="lien-bouton" onClick={() => setOuvert(true)}>{children}</button>
      {ouvert && <SousEcran titre={t('terms.pageTitle')} onFermer={() => setOuvert(false)}><TexteCgv /></SousEcran>}
    </>
  );
}

// Même chose pour la politique de confidentialité, montrée là où les données sont demandées (inscription, RGPD art. 13 ;
// audit du 18/10/2026).
export function LienConfidentialite({ children }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  if (!experienceApp()) return <Link to="/confidentialite" target="_blank" rel="noopener">{children}</Link>;
  return (
    <>
      <button type="button" className="lien-bouton" onClick={() => setOuvert(true)}>{children}</button>
      {ouvert && <SousEcran titre={t('privacy.title')} onFermer={() => setOuvert(false)}><TexteConfidentialite /></SousEcran>}
    </>
  );
}
