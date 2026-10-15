import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getConsent, setConsent, onConsentChange } from '../consent';
import Icone from './Icone';

/* LE CONSENTEMENT DANS L'APPLICATION (2026-10-15) — remplace la carte « cookies » du site (CookieBanner.jsx).
 *
 * La carte noire en bas de l'écran, avec « Politique des cookies », était un morceau de site posé sur l'app : elle
 * couvrait la barre d'onglets au premier écran après l'accueil. Ici, un écran de l'accueil (.bv), comme l'amorce des
 * notifications. Ce qu'on demande ne change pas : l'outil de rapport d'erreurs (Sentry, voir main.jsx) ne démarre
 * qu'après « Accepter ». Les deux choix ont la même taille et le même poids (APD/GBA : refuser aussi simple
 * qu'accepter). L'inscription de l'application pose la question par une case (InscriptionAppli.jsx) : cet écran ne
 * vient donc que pour qui n'y est pas passé (connexion, choix effacé par « Gérer mes cookies » dans Mon compte).
 *
 * Sous l'amorce des notifications (z-index .bv, elle est en .bv-par-dessus) : on répond d'abord à elle. */
export default function ConsentementAppli() {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(() => !getConsent());
  useEffect(() => onConsentChange((v) => setOuvert(!v)), []);
  if (!ouvert) return null;
  return (
    <div className="bv" role="dialog" aria-modal="true" aria-labelledby="consentement-titre">
      <main className="bv-ecran">
        <span className="bv-tuile grande"><Icone nom="bouclier" taille={34} /></span>
        <h1 className="bv-titre" id="consentement-titre">{t('appli.consTitre')}</h1>
        <p className="bv-sous">{t('appli.consSous')}</p>
        <div className="bv-carte bv-fait">
          <span className="bv-tuile"><Icone nom="cadenas" taille={20} /></span>
          <div style={{ flex: 1 }}><b>{t('appli.consFait')}</b><span className="bv-petit">{t('appli.consFaitS')}</span></div>
        </div>
        <div className="bv-grandit" />
        {/* Même classe pour les deux : aucun des deux n'est « le bon ». */}
        <button type="button" className="bv-btn btn-outline" onClick={() => setConsent('accepted')}>{t('cookies.accept')}</button>
        <button type="button" className="bv-btn btn-outline" onClick={() => setConsent('refused')}>{t('cookies.refuse')}</button>
      </main>
    </div>
  );
}
