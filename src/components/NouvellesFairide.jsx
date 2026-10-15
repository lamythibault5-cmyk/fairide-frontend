import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import LigneCompte from './LigneCompte';

// Mon compte › « Recevoir les nouvelles de Fairide par e-mail » (client, livreur, commerce). Les e-mails marketing
// sont en opt-out : chaque campagne porte un lien de désinscription, et ici on peut se désinscrire ou se réinscrire
// (GET/PATCH /auth/me/marketing). Sorti d'Account.jsx, qui ne doit plus grossir (CLAUDE.md).
export default function NouvellesFairide({ ouverte, onClick }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [abonne, setAbonne] = useState(null); // null tant que le serveur n'a pas répondu
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!token) return;
    api('/auth/me/marketing', { token }).then((r) => setAbonne(r.marketingEmails)).catch(() => {});
  }, [token]);

  async function basculer(e) {
    const voulu = e.target.checked;
    setEnCours(true);
    try {
      const r = await api('/auth/me/marketing', { method: 'PATCH', token, body: { marketingEmails: voulu } });
      setAbonne(r.marketingEmails);
      toast(t('nouvelles.saved'), 'succes');
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  const sous = abonne === null ? undefined : abonne ? t('nouvelles.rowOn') : t('nouvelles.rowOff');
  return (
    <LigneCompte icone="courrier" titre={t('nouvelles.rowTitle')} sous={sous} ouverte={ouverte} onClick={onClick}>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('nouvelles.explain')}</p>
      <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={!!abonne} disabled={abonne === null || enCours} onChange={basculer} />
        <span className="small">{t('nouvelles.toggleLabel')}</span>
      </label>
    </LigneCompte>
  );
}
