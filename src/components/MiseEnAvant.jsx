import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { titreRangee, libellePosition, euros, jourCourt } from '../misesEnAvant';

// Promotions › Mise en avant (fondateur, 2026-10-02). Le commerçant choisit une rangée de la liste (« Healthy », « Autour
// de vous »…), la 1re, 2e ou 3e position et une durée ; le prix par semaine est celui réglé par Fairide. Comme pour les
// prix et la carte : c'est une DEMANDE, que l'équipe confirme avant qu'elle ne s'affiche.

export default function MiseEnAvant({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null);
  const [choix, setChoix] = useState(null); // { sectionKey, slot }
  const [semaines, setSemaines] = useState(1);
  const [occupe, setOccupe] = useState(false);
  // MODE AUTOMATIQUE (fondateur, 2026-10-06) : la demande est tranchée sur-le-champ (premier arrivé, premier servi) ; acceptée,
  // elle se paie en ligne dans les 10 minutes. Date de début : de demain à N jours (jamais le jour même).
  const [dateDebut, setDateDebut] = useState('');
  const [decision, setDecision] = useState(null); // { checkoutUrl, paymentDueAt, note }
  const [maintenant, setMaintenant] = useState(Date.now());
  const attenteDePaiement = (etat?.bookings || []).some((b) => b.status === 'awaiting_payment') || !!decision;
  useEffect(() => { if (!attenteDePaiement) return undefined; const m = setInterval(() => setMaintenant(Date.now()), 1000); return () => clearInterval(m); }, [attenteDePaiement]);
  useEffect(() => { if (etat?.minStartsOn && !dateDebut) setDateDebut(etat.minStartsOn); }, [etat?.minStartsOn, dateDebut]);
  useEffect(() => {
    // Retour de la page de paiement Stripe.
    try { const q = new URLSearchParams(window.location.search).get('placement'); if (q === 'paid') toast(t('placements.paidThanks')); else if (q === 'cancelled') toast(t('placements.payLater')); if (q) window.history.replaceState({}, '', window.location.pathname); } catch { /* sans historique */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const resteMinutes = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - maintenant) / 60000));
  const resteTexte = (iso) => { const s = Math.max(0, Math.round((new Date(iso).getTime() - maintenant) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  const charger = useCallback(() => {
    api(`/restaurants/${restoId}/placements`, { token }).then(setEtat).catch((e) => toast(e.message, 'erreur'));
  }, [restoId, token, toast]);
  useEffect(() => { charger(); }, [charger]);

  const section = choix && etat?.sections.find((s) => s.key === choix.sectionKey);
  const prix = section?.prices.find((p) => p.slot === choix.slot)?.weeklyPrice ?? 0;
  const totalHt = prix * semaines;
  const tva = totalHt * (etat?.vatRate ?? 0.21);
  const titre = (cle, repli) => titreRangee(t, { key: cle, label: repli, cuisine: etat?.sections.find((s) => s.key === cle)?.cuisine });
  // Autant de colonnes que de positions vendues (3 par défaut, l'admin peut en ajouter) ; au-delà de 3, la grille défile.
  const nbPositions = etat?.sections[0]?.prices.length || 3;
  const colonnes = { gridTemplateColumns: `minmax(96px, 1.3fr) repeat(${nbPositions}, minmax(${nbPositions > 3 ? 78 : 0}px, 1fr))`, ...(nbPositions > 3 ? { minWidth: 100 + nbPositions * 84 } : {}) };

  async function demander() {
    setOccupe(true);
    try {
      const data = await api(`/restaurants/${restoId}/placements`, { method: 'POST', token, body: { sectionKey: choix.sectionKey, slot: choix.slot, weeks: semaines, startsOn: dateDebut || undefined } });
      if (data.decision === 'accepted' && data.checkoutUrl) { setDecision({ checkoutUrl: data.checkoutUrl, paymentDueAt: data.paymentDueAt, note: data.booking?.decisionNote || '' }); toast(t('placements.autoAccepted', { minutes: data.paymentMinutes || etat?.paymentMinutes || 10 })); }
      else if (data.decision === 'accepted') toast(t('placements.autoFree'));
      else toast(t('placements.requested'));
      setChoix(null); setSemaines(1); charger();
    } catch (e) { toast(e.message, 'erreur'); charger(); } finally { setOccupe(false); }
  }
  async function retirer(b) {
    setOccupe(true);
    try { await api(`/restaurants/${restoId}/placements/${b.id}`, { method: 'DELETE', token }); toast(t('placements.withdrawn')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  // Commune pas encore ouverte à la vente par Fairide (ou réponse pas encore là) : la section n'apparaît pas.
  if (!etat || etat.enabled === false) return null;
  return (
    <div className="card mise-en-avant" id="mise-en-avant">
      <h3 style={{ margin: 0, fontSize: 16 }}>📌 {t('placements.title')}</h3>
      <p className="small" style={{ margin: '4px 0 6px' }}>{t('placements.intro')} {t('placements.communeNote', { commune: etat.commune })}</p>
      <p className="small" style={{ margin: '0 0 12px' }}>
        {etat.auto ? t('placements.autoIntro', { minutes: etat.paymentMinutes || 10, days: etat.maxAdvanceDays || 30 }) : t('placements.manualIntro', { days: etat.maxAdvanceDays || 30 })} {t('placements.refundNote')} {t('placements.randomNote')}
      </p>
      {decision && (
        <div className="mea-demande mea-paiement" role="status">
          <b>{t('placements.autoAcceptedTitle')}</b>
          <p className="small" style={{ margin: '4px 0 8px' }}>{decision.note || t('placements.autoAccepted', { minutes: etat.paymentMinutes || 10 })}</p>
          <a className="btn-teal" style={{ display: 'inline-block', minHeight: 44, lineHeight: '44px', padding: '0 18px' }} href={decision.checkoutUrl}>{t('placements.payNow')} · {resteTexte(decision.paymentDueAt)}</a>
          <button type="button" className="btn-ghost" style={{ marginLeft: 8 }} onClick={() => setDecision(null)}>{t('placements.payLaterBtn')}</button>
        </div>
      )}
      {!etat && <p className="small">…</p>}
      {etat && (
        <>
          <div className={`mea-grille${nbPositions > 3 ? ' mea-grille--large' : ''}`} role="table" aria-label={t('placements.title')}>
            <div className="mea-ligne mea-entete" role="row" style={colonnes}>
              <span role="columnheader">{t('placements.row')}</span>
              {etat.sections[0]?.prices.map((p) => <span key={p.slot} role="columnheader">{libellePosition(t, p.slot)}</span>)}
            </div>
            {etat.sections.map((s) => (
              <div className="mea-ligne" role="row" key={s.key} style={colonnes}>
                <span role="rowheader" className="mea-rangee">{titre(s.key, s.label)}</span>
                {s.prices.map((p) => {
                  const actif = choix?.sectionKey === s.key && choix?.slot === p.slot;
                  return (
                    <button key={p.slot} type="button" role="cell" disabled={!!p.takenUntil || occupe}
                      className={`mea-case${actif ? ' est-choisie' : ''}${p.takenUntil ? ' est-prise' : ''}`}
                      aria-pressed={actif} onClick={() => setChoix(actif ? null : { sectionKey: s.key, slot: p.slot })}>
                      {p.takenUntil
                        ? <span className="mea-prise">{p.takenByMe ? t('placements.yours') : t('placements.takenUntil', { date: jourCourt(p.takenUntil) })}</span>
                        : <><b>{euros(p.weeklyPrice)}</b><span className="mea-unite">{t('placements.perWeek')}</span></>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {choix && section && (
            <div className="mea-demande">
              <b>{t('placements.summary', { row: titre(section.key, section.label), pos: libellePosition(t, choix.slot) })}</b>
              <div className="row" style={{ gap: 8, alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' }}>
                <button type="button" className="btn-ghost" style={{ minWidth: 44, minHeight: 44 }} aria-label="−" disabled={semaines <= 1} onClick={() => setSemaines((n) => Math.max(1, n - 1))}>−</button>
                <span style={{ minWidth: 96, textAlign: 'center', fontWeight: 700 }}>{t('placements.weeks', { n: semaines })}</span>
                <button type="button" className="btn-ghost" style={{ minWidth: 44, minHeight: 44 }} aria-label="+" disabled={semaines >= (etat.maxWeeks || 12)} onClick={() => setSemaines((n) => Math.min(etat.maxWeeks || 12, n + 1))}>+</button>
              </div>
              <label className="small" style={{ display: 'block', margin: '0 0 8px' }}>{t('placements.startsOn')}
                <input type="date" value={dateDebut} min={etat.minStartsOn} max={etat.maxStartsOn} style={{ display: 'block', marginTop: 4, minHeight: 44 }} onChange={(e) => setDateDebut(e.target.value)} />
                <span style={{ display: 'block', color: 'var(--ink-soft)', marginTop: 2 }}>{t('placements.startsOnHelp', { min: jourCourt(etat.minStartsOn), max: jourCourt(etat.maxStartsOn) })}</span>
              </label>
              <p className="small" style={{ margin: '0 0 10px' }}>
                {t('placements.total', { ht: euros(totalHt), tva: euros(tva), ttc: euros(totalHt + tva) })}
              </p>
              <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={occupe} onClick={demander}>
                {occupe ? '…' : t('placements.request')}
              </button>
              <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{etat.auto ? t('placements.autoConfirmNote', { minutes: etat.paymentMinutes || 10 }) : t('placements.confirmNote')}</p>
            </div>
          )}

          {etat.bookings.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <b style={{ fontSize: 14 }}>{t('placements.mine')}</b>
              {etat.bookings.map((b) => (
                <div key={b.id} className="mea-reservation">
                  <div>
                    <span className="mea-rangee">{titre(b.sectionKey, b.sectionLabel)} · {libellePosition(t, b.slot)}</span>
                    <span className="small" style={{ display: 'block' }}>{jourCourt(b.startsOn)} → {jourCourt(b.endsOn)} · {euros(b.totalHt)} {t('placements.exVat')}{b.paidOnline && b.refundStatus !== 'rembourse' ? ` · ${t('placements.paidOnline')}` : ''}</span>
                    {b.decisionNote && b.status !== 'refused' && <span className="small" style={{ display: 'block', color: 'var(--ink-soft)' }}>{b.decisionNote}</span>}
                    {b.refusalReason && <span className="small" style={{ display: 'block' }}>{b.refusalReason}</span>}
                    {b.refundStatus === 'rembourse' && <span className="small" style={{ display: 'block', color: 'var(--iris)' }}>{t('placements.refund_rembourse')}</span>}
                    {b.refundStatus === 'a_rembourser' && <span className="small" style={{ display: 'block', color: 'var(--iris)' }}>{t('placements.refund_a_rembourser')}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`modif-statut mea-statut--${b.status}`}>{t(`placements.status_${b.status}`)}</span>
                    {b.status === 'pending' && <button type="button" className="btn-link small" style={{ display: 'block', marginTop: 4 }} disabled={occupe} onClick={() => retirer(b)}>{t('placements.withdraw')}</button>}
                    {b.status === 'awaiting_payment' && b.checkoutUrl && <a className="btn-teal small" style={{ display: 'inline-block', marginTop: 6, minHeight: 40, lineHeight: '40px', padding: '0 14px' }} href={b.checkoutUrl}>{t('placements.payNow')} · {resteTexte(b.paymentDueAt)}</a>}
                    {b.status === 'awaiting_payment' && <span className="small" style={{ display: 'block', marginTop: 2, color: 'var(--ink-soft)' }}>{t('placements.payWithin', { minutes: resteMinutes(b.paymentDueAt) })}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="small" style={{ margin: '12px 0 0', color: 'var(--ink-soft)' }}>{t('placements.labelNote')}</p>
        </>
      )}
    </div>
  );
}
