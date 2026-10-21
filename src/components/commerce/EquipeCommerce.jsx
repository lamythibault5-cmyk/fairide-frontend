import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';
import Icone from '../Icone';
import '../../ecran-equipe-groupe.css';

/* L'ÉQUIPE DU COMMERCE, CÔTÉ PROPRIÉTAIRE (comparaison avec Uber Eats, 15 oct. 2026 ; backend equipeCommerce.js).
 * Inviter par e-mail (le lien vaut 7 jours, pour cette adresse seulement), voir qui est là, retirer quelqu'un — l'accès
 * se ferme aussitôt. Ce qu'un membre peut faire est dit en clair avant l'invitation : le service, rien d'autre.
 * Le dessin (2026-10-16, ecran-equipe-groupe.css) : une liste à filets (initiale, prénom, e-mail, statut en pastille, la
 * croix pour retirer), puis « Inviter quelqu'un » : deux champs et un seul bouton. */
export default function EquipeCommerce({ restoId }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [membres, setMembres] = useState(null);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState(null);
  // Échec du chargement (audit du 19/10, shop-416) : il affichait « Personne dans ton équipe », ce qui était faux.
  const [erreur, setErreur] = useState(null);

  const charger = () => { setErreur(null); return api(`/restaurants/${restoId}/team`, { token }).then((r) => setMembres(Array.isArray(r?.members) ? r.members : [])).catch((e) => { setMembres(null); setErreur(e.message); }); };
  useEffect(() => { charger(); }, [restoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function envoyerInvitation(adresse, prenom) {
    setEnvoi(true);
    try {
      await api(`/restaurants/${restoId}/team`, { method: 'POST', token, body: { email: adresse, name: prenom } });
      toast(t('team.invited', { email: adresse }), 'succes');
      charger();
      return true;
    } catch (err) { toast(err.message, 'erreur'); return false; } finally { setEnvoi(false); }
  }
  async function inviter(e) {
    e.preventDefault();
    if (!email.trim()) return;
    if (await envoyerInvitation(email.trim(), nom.trim())) { setEmail(''); setNom(''); }
  }
  async function retirer(m) {
    try {
      await api(`/restaurants/${restoId}/team/${m.id}`, { method: 'DELETE', token });
      setMembres((prev) => prev.filter((x) => x.id !== m.id));
      toast(t('team.removed'), 'succes');
    } catch (err) { toast(err.message, 'erreur'); }
  }

  return (
    <div className="eg-equipe">
      <p className="eg-texte">{t('team.intro')}</p>
      {erreur ? (
        <p className="eg-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}{' '}<button type="button" className="eg-bouton-iris" onClick={charger}>{t('team.retry')}</button></p>
      ) : membres === null ? <p className="eg-texte">…</p> : membres.length === 0 ? (
        <p className="eg-equipe-vide">{t('team.none')}</p>
      ) : (
        <ul className="eg-membres">
          {membres.map((m) => (
            <li key={m.id} className="eg-membre">
              <span className="eg-initiale" aria-hidden="true">{(m.name || m.email || '?').trim().charAt(0).toUpperCase()}</span>
              <span className="eg-membre-texte">
                <b>{m.name || m.email}</b>
                {m.name && <small>{m.email}</small>}
                {/* La pastille dit le statut en deux mots ; la phrase complète (« … : invite à nouveau ») en infobulle. */}
                <span className={`eg-pastille eg-pastille--${m.status}`} title={t(`team.status_${m.status}`)}>
                  {['invited', 'expired'].includes(m.status) ? t(`team.pill_${m.status}`) : t(`team.status_${m.status}`)}
                </span>
              </span>
              {/* Invitation expirée : la renvoyer d'un geste, sans retaper l'adresse (shop-416). */}
              {m.status === 'expired' && (
                <button type="button" className="eg-bouton-iris" disabled={envoi} onClick={() => envoyerInvitation(m.email, m.name || '')}>{t('team.resend')}</button>
              )}
              <button type="button" className="eg-retirer" onClick={() => setARetirer(m)} aria-label={`${t('team.remove')} : ${m.name || m.email}`} title={t('team.remove')}>
                <Icone nom="croix" taille={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="eg-inviter" onSubmit={inviter}>
        <h3>{t('team.inviteSection')}</h3>
        <div className="eg-inviter-champs">
          <div className="field">
            <label htmlFor="equipe-email">{t('team.email')}</label>
            <input id="equipe-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.be" />
          </div>
          <div className="field">
            <label htmlFor="equipe-nom">{t('team.name')}</label>
            <input id="equipe-nom" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} autoComplete="off" />
          </div>
        </div>
        <button type="submit" className="btn-teal" disabled={envoi || !email.trim()}>{envoi ? '…' : t('team.invite')}</button>
      </form>
      <ConfirmDialog
        open={!!aRetirer}
        title={aRetirer && aRetirer.status !== 'active' ? t('team.removeInviteTitle') : t('team.removeTitle')}
        message={aRetirer ? t(aRetirer.status !== 'active' ? 'team.removeInviteText' : 'team.removeText', { name: aRetirer.name || aRetirer.email }) : ''}
        confirmLabel={t('team.remove')}
        danger
        onCancel={() => setARetirer(null)}
        onConfirm={() => { const m = aRetirer; setARetirer(null); retirer(m); }}
      />
    </div>
  );
}
