import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { paiementEnLigneOuvert, useLancement } from '../../launch';
import Icone from '../../components/Icone';
import { SkeletonCards } from '../../components/Skeleton';
import { RouteCommande } from '../../components/EcranCommande';
import { eurosRond, MONTANT_BIENVENUE } from '../../components/CodeAmi';
import ProtectedRoute from '../../components/ProtectedRoute';
import CommandeGroupee from './CommandeGroupee';
import '../../ecran-equipe-groupe.css';

/* /groupe/:code SANS COMPTE — L'INVITATION À UNE COMMANDE GROUPÉE (fondateur, 2026-11-08, maquettes/bienvenue-partage).
 * L'ami qui ouvrait le lien sans compte tombait sur « Content de te revoir » sans un mot sur le groupe. Il voit d'abord qui
 * l'invite, chez qui, combien sont déjà là, et que son crédit de bienvenue l'attend pour SA première commande (l'hôte paie
 * celle-ci) ; puis « Rejoindre le groupe » (inscription) ou « J'ai déjà un compte », qui ramènent ici. Le serveur ne donne
 * que ça (GET /group-orders/:code/invitation) : ni les plats, ni les prénoms des autres. Même dessin que l'invitation dans
 * l'équipe d'un commerce (EquipeInvitation.jsx) : bandeau iris, vélo sur sa route, feuille blanche, une action lime.
 * Le lien s'ouvre dans l'app quand l'ami l'a (liens d'application /groupe) ; sinon sur le site, sans écran d'accueil. */
export function InvitationGroupe() {
  const { code } = useParams();
  const { t } = useLanguage();
  const location = useLocation();
  useLancement();
  const [invitation, setInvitation] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState(null);

  function charger() {
    setErreur(null);
    api(`/group-orders/${encodeURIComponent(code)}/invitation`)
      .then((r) => { if (r && r.code) setInvitation(r); else setIntrouvable(true); })
      .catch((e) => { if ([400, 404].includes(e?.status)) setIntrouvable(true); else setErreur(e.message); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [code]);

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
  const ouvert = !introuvable && ['open', 'locked'].includes(invitation.status);
  const r = invitation?.restaurant;
  const retour = { from: location.pathname };
  return (
    <div className="eg-invit">
      <div className="eg-invit-bandeau">
        <p className="eg-invit-ctx"><Icone nom="personnes" taille={16} />{t('groupOrder.start')}</p>
        <h1 className="eg-invit-titre">{introuvable ? t('groupOrder.notFound') : t('groupOrder.invitationTitre', { name: invitation.hostFirstName })}</h1>
        {r && <p className="eg-invit-sous">{r.commune ? `${r.name} · ${r.commune}` : r.name}</p>}
        <RouteCommande position={ouvert ? 58 : 12} depart={0} />
      </div>
      <div className="eg-invit-feuille">
        {!ouvert ? (
          <>
            <p className="eg-note" role="status"><Icone nom="horloge" taille={18} />{introuvable ? t('groupOrder.notFound') : t('groupOrder.ended')}</p>
            <div className="eg-invit-actions">
              {r?.slug || r?.id ? <Link to={`/restaurants/${r.slug || r.id}`} className="eg-bouton-iris">{t('groupOrder.invitationVoirCarte', { name: r.name })}</Link>
                : <Link to="/" className="eg-bouton-iris">{t('notFound.backHome')}</Link>}
            </div>
          </>
        ) : (
          <>
            <ul className="eg-peut">
              <li><span aria-hidden="true"><Icone nom="valider" taille={14} /></span>{t('groupOrder.invitationChoisis')}</li>
              <li><span aria-hidden="true"><Icone nom="valider" taille={14} /></span>{t('groupOrder.invitationPaie', { name: invitation.hostFirstName })}</li>
              {invitation.participants > 0 && (
                <li><span aria-hidden="true"><Icone nom="personnes" taille={14} /></span>{t(invitation.participants === 1 ? 'groupOrder.invitationDejaUn' : 'groupOrder.invitationDeja', { n: invitation.participants })}</li>
              )}
            </ul>
            {/* Le crédit de bienvenue, après le GO seulement (rien ne se paie en ligne avant) : pour SA première commande. */}
            {paiementEnLigneOuvert(null) && (
              <p className="eg-invit-cadeau"><Icone nom="cadeau" taille={18} /><span><b>{t('groupOrder.invitationNouveau')}</b> {t('groupOrder.invitationCredit', { montant: eurosRond(MONTANT_BIENVENUE) })}</span></p>
            )}
            <div className="eg-invit-actions">
              <Link to="/login?audience=client" state={retour} className="btn-gold">{t('groupOrder.invitationRejoindre')}</Link>
              <Link to="/login" state={retour} className="eg-bouton-iris">{t('groupOrder.invitationCompte')}</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* /groupe/:code : connecté, la commande groupée (compte client exigé, comme pour commander) ; sinon l'invitation. */
export default function PageGroupe() {
  const { user } = useAuth();
  if (!user) return <InvitationGroupe />;
  return <ProtectedRoute role="client"><CommandeGroupee /></ProtectedRoute>;
}
