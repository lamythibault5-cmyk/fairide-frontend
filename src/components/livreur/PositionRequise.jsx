import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { demanderPosition, etatPosition, plateforme } from '../../natif';

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
 * REDEMANDER. Tant que le système accepte de reposer la question, le bouton la repose. Quand il refuse pour de bon
 * (« denied »), seule la personne peut la rouvrir : on lui dit exactement où, et on revérifie à chaque retour dans
 * l'application (visibilitychange — natif.js le déclenche au retour au premier plan). */
export default function PositionRequise({ children }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [etat, setEtat] = useState('verification');
  const [attente, setAttente] = useState(false);

  const verifier = useCallback(async () => { setEtat(await etatPosition()); }, []);
  useEffect(() => {
    verifier();
    const auRetour = () => { if (document.visibilityState === 'visible') verifier(); };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', auRetour);
    return () => { document.removeEventListener('visibilitychange', auRetour); window.removeEventListener('focus', auRetour); };
  }, [verifier]);

  // Partage coupé dans Mon compte : même effet que l'autorisation refusée (le client ne verrait rien).
  if (user?.locationSharingEnabled === false) {
    return (
      <div className="card position-requise" role="alert">
        <b>{t('dashDriver.posReqTitre')}</b>
        <p className="small" style={{ margin: '6px 0 10px' }}>{t('dashDriver.posReqPartage')}</p>
        <Link to="/account" className="btn-teal" style={{ display: 'inline-block', padding: '10px 16px' }}>{t('dashDriver.posReqCompte')}</Link>
      </div>
    );
  }
  if (etat === 'granted') return children;
  if (etat === 'verification') return null;

  async function autoriser() {
    setAttente(true);
    await demanderPosition();
    const nouvel = await etatPosition();
    setAttente(false);
    setEtat(nouvel);
    if (nouvel !== 'granted') toast(t('dashDriver.posReqToujours'), 'erreur');
  }

  const refuse = etat === 'denied';
  const p = plateforme();
  const consigne = p === 'ios' ? t('dashDriver.posReqIos') : p === 'android' ? t('dashDriver.posReqAndroid') : t('dashDriver.posReqWeb');
  return (
    <div className="card position-requise" role="alert">
      <b>{t('dashDriver.posReqTitre')}</b>
      <p className="small" style={{ margin: '6px 0 10px' }}>{t('dashDriver.posReqTexte')}</p>
      {refuse && <p className="small" style={{ margin: '0 0 10px' }}>{t('dashDriver.posReqRefuse')}<br /><b>{consigne}</b></p>}
      <button type="button" className="btn-teal" disabled={attente} onClick={refuse ? verifier : autoriser}>
        {attente ? t('common.loading') : refuse ? t('dashDriver.posReqVerifier') : t('dashDriver.posReqBtn')}
      </button>
    </div>
  );
}
