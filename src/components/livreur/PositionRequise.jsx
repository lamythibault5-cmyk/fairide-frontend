import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import Icone from '../Icone';
import { demanderPosition, plateforme } from '../../natif';
import useEtatPosition from '../../hooks/useEtatPosition';

/* Bloque les courses disponibles tant que la position du livreur n'est pas autorisée (fondateur, 2026-10-11 : « ce qui
 * est vraiment impossible à vivre sans, il faut bloquer et redemander jusqu'à ce qu'ils disent oui »).
 *
 * POURQUOI LA POSITION, ET SEULEMENT ELLE. Sans elle, le client ne peut pas suivre sa livraison : c'est le seul cas où
 * une permission est indispensable au service. Les notifications ne peuvent PAS être exigées (règle 4.5.4 de l'App
 * Store : refus de l'application), et la position du client non plus (le code postal la remplace — règle 5.1.1).
 *
 * CE QUE ÇA NE CHANGE PAS. L'autorisation est demandée ; la position n'est toujours LUE que pendant une livraison
 * (politique de géolocalisation remise aux livreurs, backend docs/livreurs/politique-geolocalisation.md). Seule la liste
 * des courses est bloquée : le compte, les documents, les gains et la course déjà en main restent accessibles.
 *
 * QUAND (fondateur, 2026-10-21, décision 10) : jamais pendant l'inscription — l'écran « La position est indispensable pour
 * livrer » de l'inscription dans l'app est retiré (Bienvenue.jsx) —, mais juste avant que le livreur passe « Disponible » :
 * l'interrupteur du tableau de bord ouvre cette même explication avant de l'allumer (Dashboard.jsx, DemandePosition), et
 * la carte ci-dessous la montre à celui qui est déjà disponible (un compte livreur est disponible par défaut après sa
 * validation). C'est la même explication que l'ancien écran de l'inscription (textes appli.lvPos*), app et site.
 *
 * REDEMANDER. Tant que le système accepte de reposer la question, le bouton la repose. Quand il refuse pour de bon
 * (« denied »), seule la personne peut la rouvrir : on lui dit exactement où, et on revérifie à chaque retour dans
 * l'application (visibilitychange — natif.js le déclenche au retour au premier plan).
 *
 * `repli` (site sur un ordinateur, 2026-10-16) : ce qui s'affiche à la place de la demande. La colonne de droite du tableau
 * de bord (carte et détail de la course choisie) passe `repli={null}` : la demande est déjà dans la liste, à gauche, une
 * seule fois. */

/* L'EXPLICATION ET LE BOUTON, les mêmes partout où la position est demandée (carte au-dessus des courses, feuille de
 * l'interrupteur « Disponible »). `onAutorisee` est appelé quand le système a dit oui. Une position effectivement reçue
 * compte comme un oui : Safari sur iPhone peut répondre « prompt » à l'API Permissions même après avoir accepté. */
export function ExplicationPosition({ etat, verifier, onAutorisee, children }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [attente, setAttente] = useState(false);
  async function autoriser() {
    setAttente(true);
    const position = await demanderPosition();
    const nouvel = await verifier();
    setAttente(false);
    if (position || nouvel === 'granted') onAutorisee?.();
    else toast(t('dashDriver.posReqToujours'), 'erreur');
  }
  async function reverifier() {
    if ((await verifier()) === 'granted') onAutorisee?.();
  }
  const refuse = etat === 'denied';
  const p = plateforme();
  const consigne = p === 'ios' ? t('dashDriver.posReqIos') : p === 'android' ? t('dashDriver.posReqAndroid') : t('dashDriver.posReqWeb');
  return (
    <>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('appli.lvPosSub')}</p>
      <p className="small" style={{ margin: '0 0 8px' }}><Icone nom="horloge" taille={16} className="icone-texte" /> <b>{t('appli.lvPos1')}</b> · {t('appli.lvPos1S')}</p>
      <p className="small" style={{ margin: '0 0 12px' }}><Icone nom="apercu" taille={16} className="icone-texte" /> <b>{t('appli.lvPos2')}</b> · {t('appli.lvPos2S')}</p>
      {refuse && <p className="small" style={{ margin: '0 0 10px' }}>{t('dashDriver.posReqRefuse')}<br /><b>{consigne}</b></p>}
      {/* `children` : un second bouton à côté (« Pas maintenant » dans la feuille de l'interrupteur). */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn-teal" disabled={attente} onClick={refuse ? reverifier : autoriser}>
          {attente ? t('common.loading') : refuse ? t('dashDriver.posReqVerifier') : t('appli.lvPosBtn')}
        </button>
        {children}
      </div>
    </>
  );
}

export default function PositionRequise({ children, repli }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [etat, verifier] = useEtatPosition();
  // Oui reçu par le bouton de cette carte (voir ExplicationPosition : Safari peut continuer à répondre « prompt »).
  const [obtenue, setObtenue] = useState(false);

  const avecRepli = repli !== undefined;
  // Partage coupé dans Mon compte : même effet que l'autorisation refusée (le client ne verrait rien).
  if (user?.locationSharingEnabled === false) {
    if (avecRepli) return repli;
    return (
      <div className="card position-requise" role="alert">
        <b>{t('dashDriver.posReqTitre')}</b>
        <p className="small" style={{ margin: '6px 0 10px' }}>{t('dashDriver.posReqPartage')}</p>
        <Link to="/account" className="btn-teal" style={{ display: 'inline-block', padding: '10px 16px' }}>{t('dashDriver.posReqCompte')}</Link>
      </div>
    );
  }
  if (etat === 'granted' || obtenue) return children;
  if (etat === 'verification') return null;
  if (avecRepli) return repli;

  return (
    <div className="card position-requise" role="alert">
      <b>{t('appli.lvPosTitre')}</b>
      <ExplicationPosition etat={etat} verifier={verifier} onAutorisee={() => setObtenue(true)} />
    </div>
  );
}
