import { useId, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { RESTAURANT_TYPES, fullTemplateItems } from '../../menuCategories';
import SousEcran from '../SousEcran';

// Mon commerce › Type de commerce. Deux temps, comme l'inscription : (1) le nouveau type et le sort de
// la carte actuelle, puis « Recevoir un code » ; (2) le code reçu par e-mail. Le serveur exige ce code
// (POST /request-cuisine-change puis PATCH /cuisine) parce que « remplacer la carte » efface tous les plats.
export default function EcranTypeCommerce({ restaurant, restoId, loadDashboard, onFermer }) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const ids = useId();
  const connu = RESTAURANT_TYPES.some((c) => c.value === restaurant.cuisine);
  const [type, setType] = useState(connu ? restaurant.cuisine : 'Autre');
  const [autre, setAutre] = useState(connu ? '' : (restaurant.cuisine || ''));
  const [carte, setCarte] = useState('keep');
  const [etape, setEtape] = useState(1);
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);

  async function envoyerCode() {
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/request-cuisine-change`, { method: 'POST', token });
      setEtape(2);
      toast(t('editResto.toastCodeSent'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  async function confirmer() {
    if (enCours) return; // un double appui rejouerait tout le flux (effacement puis réinsertion des plats)
    if (!code) { toast(t('editResto.toastEnterCode')); return; }
    const final = type === 'Autre' ? autre.trim() || 'Autre' : type;
    setEnCours(true);
    try {
      await api(`/restaurants/${restoId}/cuisine`, { method: 'PATCH', token, body: { cuisine: final, code, wipeMenu: carte === 'replace' } });
      if (carte === 'replace') {
        const items = fullTemplateItems(final);
        if (items.length) await api(`/restaurants/${restoId}/menu/bulk`, { method: 'POST', token, body: { items } });
      }
      await loadDashboard(restoId);
      toast(t('editResto.toastTypeUpdated'));
      onFermer();
    } catch (e) {
      toast(e.message, 'erreur');
      setEnCours(false);
    }
  }

  const pied = etape === 1 ? (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={envoyerCode}>{enCours ? '…' : t('editResto.getConfirmCode')}</button>
  ) : (
    <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={enCours} onClick={confirmer}>{enCours ? '…' : t('editResto.confirmChange')}</button>
  );

  return (
    <SousEcran titre={t('editResto.rowType')} onFermer={onFermer} pied={pied}>
      {etape === 1 ? (
        <>
          <div className="field">
            <label htmlFor={ids + '-type'}>{t('editResto.newType')}</label>
            <select id={ids + '-type'} value={type} onChange={(e) => setType(e.target.value)}>
              {RESTAURANT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>)}
            </select>
          </div>
          {type === 'Autre' && (
            <div className="field"><label htmlFor={ids + '-autre'}>{t('editResto.specifyType')}</label><input id={ids + '-autre'} value={autre} onChange={(e) => setAutre(e.target.value)} placeholder={t('editResto.phType')} /></div>
          )}
          <div className="field">
            <label htmlFor={ids + '-carte'}>{t('editResto.whatAboutMenu')}</label>
            <select id={ids + '-carte'} value={carte} onChange={(e) => setCarte(e.target.value)}>
              <option value="keep">{t('editResto.keepDishes')}</option>
              <option value="replace">{t('editResto.replaceDishes')}</option>
            </select>
          </div>
        </>
      ) : (
        <>
          <p className="small" style={{ margin: '0 0 12px' }}>{t('editResto.codeSentShort')}</p>
          <div className="field">
            <label htmlFor={ids + '-code'}>{t('editResto.codeByEmail')}</label>
            <input id={ids + '-code'} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
          </div>
          <button type="button" className="btn-ghost" disabled={enCours} onClick={envoyerCode}>{t('editResto.resendCode')}</button>
        </>
      )}
    </SousEcran>
  );
}
