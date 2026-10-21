import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { appleDisponible, prechaufferConnexion } from '../natif';

/* « Continuer avec Apple » / « Continuer avec Google », DANS L'APPLICATION seulement (estNatif()).
 *
 * Sur fairide.be, c'est le bouton officiel de Google (googleSignIn.js) qui s'affiche ; dans l'application il ne
 * fonctionne pas (Google refuse les WebView), d'où ces deux boutons qui ouvrent la feuille native du téléphone
 * (natif.js, connexionFournisseur). Utilisé par la page de connexion (Auth.jsx) et par l'accueil de
 * l'application (pages/app/Bienvenue.jsx).
 *
 * APPLE EN PREMIER, ET SEULEMENT SUR IPHONE : règle 4.8 de l'App Store (proposé à côté de Google, à égalité de
 * place) et recommandations d'Apple pour son bouton — fond noir, logo Apple, libellé « Continuer avec Apple ».
 * Le « G » garde ses quatre couleurs : ce sont les règles de marque de Google, et ce n'est pas un fond de page,
 * donc la règle des deux couleurs de l'identité ne s'y applique pas. */

export function LogoApple({ taille = 18 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M16.37 12.62c-.02-2.27 1.86-3.36 1.94-3.41-1.06-1.55-2.71-1.76-3.29-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.25-1.59 2.75-.41 6.81 1.13 9.04.76 1.09 1.66 2.31 2.84 2.27 1.14-.05 1.57-.74 2.95-.74 1.37 0 1.76.74 2.96.71 1.23-.02 2-1.11 2.74-2.21.87-1.26 1.22-2.49 1.24-2.55-.03-.01-2.37-.91-2.4-3.62ZM14.11 5.95c.63-.76 1.05-1.82.93-2.88-.9.04-2 .6-2.65 1.36-.58.67-1.09 1.75-.95 2.79 1.01.08 2.03-.51 2.67-1.27Z" />
    </svg>
  );
}

export function LogoGoogle({ taille = 18 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
    </svg>
  );
}

// `onChoix('apple' | 'google')` : à l'appelant d'ouvrir la feuille native et de traiter le jeton.
//
// LE BOUTON TOUCHÉ DIT QU'IL TRAVAILLE (2026-10-21, latence de l'app). Avant, les deux boutons grisaient, puis plus rien
// pendant la feuille de Google, la vérification du serveur et l'arrivée sur la page : on retouchait, ou on croyait l'app
// figée. Tant que l'appelant garde `disabled`, le bouton choisi reste plein, avec une roue et « Connexion… ».
export default function BoutonsConnexionNative({ onChoix, disabled = false }) {
  const { t } = useLanguage();
  const [choisi, setChoisi] = useState(null);
  // Fin de l'attente (annulé, erreur) : on oublie le choix — sans effet, à la manière recommandée par React.
  const [attenteVue, setAttenteVue] = useState(disabled);
  if (attenteVue !== disabled) {
    setAttenteVue(disabled);
    if (!disabled) setChoisi(null);
  }
  useEffect(() => { prechaufferConnexion(); }, []);
  const choisir = (fournisseur) => { setChoisi(fournisseur); onChoix(fournisseur); };
  const contenu = (fournisseur, logo, libelle) => (disabled && choisi === fournisseur
    ? <><span className="btn-connexion-roue" aria-hidden="true" />{t('appli.connexionEnCours')}</>
    : <>{logo} {libelle}</>);
  return (
    <div className="connexion-native">
      {appleDisponible() && (
        <button type="button" className={`btn-connexion btn-connexion-apple${disabled && choisi === 'apple' ? ' en-cours' : ''}`} disabled={disabled}
          aria-busy={disabled && choisi === 'apple'} onClick={() => choisir('apple')}>
          {contenu('apple', <LogoApple />, t('appli.continueApple'))}
        </button>
      )}
      <button type="button" className={`btn-connexion btn-connexion-google${disabled && choisi === 'google' ? ' en-cours' : ''}`} disabled={disabled}
        aria-busy={disabled && choisi === 'google'} onClick={() => choisir('google')}>
        {contenu('google', <LogoGoogle />, t('appli.continueGoogle'))}
      </button>
    </div>
  );
}
