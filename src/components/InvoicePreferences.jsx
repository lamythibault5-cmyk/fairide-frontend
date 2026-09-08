import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// Réception des documents de facturation par e-mail (voir invoiceDelivery.js côté serveur) : la facture
// mensuelle dès son émission (activée par défaut) et, en option, un relevé détaillé chaque lundi.
export default function InvoicePreferences() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    api('/invoices/restaurant/preferences', { token }).then(setPrefs).catch(() => setPrefs({ invoiceEmailEnabled: true, weeklyStatementEmail: false }));
  }, [token]);

  async function changer(champ, valeur) {
    setOccupe(true);
    try {
      const r = await api('/invoices/restaurant/preferences', { method: 'PATCH', token, body: { [champ]: valeur } });
      setPrefs(r);
      toast(t('invoicePrefs.saved'));
    } catch (e) { toast(e.message); } finally { setOccupe(false); }
  }

  if (!prefs) return null;
  return (
    <div className="card">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('invoicePrefs.title')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('invoicePrefs.intro', { email: user?.email || '' })}</p>
      <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={prefs.invoiceEmailEnabled} disabled={occupe} onChange={(e) => changer('invoiceEmailEnabled', e.target.checked)} style={{ marginTop: 3 }} />
        <span><b>{t('invoicePrefs.monthlyInvoice')}</b><br /><span className="small">{t('invoicePrefs.monthlyInvoiceHelp')}</span></span>
      </label>
      <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={prefs.weeklyStatementEmail} disabled={occupe} onChange={(e) => changer('weeklyStatementEmail', e.target.checked)} style={{ marginTop: 3 }} />
        <span><b>{t('invoicePrefs.weeklyStatement')}</b><br /><span className="small">{t('invoicePrefs.weeklyStatementHelp')}</span></span>
      </label>
    </div>
  );
}
