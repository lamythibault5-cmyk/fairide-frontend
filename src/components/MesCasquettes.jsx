import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import LigneCompte from './LigneCompte';
import ConfirmDialog from './ConfirmDialog';

/* MES CASQUETTES : commander, tenir un commerce, livrer — sur un seul compte.
 *
 * Le problème réglé : un restaurateur ou un livreur ne pouvait pas commander. Le serveur réserve la
 * commande aux comptes « client », et il aurait fallu un second compte — donc un second numéro, que
 * l'unicité du téléphone refuse. Un commerçant qui voulait commander chez son voisin était bloqué.
 *
 * Un compte porte maintenant plusieurs rôles (user_roles côté serveur). Cet écran fait deux choses,
 * et seulement deux : prendre une casquette qu'on n'a pas, et choisir celle qu'on regarde.
 *
 * CHANGER DE CASQUETTE N'EST PAS UN CHANGEMENT DE COMPTE : même session, même jeton, même
 * historique. C'est la vue qui change, et le tableau de bord d'arrivée avec elle — d'où la
 * navigation vers l'accueil, qui redirige chacun vers son espace (voir Home.jsx).
 *
 * Ce qu'une casquette ne donne pas, et il faut le dire ici pour ne pas le laisser croire :
 * « livreur » n'ouvre que le dossier, la validation par l'équipe et les documents restent exigés ;
 * « commerce » ne fait apparaître aucun commerce et surtout aucun encaissement, qui dépend de
 * l'approbation, de l'abonnement et de la vérification Stripe. Les libellés le disent en clair
 * plutôt que de laisser la déception venir après le clic. */

const ICONES = { client: '🛍️', restaurant: '🏪', driver: '🛵' };
const ORDRE = ['client', 'restaurant', 'driver'];

export default function MesCasquettes() {
  const { roles, role, ajouterRole, changerRole, refreshUser } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [occupe, setOccupe] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const manquants = ORDRE.filter((r) => !roles.includes(r));

  async function prendre(cible) {
    setOccupe(cible);
    try {
      await ajouterRole(cible);
      // La session locale porte déjà la nouvelle liste ; on relit quand même le compte pour rester
      // aligné sur le serveur (un rôle « livreur » crée aussi un dossier coursier).
      try { await refreshUser(); } catch { /* la liste locale suffit */ }
      toast(t('casquettes.ajoutee', { role: t(`casquettes.nom_${cible}`) }));
    } catch (e) {
      toast(e.message);
    } finally {
      setOccupe('');
      setConfirmation(null);
    }
  }

  function basculer(cible) {
    if (!changerRole(cible)) return;
    toast(t('casquettes.basculee', { role: t(`casquettes.nom_${cible}`) }));
    navigate('/');
  }

  // Un seul rôle et rien à proposer : la section n'a rien à dire, elle ne s'affiche pas.
  if (roles.length <= 1 && manquants.length === 0) return null;

  return (
    <>
      <div className="card account-groupe" aria-label={t('casquettes.titre')}>
        <p className="small" style={{ margin: '0 0 4px', padding: '10px 14px 0' }}>{t('casquettes.intro')}</p>
        {ORDRE.filter((r) => roles.includes(r)).map((r) => (
          <LigneCompte
            key={r}
            icone={ICONES[r]}
            titre={t(`casquettes.nom_${r}`)}
            sous={r === role ? undefined : t('casquettes.basculerVers')}
            accent={r === role ? 'ok' : undefined}
            /* La casquette active porte une pastille, pas un chevron : sans `action`, LigneCompte
               rend une rangée cliquable qui ne mène nulle part — elle se lit comme un lien mort. */
            action={r === role ? (
              <span className="pill teal">{t('casquettes.active')}</span>
            ) : (
              <button type="button" className="btn-outline" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => basculer(r)}>
                {t('casquettes.basculer')}
              </button>
            )}
          />
        ))}
        {manquants.map((r) => (
          <LigneCompte
            key={r}
            icone={ICONES[r]}
            titre={t(`casquettes.prendre_${r}`)}
            sous={t(`casquettes.prendreSous_${r}`)}
            action={(
              <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 13 }}
                disabled={!!occupe} onClick={() => setConfirmation(r)}>
                {occupe === r ? '…' : t('casquettes.activer')}
              </button>
            )}
          />
        ))}
      </div>
      {confirmation && (
        <ConfirmDialog
          open
          title={t(`casquettes.prendre_${confirmation}`)}
          message={t(`casquettes.confirme_${confirmation}`)}
          confirmLabel={t('casquettes.activer')}
          loading={!!occupe}
          onConfirm={() => prendre(confirmation)}
          onCancel={() => setConfirmation(null)}
        />
      )}
    </>
  );
}
