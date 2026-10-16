import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import ConfirmDialog from '../ConfirmDialog';

/* L'ÉQUIPE DU COMMERCE, CÔTÉ PROPRIÉTAIRE (comparaison avec Uber Eats, 15 oct. 2026 ; backend equipeCommerce.js).
 * Inviter par e-mail (le lien vaut 7 jours, pour cette adresse seulement), voir qui est là, retirer quelqu'un — l'accès
 * se ferme aussitôt. Ce qu'un membre peut faire est dit en clair avant l'invitation : le service, rien d'autre. */
export default function EquipeCommerce({ restoId }) {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const [membres, setMembres] = useState(null);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [aRetirer, setARetirer] = useState(null);

  const charger = () => api(`/restaurants/${restoId}/team`, { token }).then((r) => setMembres(Array.isArray(r?.members) ? r.members : [])).catch((e) => { setMembres([]); toast(e.message, 'erreur'); });
  useEffect(() => { charger(); }, [restoId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function inviter(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setEnvoi(true);
    try {
      await api(`/restaurants/${restoId}/team`, { method: 'POST', token, body: { email: email.trim(), name: nom.trim() } });
      toast(t('team.invited', { email: email.trim() }), 'succes');
      setEmail(''); setNom('');
      charger();
    } catch (err) { toast(err.message, 'erreur'); } finally { setEnvoi(false); }
  }
  async function retirer(m) {
    try {
      await api(`/restaurants/${restoId}/team/${m.id}`, { method: 'DELETE', token });
      setMembres((prev) => prev.filter((x) => x.id !== m.id));
      toast(t('team.removed'), 'succes');
    } catch (err) { toast(err.message, 'erreur'); }
  }

  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('team.intro')}</p>
      {membres === null ? <p className="small">…</p> : membres.length === 0 ? (
        <p className="small" style={{ margin: '0 0 12px' }}>{t('team.none')}</p>
      ) : (
        <div style={{ marginBottom: 12 }}>
          {membres.map((m) => (
            <div key={m.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line)', gap: 8 }}>
              <span className="small">
                <b>{m.name || m.email}</b>{m.name ? ` · ${m.email}` : ''}
                <span style={{ display: 'block', color: 'var(--ink-soft)' }}>{t(`team.status_${m.status}`)}</span>
              </span>
              <button type="button" className="btn-danger-ghost" onClick={() => setARetirer(m)}>{t('team.remove')}</button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={inviter}>
        <div className="field">
          <label htmlFor="equipe-email">{t('team.email')}</label>
          <input id="equipe-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.be" />
        </div>
        <div className="field">
          <label htmlFor="equipe-nom">{t('team.name')}</label>
          <input id="equipe-nom" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} />
        </div>
        <button type="submit" className="btn-teal" disabled={envoi || !email.trim()}>{envoi ? '…' : t('team.invite')}</button>
      </form>
      <ConfirmDialog
        open={!!aRetirer}
        title={t('team.removeTitle')}
        message={aRetirer ? t('team.removeText', { name: aRetirer.name || aRetirer.email }) : ''}
        confirmLabel={t('team.remove')}
        danger
        onCancel={() => setARetirer(null)}
        onConfirm={() => { const m = aRetirer; setARetirer(null); retirer(m); }}
      />
    </div>
  );
}
