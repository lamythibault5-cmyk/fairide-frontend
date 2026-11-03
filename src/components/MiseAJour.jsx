import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage, getLanguage } from '../context/LanguageContext';
import { ouvrirLienExterne, suspendreRetourIos } from '../natif';
import useMiseAJour, { demarrerVerification, reporterMiseAJour } from '../miseAJour';
import { vibrer } from '../gestes';
import Icone from './Icone';
import LigneCompte from './LigneCompte';
import './miseAJour.css';

/* LA MISE À JOUR DES APPLIS (Owen, 2026-11-03, réponses à maquettes/mise-a-jour/mise-a-jour.html). L'état et ses règles
 * (minimum / conseillée, « Plus tard », jamais au milieu de quelque chose) sont dans src/miseAJour.js. Ici, ce qu'on voit :
 *   - D, OBLIGATOIRE : l'app floutée sous un voile iris, l'icône, le titre, le vélo qui roule sur sa route, une feuille de
 *     verre avec le seul bouton lime vers le store. Ni « Plus tard », ni croix, ni geste retour (le Retour d'Android ne trouve
 *     rien à fermer ici, le balayage iOS est coupé) ;
 *   - A, CONSEILLÉE : une notification de verre qui descend du haut, comme celles de l'iPhone. L'app reste utilisable
 *     dessous. Un toucher l'ouvre (« ce qui change », « Plus tard », « Mettre à jour ») ; glissée vers le haut = « Plus tard ».
 * La rangée de Mon compte (E) est RangeeMiseAJour, plus bas ; le point sur l'onglet Compte est dans DashboardSidebar.
 * Pas pendant le paiement : ni l'une ni l'autre ne s'ouvre sur ces écrans ; la notification attend aussi la fin de
 * l'accueil, de la connexion, du panier et d'une commande groupée. */
const PAUSE_PAIEMENT = ['/checkout', '/order-success', '/order-cancelled'];
const PAUSE_NOTIF = [...PAUSE_PAIEMENT, '/bienvenue', '/login', '/panier', '/groupe'];
const commencePar = (chemin, liste) => liste.some((p) => chemin === p || chemin.startsWith(`${p}/`));

function texteBouton(t, os) {
  return os === 'ios' ? t('miseAJour.boutonIos') : t('miseAJour.boutonAndroid');
}

function ouvrirStore(store) {
  vibrer('valider');
  ouvrirLienExterne(store);
}

function Velo() {
  return (
    <svg viewBox="-3 5 82 42" width="46" height="24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

function Obligatoire({ m }) {
  const { t } = useLanguage();
  // Le balayage retour d'iPhone est coupé tant que l'écran est là (comme pour une feuille, natif.js).
  useEffect(() => suspendreRetourIos(), []);
  return (
    <div className="maj-obligatoire" role="dialog" aria-modal="true" aria-labelledby="maj-titre">
      <div className="maj-haut">
        <img className="maj-icone" src="/icons/icon-192.png" width="88" height="88" alt="" />
        <h1 id="maj-titre" className="maj-titre">{t('miseAJour.titre')}</h1>
        <p className="maj-texte">{t('miseAJour.texte')}</p>
        <div className="maj-route" aria-hidden="true"><span className="maj-velo"><Velo /></span></div>
      </div>
      <div className="maj-feuille maj-verre">
        <button type="button" className="btn-gold maj-bouton" onClick={() => ouvrirStore(m.store)}>{texteBouton(t, m.os)}</button>
      </div>
    </div>
  );
}

function Notification({ m, onFermer }) {
  const { t } = useLanguage();
  const [ouverte, setOuverte] = useState(false);
  const [partie, setPartie] = useState(false);
  const glisse = useRef(null);
  const boite = useRef(null);
  const lignes = m.nouveautes?.[getLanguage()] || [];

  const plusTard = () => {
    setPartie(true);
    setTimeout(reporterMiseAJour, 320);
  };
  const mettreAJour = () => {
    ouvrirStore(m.store);
    onFermer();
  };

  // Glissée vers le haut = « Plus tard » ; vers le bas elle résiste. Un toucher sans mouvement l'ouvre ou la referme (le
  // clic de l'en-tête, clavier compris). Pas de setPointerCapture : le clic partirait du bloc entier, plus de l'en-tête ;
  // au doigt, le navigateur garde de lui-même le geste sur l'élément touché.
  const aGlisse = useRef(false);
  const debut = (e) => {
    if (e.target.closest('button:not(.maj-notif-tete)')) return;
    glisse.current = { y: e.clientY, bouge: false };
  };
  const deplace = (e) => {
    const g = glisse.current;
    if (!g) return;
    const dy = e.clientY - g.y;
    if (Math.abs(dy) > 6) g.bouge = true;
    if (boite.current) boite.current.style.transform = `translateY(${dy < 0 ? dy : dy * 0.25}px)`;
  };
  const fin = (e) => {
    const g = glisse.current;
    glisse.current = null;
    if (!g) return;
    if (boite.current) boite.current.style.transform = '';
    const dy = e.clientY - g.y;
    if (dy < -30) plusTard();
    if (g.bouge) { aGlisse.current = true; setTimeout(() => { aGlisse.current = false; }, 0); }
  };
  const basculer = () => { if (!aGlisse.current) setOuverte((o) => !o); };

  return (
    <div ref={boite} className={`maj-notif maj-verre${ouverte ? ' ouverte' : ''}${partie ? ' partie' : ''}`} role="dialog" aria-labelledby="maj-notif-titre"
      onPointerDown={debut} onPointerMove={deplace} onPointerUp={fin} onPointerCancel={fin}>
      <button type="button" className="maj-notif-tete" aria-expanded={ouverte} onClick={basculer}>
        <img className="maj-icone" src="/icons/icon-192.png" width="40" height="40" alt="" />
        <span className="maj-notif-txt">
          <b id="maj-notif-titre">{t('miseAJour.notifTitre')}<small>{t('miseAJour.notifQuand')}</small></b>
          <span>{lignes.length ? t('miseAJour.notifVoir') : t('miseAJour.notifToucher')}</span>
        </span>
      </button>
      <div className="maj-notif-plus"><div>
        <div className="maj-notif-dedans">
          {lignes.length > 0 && (
            <ul className="maj-nouveautes">
              {lignes.map((l) => <li key={l}><span className="maj-rond"><Icone nom="coche" taille={18} /></span>{l}</li>)}
            </ul>
          )}
          <div className="maj-notif-boutons">
            <button type="button" className="maj-bouton-verre" onClick={plusTard}>{t('miseAJour.plusTard')}</button>
            <button type="button" className="btn-gold" onClick={mettreAJour}>{t('miseAJour.mettreAJour')}</button>
          </div>
        </div>
      </div></div>
      <span className="maj-poignee" aria-hidden="true" />
    </div>
  );
}

export default function MiseAJour() {
  const m = useMiseAJour();
  const { pathname } = useLocation();
  // Touché « Mettre à jour » sans revenir à jour (store fermé) : la notification ne revient qu'à la prochaine ouverture.
  const [fermee, setFermee] = useState(false);
  useEffect(() => { demarrerVerification(); }, []);
  useEffect(() => { if (m.cible) setFermee(false); }, [m.cible]);

  if (!m.niveau || m.occupe || commencePar(pathname, PAUSE_PAIEMENT)) return null;
  if (m.niveau === 'obligatoire') return <Obligatoire m={m} />;
  if (m.reportee || fermee || commencePar(pathname, PAUSE_NOTIF)) return null;
  return <Notification key={m.cible} m={m} onFermer={() => setFermee(true)} />;
}

// E : en tête de Mon compte tant que l'app n'est pas à jour, « Plus tard » ou pas (réponse 5).
export function RangeeMiseAJour() {
  const { t } = useLanguage();
  const m = useMiseAJour();
  if (!m.niveau) return null;
  return (
    <div className="card account-groupe maj-rangee">
      <LigneCompte icone="telecharger" titre={t('miseAJour.rangeeTitre')} sous={texteBouton(t, m.os)} onClick={() => ouvrirStore(m.store)} />
    </div>
  );
}
