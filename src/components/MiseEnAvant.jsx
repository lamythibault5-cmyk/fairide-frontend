import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { TITRES_RANGEES, euros, jourCourt } from '../misesEnAvant';

// Promotions › Mise en avant (fondateur, 2026-10-02). Le commerçant choisit une rangée de la liste (« Healthy », « Autour
// de vous »…), la 1re, 2e ou 3e position et une durée ; le prix par semaine est celui réglé par Fairide. Comme pour les
// prix et la carte : c'est une DEMANDE, que l'équipe confirme avant qu'elle ne s'affiche.
const POSITIONS = ['pos1', 'pos2', 'pos3'];

export default function MiseEnAvant({ restoId, token, toast }) {
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null);
  const [choix, setChoix] = useState(null); // { sectionKey, slot }
  const [semaines, setSemaines] = useState(1);
  const [occupe, setOccupe] = useState(false);

  const charger = useCallback(() => {
    api(`/restaurants/${restoId}/placements`, { token }).then(setEtat).catch((e) => toast(e.message, 'erreur'));
  }, [restoId, token, toast]);
  useEffect(() => { charger(); }, [charger]);

  const section = choix && etat?.sections.find((s) => s.key === choix.sectionKey);
  const prix = section?.prices.find((p) => p.slot === choix.slot)?.weeklyPrice ?? 0;
  const totalHt = prix * semaines;
  const tva = totalHt * (etat?.vatRate ?? 0.21);
  const titre = (cle, repli) => (TITRES_RANGEES[cle] ? t(`restaurantList.${TITRES_RANGEES[cle]}`) : repli);

  async function demander() {
    setOccupe(true);
    try {
      await api(`/restaurants/${restoId}/placements`, { method: 'POST', token, body: { sectionKey: choix.sectionKey, slot: choix.slot, weeks: semaines } });
      toast(t('placements.requested'));
      setChoix(null); setSemaines(1); charger();
    } catch (e) { toast(e.message, 'erreur'); charger(); } finally { setOccupe(false); }
  }
  async function retirer(b) {
    setOccupe(true);
    try { await api(`/restaurants/${restoId}/placements/${b.id}`, { method: 'DELETE', token }); toast(t('placements.withdrawn')); charger(); }
    catch (e) { toast(e.message, 'erreur'); } finally { setOccupe(false); }
  }

  return (
    <div className="card mise-en-avant" id="mise-en-avant">
      <h3 style={{ margin: 0, fontSize: 16 }}>📌 {t('placements.title')}</h3>
      <p className="small" style={{ margin: '4px 0 12px' }}>{t('placements.intro')}</p>
      {!etat && <p className="small">…</p>}
      {etat && (
        <>
          <div className="mea-grille" role="table" aria-label={t('placements.title')}>
            <div className="mea-ligne mea-entete" role="row">
              <span role="columnheader">{t('placements.row')}</span>
              {POSITIONS.map((p) => <span key={p} role="columnheader">{t(`placements.${p}`)}</span>)}
            </div>
            {etat.sections.map((s) => (
              <div className="mea-ligne" role="row" key={s.key}>
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
              <b>{t('placements.summary', { row: titre(section.key, section.label), pos: t(`placements.pos${choix.slot}`) })}</b>
              <div className="row" style={{ gap: 8, alignItems: 'center', margin: '8px 0', flexWrap: 'wrap' }}>
                <button type="button" className="btn-ghost" style={{ minWidth: 44, minHeight: 44 }} aria-label="−" disabled={semaines <= 1} onClick={() => setSemaines((n) => Math.max(1, n - 1))}>−</button>
                <span style={{ minWidth: 96, textAlign: 'center', fontWeight: 700 }}>{t('placements.weeks', { n: semaines })}</span>
                <button type="button" className="btn-ghost" style={{ minWidth: 44, minHeight: 44 }} aria-label="+" disabled={semaines >= (etat.maxWeeks || 12)} onClick={() => setSemaines((n) => Math.min(etat.maxWeeks || 12, n + 1))}>+</button>
              </div>
              <p className="small" style={{ margin: '0 0 10px' }}>
                {t('placements.total', { ht: euros(totalHt), tva: euros(tva), ttc: euros(totalHt + tva) })}
              </p>
              <button type="button" className="btn-teal" style={{ width: '100%', minHeight: 48 }} disabled={occupe} onClick={demander}>
                {occupe ? '…' : t('placements.request')}
              </button>
              <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('placements.confirmNote')}</p>
            </div>
          )}

          {etat.bookings.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <b style={{ fontSize: 14 }}>{t('placements.mine')}</b>
              {etat.bookings.map((b) => (
                <div key={b.id} className="mea-reservation">
                  <div>
                    <span className="mea-rangee">{titre(b.sectionKey, b.sectionLabel)} · {t(`placements.pos${b.slot}`)}</span>
                    <span className="small" style={{ display: 'block' }}>{jourCourt(b.startsOn)} → {jourCourt(b.endsOn)} · {euros(b.totalHt)} {t('placements.exVat')}</span>
                    {b.refusalReason && <span className="small" style={{ display: 'block' }}>{b.refusalReason}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`modif-statut mea-statut--${b.status}`}>{t(`placements.status_${b.status}`)}</span>
                    {b.status === 'pending' && <button type="button" className="btn-link small" style={{ display: 'block', marginTop: 4 }} disabled={occupe} onClick={() => retirer(b)}>{t('placements.withdraw')}</button>}
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
