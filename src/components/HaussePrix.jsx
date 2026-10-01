import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';

// « Tes prix sur Fairide » (fondateur, 2026-09-30) : par défaut, la carte affiche le prix sur place + la part de
// Fairide (10 %), et le commerce reçoit son prix sur place. La barre ajoute de 0 à 10 % que le commerce GARDE ;
// la part de Fairide ne bouge pas. Le serveur recalcule toute la carte (PUT /restaurants/:id/price-markup) et
// retrouve les prix d'avant au retour à 0 %.
const EXEMPLE_SUR_PLACE = 10;
const euros = (v, locale) => v.toLocaleString(locale, { style: 'currency', currency: 'EUR' });

export default function HaussePrix({ restoId, nbPlats, onChange, modeAdmin = false }) {
  const { t, locale } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [etat, setEtat] = useState(null);
  const [valeur, setValeur] = useState(0);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/price-markup`, { token })
      .then((r) => { if (!annule) { setEtat(r); setValeur(r.percent); } })
      .catch(() => {});
    return () => { annule = true; };
  }, [restoId, token]);

  if (!etat) return null;
  // fairideRate = commission HTVA + sa TVA (10 % + 21 % de TVA = 12,1 %) ; fairideRateHt = la commission seule.
  const r = etat.fairideRate;
  const affiche = EXEMPLE_SUR_PLACE * (1 + r + valeur / 100);
  const recu = EXEMPLE_SUR_PLACE * (1 + valeur / 100);
  const partFairide = EXEMPLE_SUR_PLACE * r;
  const partFairideHt = EXEMPLE_SUR_PLACE * (etat.fairideRateHt ?? r);
  const tauxAffiche = (r * 100).toLocaleString(locale, { maximumFractionDigits: 1 });
  const change = valeur !== etat.percent;
  const demande = etat.requested !== null && etat.requested !== undefined ? etat.requested : null;

  async function appliquer() {
    setEnCours(true);
    try {
      const res = await api(`/restaurants/${restoId}/price-markup`, { method: 'PUT', token, body: { percent: valeur } });
      // Le commerce DEMANDE (202, pending) ; l'équipe applique. Ses prix ne changent jamais sans validation.
      if (res.pending) {
        setEtat((e) => ({ ...e, percent: res.percent, requested: res.requested }));
        setValeur(res.percent);
        toast(t('menuPage.markupRequestSent', { p: res.requested }));
        return;
      }
      setEtat((e) => ({ ...e, percent: res.percent, requested: res.requested ?? null }));
      await onChange?.();
      toast(res.percent === 0 ? t('menuPage.markupDoneZero') : t('menuPage.markupDone', { p: res.percent, n: res.items }));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  async function retirerDemande() {
    setEnCours(true);
    try {
      const res = await api(`/restaurants/${restoId}/price-markup/request`, { method: 'DELETE', token });
      setEtat((e) => ({ ...e, requested: null, percent: res.percent }));
      toast(modeAdmin ? t('menuPage.markupRequestRefused') : t('menuPage.markupRequestWithdrawn'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  return (
    <div className="card hausse-prix" id="menu-hausse-prix">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📈 {t('menuPage.markupTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.markupIntro', { rate: tauxAffiche })}</p>
      <label htmlFor="hausse-prix-barre" className="small" style={{ fontWeight: 700, display: 'block' }}>
        {valeur === 0 ? t('menuPage.markupValueZero') : t('menuPage.markupValue', { p: valeur })}
      </label>
      <input id="hausse-prix-barre" type="range" min="0" max={etat.max} step="1" value={valeur}
        onChange={(e) => setValeur(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--teal, #1F8A70)' }}
        aria-valuetext={`+${valeur} %`} />
      <div className="row small" style={{ justifyContent: 'space-between', opacity: 0.7, marginTop: -2 }}>
        <span>{t('menuPage.markupMin')}</span><span>+{etat.max} %</span>
      </div>
      <div className="hausse-prix-exemple small" style={{ margin: '10px 0', padding: 10, borderRadius: 10, background: 'var(--surface-2, rgba(31,138,112,0.07))' }}>
        <div>{t('menuPage.markupExample', { base: euros(EXEMPLE_SUR_PLACE, locale) })}</div>
        <div>👀 {t('menuPage.markupShown')} <b>{euros(affiche, locale)}</b></div>
        <div>💚 {t('menuPage.markupYouGet')} <b>{euros(recu, locale)}</b>{valeur > 0 && <> ({t('menuPage.markupYouGetExtra', { amount: euros(recu - EXEMPLE_SUR_PLACE, locale) })})</>}</div>
        <div>🟢 {t('menuPage.markupFairide')} <b>{euros(partFairide, locale)}</b> <span className="small">{t('menuPage.markupFairideDetail', { ht: euros(partFairideHt, locale), tva: euros(partFairide - partFairideHt, locale) })}</span></div>
      </div>
      {demande !== null && (
        <div className="hausse-prix-demande" role="status">
          <b>{modeAdmin ? t('menuPage.markupRequestedAdmin', { p: demande }) : t('menuPage.markupRequestedPending', { p: demande })}</b>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {modeAdmin && <button type="button" className="btn-teal" disabled={enCours} onClick={() => { setValeur(demande); setTimeout(appliquer, 0); }}>{t('menuPage.markupApplyRequest', { p: demande })}</button>}
            <button type="button" className="btn-outline" disabled={enCours} onClick={retirerDemande}>{modeAdmin ? t('menuPage.markupRefuseRequest') : t('menuPage.markupWithdraw')}</button>
          </div>
        </div>
      )}
      {change && (
        <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 44 }} disabled={enCours} onClick={appliquer}>
          {enCours ? '…' : modeAdmin ? t('menuPage.markupApply', { n: nbPlats }) : t('menuPage.markupRequestButton', { p: valeur })}
        </button>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>{modeAdmin ? t('menuPage.markupNote') : t('menuPage.markupNoteLocked')}</p>
    </div>
  );
}
