import { useState } from 'react';
import { api, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import ConfirmDialog from './ConfirmDialog';

// Mon compte › Mes données et sessions (plan de test, 2 octobre 2026) :
//   - CPT-7 : télécharger ses données personnelles (JSON, tout de suite) — rien n'existait, droit d'accès RGPD ;
//   - CPT-9 : se déconnecter de tous les appareils — seul un changement de mot de passe le faisait.
// Sorti d'Account.jsx, qui ne doit plus grossir (CLAUDE.md).
export default function MesDonnees() {
  const { t } = useLanguage();
  const { token, logout } = useAuth();
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  async function telecharger() {
    setEnCours(true);
    try {
      const r = await fetch(`${API_BASE}/me/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || t('accountUi.myData_exportError'));
      const blob = await r.blob();
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = `fairide-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(lien); lien.click();
      setTimeout(() => { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  async function deconnecterPartout() {
    try {
      await api('/me/logout-everywhere', { method: 'POST', token });
      toast(t('accountUi.myData_loggedOutEverywhere'));
      logout();
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirmer(false);
    }
  }

  return (
    <div>
      <p className="small" style={{ margin: '0 0 8px', opacity: 0.8 }}>{t('accountUi.myData_exportHelp')}</p>
      <button type="button" className="btn-outline" disabled={enCours} onClick={telecharger}>{enCours ? '…' : t('accountUi.myData_exportButton')}</button>
      <p className="small" style={{ margin: '16px 0 8px', opacity: 0.8 }}>{t('accountUi.myData_logoutAllHelp')}</p>
      <button type="button" className="btn-outline" onClick={() => setConfirmer(true)}>{t('accountUi.myData_logoutAllButton')}</button>
      <ConfirmDialog
        open={confirmer}
        title={t('accountUi.myData_logoutAllButton')}
        message={t('accountUi.myData_logoutAllConfirm')}
        confirmLabel={t('accountUi.myData_logoutAllButton')}
        onCancel={() => setConfirmer(false)}
        onConfirm={deconnecterPartout}
      />
    </div>
  );
}
