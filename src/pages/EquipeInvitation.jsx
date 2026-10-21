import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import Icone from '../components/Icone';
import { SkeletonCards } from '../components/Skeleton';
import ErreurChargement from '../components/ErreurChargement';
import { RouteCommande } from '../components/EcranCommande';
import '../ecran-equipe-groupe.css';

/* /equipe/:token — L'INVITATION DANS L'ÉQUIPE D'UN COMMERCE (15 oct. 2026 ; backend equipeCommerce.js).
 * Avant la connexion : le nom du commerce et un indice de l'adresse invitée, puis « Se connecter » ou « Créer mon compte »,
 * qui ramènent ici. Connecté : « Rejoindre l'équipe », avec le compte de l'adresse invitée seulement (le serveur refuse
 * les autres). Ensuite la casquette « commerce » devient l'active et la page des commandes s'ouvre.
 * Le dessin (2026-10-16, ecran-equipe-groupe.css) : un bandeau iris (« {commerce} t'invite dans son équipe », l'adresse
 * invitée, le vélo sur sa route), puis la feuille blanche : ce que tu pourras faire, ce que tu ne verras pas, et une seule
 * action lime. Le même écran dans l'app et sur le site, connecté ou non. */
export default function EquipeInvitation() {
  const { token: lien } = useParams();
  const { user, token, refreshUser, changerRole } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [invitation, setInvitation] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [echec, setEchec] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  // « Introuvable » seulement quand le serveur le dit (404) : une coupure réseau affichait « invitation introuvable » et
  // l'invité abandonnait un lien valable (audit du 19/10, CROSS-37). Sinon, l'écran d'erreur de chargement et Réessayer.
  const charger = () => {
    setEchec(false);
    api(`/restaurants/team/invitation/${encodeURIComponent(lien)}`)
      .then((r) => { if (r && r.restaurantName) setInvitation(r); else setIntrouvable(true); })
      .catch((e) => { if ([400, 404, 410].includes(e?.status)) setIntrouvable(true); else setEchec(true); });
  };
  useEffect(() => { charger(); }, [lien]); // eslint-disable-line react-hooks/exhaustive-deps

  async function rejoindre() {
    setEnvoi(true);
    try {
      await api('/restaurants/team/accept', { method: 'POST', token, body: { token: lien } });
      // Nouvelle casquette « commerce » : relue sur le compte avant d'en faire l'active.
      try { await refreshUser?.(); } catch { /* la session reste valable, la casquette arrivera au prochain chargement */ }
      changerRole?.('restaurant');
      toast(t('team.joined', { name: invitation.restaurantName }), 'succes');
      navigate('/dashboard/orders', { replace: true });
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }

  if (echec && !invitation) return <ErreurChargement onReessayer={charger} />;
  if (!introuvable && !invitation) return <SkeletonCards count={1} />;

  const retour = { from: location.pathname };
  return (
    <div className="eg-invit">
      <div className="eg-invit-bandeau">
        <p className="eg-invit-ctx"><Icone nom="personnes" taille={16} />{t('team.rowTitle')}</p>
        <h1 className="eg-invit-titre">{introuvable ? t('team.inviteNotFoundTitle') : t('team.inviteTitle', { name: invitation.restaurantName })}</h1>
        {!introuvable && <p className="eg-invit-sous">{t('team.inviteFor', { email: invitation.emailHint })}</p>}
        <RouteCommande position={introuvable || invitation.expired ? 12 : 58} depart={0} />
      </div>
      <div className="eg-invit-feuille">
        {introuvable ? (
          <>
            <p className="eg-texte" style={{ margin: 0 }}>{t('team.inviteNotFoundText')}</p>
            <div className="eg-invit-actions"><Link to="/" className="eg-bouton-iris">{t('notFound.backHome')}</Link></div>
          </>
        ) : (
          <>
            <h2>{t('team.canTitle')}</h2>
            <ul className="eg-peut">
              {['can1', 'can2', 'can3'].map((k) => (
                <li key={k}><span aria-hidden="true"><Icone nom="valider" taille={14} /></span>{t(`team.${k}`)}</li>
              ))}
              <li className="eg-peut-pas"><span aria-hidden="true"><Icone nom="cadenas" taille={13} /></span>{t('team.cannot')}</li>
            </ul>
            {invitation.expired ? (
              <p className="eg-note" role="alert"><Icone nom="horloge" taille={18} />{t('team.inviteExpired')}</p>
            ) : user ? (
              <div className="eg-invit-actions">
                <button type="button" className="btn-gold" disabled={envoi} onClick={rejoindre}>{envoi ? '…' : t('team.join')}</button>
              </div>
            ) : (
              <div className="eg-invit-actions">
                <Link to="/login" state={retour} className="btn-gold">{t('team.signIn')}</Link>
                <Link to="/login?audience=client" state={retour} className="eg-bouton-iris">{t('team.signUp')}</Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
