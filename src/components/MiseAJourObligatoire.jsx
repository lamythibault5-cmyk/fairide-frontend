import { useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { estNatif, plateforme, ouvrirLienExterne, suspendreRetourIos } from '../natif';
import './miseAJour.css';

/* MISE À JOUR OBLIGATOIRE (Owen, 2026-11-03 : « quand il faut, ils doivent mettre à jour », comme les autres applis).
 *
 * L'application embarque une copie figée des écrans (Capacitor, webDir dist) : une vieille version continue d'appeler le
 * serveur d'aujourd'hui avec ses écrans d'hier — le 03/11, un livreur sur la version Play du 27/10 ne pouvait plus saisir sa
 * date de naissance. Au démarrage et à chaque retour au premier plan (natif.js relaie appStateChange en visibilitychange),
 * l'app lit le plus petit build encore accepté pour sa plate-forme (GET /app/min-version, réglé dans Admin › Conformité ›
 * Paramètres) et le compare à son propre build (App.getInfo). En dessous : un seul écran, « Mets à jour Fairride », et un
 * bouton vers le store. Ni onglets, ni geste retour (le Retour d'Android ne trouve rien à fermer ici, le balayage iOS est
 * coupé). Le site n'est jamais concerné.
 *
 * TOUJOURS DU CÔTÉ OUVERT : sans réponse du serveur, sans numéro de build lisible ou sur une plate-forme inconnue, rien ne
 * bloque — une panne ne doit jamais empêcher quelqu'un de commander ou de livrer. */
const STORE_PAR_DEFAUT = {
  android: 'https://play.google.com/store/apps/details?id=be.fairide.app',
  ios: 'https://apps.apple.com/be/app/id6826197340'
};

async function buildInstalle() {
  try {
    const { App } = await import('@capacitor/app');
    const n = Number((await App.getInfo())?.build);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch { return null; }
}

export default function MiseAJourObligatoire() {
  const { t } = useLanguage();
  const [store, setStore] = useState(null); // adresse du store quand la mise à jour est exigée, sinon null

  useEffect(() => {
    if (!estNatif()) return undefined;
    const os = plateforme();
    if (os !== 'android' && os !== 'ios') return undefined;
    let vivant = true;
    const verifier = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const [build, min] = await Promise.all([buildInstalle(), api('/app/min-version', { logoutOn401: false })]);
        const minimum = Number(min?.[os]) || 0;
        if (!vivant || !build || !minimum) return;
        setStore(build < minimum ? (min?.storeUrls?.[os] || STORE_PAR_DEFAUT[os]) : null);
      } catch { /* serveur muet : on ne bloque pas */ }
    };
    verifier();
    document.addEventListener('visibilitychange', verifier);
    return () => { vivant = false; document.removeEventListener('visibilitychange', verifier); };
  }, []);

  // Le balayage retour d'iPhone est coupé tant que l'écran est là (comme pour une feuille, natif.js).
  useEffect(() => (store ? suspendreRetourIos() : undefined), [store]);

  if (!store) return null;
  return (
    <div className="maj-obligatoire" role="dialog" aria-modal="true" aria-labelledby="maj-titre">
      <div className="maj-bandeau">
        <div className="maj-route" aria-hidden="true">
          <span className="maj-velo">
            <svg viewBox="-3 5 82 42" width="40" height="21" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
              <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
            </svg>
          </span>
        </div>
        <h1 id="maj-titre" className="maj-titre">{t('miseAJour.titre')}</h1>
      </div>
      <div className="maj-feuille">
        <p className="maj-texte">{t('miseAJour.texte')}</p>
        <div className="maj-grandit" />
        <button type="button" className="btn-gold maj-bouton" onClick={() => ouvrirLienExterne(store)}>{t('miseAJour.bouton')}</button>
      </div>
    </div>
  );
}
