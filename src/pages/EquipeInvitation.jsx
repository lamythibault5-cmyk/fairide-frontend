import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import Icone from '../components/Icone';
import { SkeletonCards } from '../components/Skeleton';
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
  const { user, token, refreshUser, changerRole, logout } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [invitation, setInvitation] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  // Échec réseau ou serveur : ce n'est pas « introuvable » (audit du 19/10, shop-409), on le dit et on propose de réessayer.
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  /* LE COMPTE CONNECTÉ EST LU AVEC LE LIEN (shop-409) : le serveur dit si l'invitation est pour lui (forYou) et s'il fait
     déjà partie de l'équipe (alreadyMember, y compris sur un lien déjà utilisé, qui disait « introuvable »). */
  function charger() {
    setErreur(null);
    api(`/restaurants/team/invitation/${encodeURIComponent(lien)}`, { token: token || undefined })
      .then((r) => { if (r && r.restaurantName) setInvitation(r); else setIntrouvable(true); })
      .catch((e) => { if (e.status === 404) setIntrouvable(true); else setErreur(e.message); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [lien, token]);

  /* La casquette « commerce » devient l'active avec les rôles RELUS (refreshUser), pas ceux du rendu d'avant : sinon elle
     était refusée, et le membre arrivait sur les commandes avec la barre d'onglets du client (audit du 19/10, shop-402).
     Le commerce rejoint s'ouvre directement (?resto=, shop-411), même quand le compte en a déjà un autre. */
  async function ouvrirCommandes(restaurantId) {
    let frais = null;
    try { frais = await refreshUser?.(); } catch { /* la session reste valable, la casquette arrivera au prochain chargement */ }
    changerRole?.('restaurant', frais?.roles);
    navigate(`/dashboard/orders${restaurantId ? `?resto=${encodeURIComponent(restaurantId)}` : ''}`, { replace: true });
  }
  async function rejoindre() {
    setEnvoi(true);
    try {
      const r = await api('/restaurants/team/accept', { method: 'POST', token, body: { token: lien } });
      toast(t('team.joined', { name: invitation.restaurantName }), 'succes');
      await ouvrirCommandes(r?.restaurantId || invitation.restaurantId);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  // Connecté avec un autre compte que celui invité : se déconnecter et revenir ici après la connexion du bon compte.
  function changerDeCompte() {
    logout?.();
    navigate('/login', { state: { from: location.pathname } });
  }

  if (erreur) {
    return (
      <div className="eg-invit">
        <div className="eg-invit-feuille">
          <p className="eg-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}</p>
          <div className="eg-invit-actions"><button type="button" className="eg-bouton-iris" onClick={charger}>{t('team.retry')}</button></div>
        </div>
      </div>
    );
  }
  if (!introuvable && !invitation) return <SkeletonCards count={1} />;
  const autreCompte = !!user && invitation && invitation.forYou === false && !invitation.alreadyMember;

  const retour = { from: location.pathname };
  return (
    <div className="eg-invit">
      <div className="eg-invit-bandeau">
        <p className="eg-invit-ctx"><Icone nom="personnes" taille={16} />{t('team.rowTitle')}</p>
        <h1 className="eg-invit-titre">{introuvable ? t('team.inviteNotFoundTitle') : t('team.inviteTitle', { name: invitation.restaurantName })}</h1>
        {!introuvable && invitation.emailHint && <p className="eg-invit-sous">{t('team.inviteFor', { email: invitation.emailHint })}</p>}
        <RouteCommande position={introuvable || invitation.expired ? 12 : 58} depart={0} />
      </div>
      <div className="eg-invit-feuille">
        {introuvable ? (
          <p className="eg-texte" style={{ margin: 0 }}>{t('team.inviteNotFoundText')}</p>
        ) : (
          <>
            <h2>{t('team.canTitle')}</h2>
            <ul className="eg-peut">
              {['can1', 'can2', 'can3'].map((k) => (
                <li key={k}><span aria-hidden="true"><Icone nom="valider" taille={14} /></span>{t(`team.${k}`)}</li>
              ))}
              <li className="eg-peut-pas"><span aria-hidden="true"><Icone nom="cadenas" taille={13} /></span>{t('team.cannot')}</li>
            </ul>
            {invitation.alreadyMember ? (
              <>
                <p className="eg-note"><Icone nom="valider" taille={18} />{t('team.alreadyMember', { name: invitation.restaurantName })}</p>
                <div className="eg-invit-actions">
                  <button type="button" className="btn-gold" onClick={() => ouvrirCommandes(invitation.restaurantId)}>{t('team.openOrders')}</button>
                </div>
              </>
            ) : invitation.expired ? (
              <p className="eg-note" role="alert"><Icone nom="horloge" taille={18} />{t('team.inviteExpired')}</p>
            ) : autreCompte ? (
              <>
                <p className="eg-note" role="alert"><Icone nom="personnes" taille={18} />{t('team.otherAccount', { me: user.email || '', email: invitation.emailHint })}</p>
                <div className="eg-invit-actions">
                  <button type="button" className="btn-gold" onClick={changerDeCompte}>{t('team.switchAccount')}</button>
                </div>
              </>
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
