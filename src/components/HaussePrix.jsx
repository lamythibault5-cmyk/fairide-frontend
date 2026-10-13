import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import Icone from './Icone';
import AvecMarque from './AvecMarque';

// « Tes prix sur Fairide » — modèle du 13/10/2026 (fondateur). Par défaut, la carte affiche les prix du commerce et Fairide
// garde 10 % du prix payé. La barre monte les prix de 0 à etat.max (+ 11,1 % en franchise TVA), la hausse qui rend au
// commerce son prix entier ; jamais plus. Le serveur recalcule toute la carte (PUT /restaurants/:id/price-markup, arrondi au
// 0,10 € supérieur, prixMagasin.js côté serveur) et retrouve les prix du commerce au retour à 0 %.
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
  // fairideRate = commission + sa TVA éventuelle ; fairideRateHt = la commission seule. Fairide est sous le régime de la
  // franchise TVA (lettre du SPF Finances du 12/10/2026) : fairideVat = 0, les deux valent 10 %. Assujettie : 12,1 % et 10 %.
  const sansTva = !(Number(etat.fairideVat) > 0);
  const r = etat.fairideRate;
  // Même calcul que le serveur : prix du commerce × (1 + hausse), au 0,10 € supérieur ; Fairide garde r du prix payé.
  const affiche = valeur > 0 ? Math.ceil(EXEMPLE_SUR_PLACE * (1 + valeur / 100) * 10 - 1e-6) / 10 : EXEMPLE_SUR_PLACE;
  const partFairide = Math.round(affiche * r * 100) / 100;
  const partFairideHt = Math.round(affiche * (etat.fairideRateHt ?? r) * 100) / 100;
  const recu = affiche - partFairide;
  const tauxAffiche = (r * 100).toLocaleString(locale, { maximumFractionDigits: 1 });
  // Pourcentages à une décimale, dans la langue de l'écran (11,1 / 11.1 pour la hausse maximale).
  const pct = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 1 });
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
        toast(t('menuPage.markupRequestSent', { p: pct(res.requested) }));
        return;
      }
      setEtat((e) => ({ ...e, percent: res.percent, requested: res.requested ?? null }));
      await onChange?.();
      toast(res.percent === 0 ? t('menuPage.markupDoneZero') : t('menuPage.markupDone', { p: pct(res.percent), n: res.items }));
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
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}><Icone nom="tendance" taille={16} className="icone-texte" />{' '}<AvecMarque>{t('menuPage.markupTitle')}</AvecMarque></h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.markupIntro', { rate: tauxAffiche, max: pct(etat.max) })}</p>
      <label htmlFor="hausse-prix-barre" className="small" style={{ fontWeight: 700, display: 'block' }}>
        {valeur === 0 ? t('menuPage.markupValueZero') : t('menuPage.markupValue', { p: pct(valeur) })}
      </label>
      <input id="hausse-prix-barre" type="range" min="0" max={etat.max} step="0.1" value={valeur}
        onChange={(e) => setValeur(Math.round(Number(e.target.value) * 10) / 10)} style={{ width: '100%', accentColor: 'var(--teal, #1F8A70)' }}
        aria-valuetext={`+${pct(valeur)} %`} />
      <div className="row small" style={{ justifyContent: 'space-between', opacity: 0.7, marginTop: -2 }}>
        <span>{t('menuPage.markupMin')}</span><span>+{pct(etat.max)} %</span>
      </div>
      <div className="hausse-prix-exemple small" style={{ margin: '10px 0', padding: 10, borderRadius: 10, background: 'var(--surface-soft)' }}>
        <div>{t('menuPage.markupExample', { base: euros(EXEMPLE_SUR_PLACE, locale) })}</div>
        <div><Icone nom="apercu" taille={16} className="icone-texte" />{' '}{t('menuPage.markupShown')} <b>{euros(affiche, locale)}</b></div>
        <div>{t('menuPage.markupYouGet')} <b>{euros(recu, locale)}</b>{recu < EXEMPLE_SUR_PLACE - 0.004 ? <> ({t('menuPage.markupYouGetLess', { amount: euros(EXEMPLE_SUR_PLACE - recu, locale) })})</> : <> ({t('menuPage.markupYouGetFull')})</>}</div>
        <div>{t('menuPage.markupFairide')} <b>{euros(partFairide, locale)}</b> {!sansTva && <span className="small">{t('menuPage.markupFairideDetail', { ht: euros(partFairideHt, locale), tva: euros(partFairide - partFairideHt, locale) })}</span>}</div>
      </div>
      {demande !== null && (
        <div className="hausse-prix-demande" role="status">
          <b>{modeAdmin ? t('menuPage.markupRequestedAdmin', { p: pct(demande) }) : t('menuPage.markupRequestedPending', { p: pct(demande) })}</b>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {modeAdmin && <button type="button" className="btn-teal" disabled={enCours} onClick={() => { setValeur(demande); setTimeout(appliquer, 0); }}>{t('menuPage.markupApplyRequest', { p: pct(demande) })}</button>}
            <button type="button" className="btn-outline" disabled={enCours} onClick={retirerDemande}>{modeAdmin ? t('menuPage.markupRefuseRequest') : t('menuPage.markupWithdraw')}</button>
          </div>
        </div>
      )}
      {change && (
        <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 44 }} disabled={enCours} onClick={appliquer}>
          {enCours ? '…' : modeAdmin ? t('menuPage.markupApply', { n: nbPlats }) : t('menuPage.markupRequestButton', { p: pct(valeur) })}
        </button>
      )}
      <p className="small" style={{ margin: '8px 0 0', opacity: 0.75 }}>{modeAdmin ? t('menuPage.markupNote') : t('menuPage.markupNoteLocked')}</p>
    </div>
  );
}
