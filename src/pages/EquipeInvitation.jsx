import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

/* /equipe/:token — L'INVITATION DANS L'ÉQUIPE D'UN COMMERCE (15 oct. 2026 ; backend equipeCommerce.js).
 * Avant la connexion : le nom du commerce et un indice de l'adresse invitée, puis « Se connecter » ou « Créer mon compte »,
 * qui ramènent ici. Connecté : « Rejoindre l'équipe », avec le compte de l'adresse invitée seulement (le serveur refuse
 * les autres). Ensuite la casquette « commerce » devient l'active et la page des commandes s'ouvre. */
export default function EquipeInvitation() {
  const { token: lien } = useParams();
  const { user, token, refreshUser, changerRole } = useAuth();
  const toast = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [invitation, setInvitation] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    api(`/restaurants/team/invitation/${encodeURIComponent(lien)}`)
      .then((r) => { if (r && r.restaurantName) setInvitation(r); else setIntrouvable(true); })
      .catch(() => setIntrouvable(true));
  }, [lien]);

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

  const retour = { from: location.pathname };
  return (
    <div className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
      {introuvable ? (
        <>
          <h2 style={{ marginTop: 0 }}>{t('team.inviteNotFoundTitle')}</h2>
          <p className="small">{t('team.inviteNotFoundText')}</p>
        </>
      ) : !invitation ? <p className="small">…</p> : (
        <>
          <h2 style={{ marginTop: 0 }}>{t('team.inviteTitle', { name: invitation.restaurantName })}</h2>
          <p className="small">{t('team.inviteWhat')}</p>
          <p className="small" style={{ color: 'var(--ink-soft)' }}>{t('team.inviteFor', { email: invitation.emailHint })}</p>
          {invitation.expired ? (
            <p className="small" role="alert">{t('team.inviteExpired')}</p>
          ) : user ? (
            <button type="button" className="btn-gold" disabled={envoi} onClick={rejoindre}>{envoi ? '…' : t('team.join')}</button>
          ) : (
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Link to="/login" state={retour} className="btn-gold">{t('team.signIn')}</Link>
              <Link to="/login?audience=client" state={retour} className="btn-outline">{t('team.signUp')}</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
