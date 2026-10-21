import { useState } from 'react';
import { api, apiDownload } from '../api';
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
      /* Par apiDownload (audit du 19/10, AO-08 / CROSS-45). Le fetch brut suivi d'un <a download> ne faisait RIEN dans
       * l'application (la WebView ignore les téléchargements) : le droit d'accès RGPD y était un bouton mort. apiDownload
       * envoie le fichier à la feuille de partage du téléphone (Enregistrer dans Fichiers, Envoyer…), garde le
       * téléchargement nommé sur le site, gère la session expirée et traduit « serveur injoignable » (au lieu de
       * « Failed to fetch »). */
      await apiDownload('/me/export', { token, filename: `fairide-mes-donnees-${new Date().toISOString().slice(0, 10)}.json` });
    } catch (e) {
      toast(e.message || t('accountUi.myData_exportError'), 'erreur');
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
