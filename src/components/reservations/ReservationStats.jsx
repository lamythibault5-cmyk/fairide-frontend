import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SOURCES, decalerJour, euros, isoDuJour } from './resaUtils';

// STATISTIQUES — volume, couverts, absents, acomptes, remplissage par service, heures de pointe,
// tendance par jour ou par semaine, avis laissés après une réservation. Période au choix.

const JOURS_COURTS = ['wdSun', 'wdMon', 'wdTue', 'wdWed', 'wdThu', 'wdFri', 'wdSat'];
const PERIODES = ['7', '30', '90', 'mois', 'moisPrec', 'avenir'];

function bornes(periode) {
  const aujourdhui = isoDuJour(new Date());
  if (periode === 'mois') return { from: `${aujourdhui.slice(0, 7)}-01`, to: aujourdhui };
  if (periode === 'moisPrec') {
    const [a, m] = aujourdhui.split('-').map(Number);
    const debut = new Date(Date.UTC(a, m - 2, 1, 12)); const fin = new Date(Date.UTC(a, m - 1, 0, 12));
    return { from: debut.toISOString().slice(0, 10), to: fin.toISOString().slice(0, 10) };
  }
  if (periode === 'avenir') return { from: aujourdhui, to: decalerJour(aujourdhui, 30) };
  return { from: decalerJour(aujourdhui, -Number(periode)), to: aujourdhui };
}

export default function ReservationStats({ token, restoId }) {
  const { t } = useLanguage();
  const [periode, setPeriode] = useState('30');
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [personnalise, setPersonnalise] = useState({ from: decalerJour(isoDuJour(new Date()), -30), to: isoDuJour(new Date()) });

  useEffect(() => {
    if (!restoId) return undefined;
    const { from, to } = periode === 'perso' ? personnalise : bornes(periode);
    if (!from || !to || to < from) return undefined;
    let annule = false;
    setChargement(true); setErreur('');
    api(`/restaurants/${restoId}/reservations/stats?from=${from}&to=${to}`, { token })
      .then((s) => { if (!annule) setStats(s); }).catch((e) => { if (!annule) setErreur(e.message); }).finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [restoId, periode, personnalise, token]);

  const maxJour = stats ? Math.max(1, ...stats.parJourSemaine.map((j) => j.couverts)) : 1;
  const heuresUtiles = stats ? stats.parHeure.map((h, i) => ({ ...h, heure: i })).filter((h, i, arr) => {
    const premier = arr.findIndex((x) => x.reservations > 0);
    let dernier = -1; arr.forEach((x, k) => { if (x.reservations > 0) dernier = k; });
    return premier >= 0 && i >= premier && i <= dernier;
  }) : [];
  const maxHeure = Math.max(1, ...heuresUtiles.map((h) => h.couverts));
  const ordreJours = [1, 2, 3, 4, 5, 6, 0];
  // Tendance : par jour si la période fait moins de 6 semaines, sinon par semaine.
  const tendance = (() => {
    if (!stats) return [];
    const { from, to } = periode === 'perso' ? personnalise : bornes(periode);
    const jours = Math.round((new Date(to) - new Date(from)) / 86400000);
    if (jours <= 42) {
      const out = [];
      for (let d = from; d <= to; d = decalerJour(d, 1)) out.push({ cle: d, label: new Date(`${d}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }), ...(stats.parJour[d] || { reservations: 0, couverts: 0 }) });
      return out;
    }
    return Object.entries(stats.parSemaine || {}).sort(([a], [b]) => a.localeCompare(b)).map(([lundi, v]) => ({ cle: lundi, label: t('resa.weekShort', { date: new Date(`${lundi}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }) }), ...v }));
  })();
  const maxTendance = Math.max(1, ...tendance.map((x) => x.couverts));

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ flex: '1 1 auto' }}>{t('resa.period')}</b>
          <div className="resa-filtres" role="group" aria-label={t('resa.period')}>
            {PERIODES.map((p) => <button key={p} type="button" className={periode === p ? 'actif' : ''} onClick={() => setPeriode(p)}>{t(`resa.period_${p}`)}</button>)}
            <button type="button" className={periode === 'perso' ? 'actif' : ''} onClick={() => setPeriode('perso')}>{t('resa.period_perso')}</button>
          </div>
        </div>
        {periode === 'perso' && (
          <div className="row" style={{ gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={personnalise.from} onChange={(e) => setPersonnalise((p) => ({ ...p, from: e.target.value }))} aria-label={t('resa.periodFrom')} />
            <span className="small">→</span>
            <input type="date" value={personnalise.to} onChange={(e) => setPersonnalise((p) => ({ ...p, to: e.target.value }))} aria-label={t('resa.periodTo')} />
          </div>
        )}
      </div>
      {chargement && <p className="small">{t('resa.loading')}</p>}
      {!chargement && erreur && <div className="card"><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erreur}</p></div>}
      {!chargement && !erreur && stats && stats.total === 0 && (
        <div className="card"><div className="resa-vide"><b>{t('resa.statsEmptyTitle')}</b>{t('resa.statsEmptyHelp')}</div></div>
      )}
      {!chargement && !erreur && stats && stats.total > 0 && (
        <>
          <div className="resa-stats">
            <Stat valeur={stats.total} label={t('resa.statReservations')} />
            <Stat valeur={stats.couverts} label={t('resa.statCovers')} />
            <Stat valeur={stats.couvertsMoyens ?? '–'} label={t('resa.statCoversPerTable')} />
            <Stat valeur={stats.enAttente} label={t('resa.statToConfirm')} accent={stats.enAttente > 0 ? 'warn' : undefined} />
            <Stat valeur={stats.tauxAbsence !== null ? `${stats.tauxAbsence} %` : '–'} label={t('resa.statNoShowRate', { n: stats.absents })} accent={stats.absents > 0 ? 'danger' : undefined} />
            <Stat valeur={stats.annulees + stats.refusees} label={t('resa.statCancelled')} />
            <Stat valeur={euros(stats.acompteEncaisse)} label={t('resa.statDepositsCollected')} />
            <Stat valeur={euros(stats.acompteConserve)} label={t('resa.statDepositsKept')} />
            <Stat valeur={stats.avis?.moyenne != null ? `${stats.avis.moyenne.toFixed(1)} ★` : '–'} label={stats.avis?.nombre ? t('resa.statReviews', { n: stats.avis.nombre }) : t('resa.statReviewsNone')} />
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.fillTitle')}</h3>
            <p className="small" style={{ margin: '0 0 10px' }}>{stats.sieges > 0 ? t('resa.fillHelp', { seats: stats.sieges }) : t('resa.fillNoSeats')}</p>
            <div className="resa-services">
              {['midi', 'soir'].map((s) => {
                const v = stats.parService?.[s] || { reservations: 0, couverts: 0, taux: null, jours: 0 };
                return (
                  <div key={s}>
                    <b>{t(`resa.service_${s}`)}</b>
                    <div className="resa-jauge" role="img" aria-label={v.taux !== null ? `${v.taux} %` : ''}><i style={{ width: `${Math.min(100, v.taux || 0)}%` }} /></div>
                    <span className="small">{v.taux !== null ? t('resa.fillRate', { rate: v.taux }) : t('resa.fillNa')} · {t('resa.barTitle', { n: v.reservations, c: v.couverts })}{v.jours ? ` · ${t('resa.fillDays', { n: v.jours })}` : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.trendTitle')}</h3>
            {tendance.length === 0 && <p className="small" style={{ margin: 0 }}>{t('resa.noneInPeriod')}</p>}
            {tendance.length > 0 && (
              <div className="resa-tendance">
                {tendance.map((x) => (
                  <div key={x.cle} title={t('resa.barTitle', { n: x.reservations, c: x.couverts })}>
                    <i style={{ height: `${(x.couverts / maxTendance) * 100}%` }} />
                    <span>{x.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.coversByWeekday')}</h3>
            <div className="resa-barres">
              {ordreJours.map((d) => (
                <div key={d} className="resa-barre-col" title={t('resa.barTitle', { n: stats.parJourSemaine[d].reservations, c: stats.parJourSemaine[d].couverts })}>
                  <span className="small">{stats.parJourSemaine[d].couverts || ''}</span>
                  <div className="resa-barre" style={{ height: `${(stats.parJourSemaine[d].couverts / maxJour) * 100}%` }} />
                  <span className="small">{t(`resa.${JOURS_COURTS[d]}`)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.coversByHour')}</h3>
            {heuresUtiles.length === 0 && <p className="small" style={{ margin: 0 }}>{t('resa.noneInPeriod')}</p>}
            {heuresUtiles.length > 0 && (
              <div className="resa-barres">
                {heuresUtiles.map((h) => (
                  <div key={h.heure} className="resa-barre-col" title={t('resa.barTitle', { n: h.reservations, c: h.couverts })}>
                    <span className="small">{h.couverts || ''}</span>
                    <div className="resa-barre" style={{ height: `${(h.couverts / maxHeure) * 100}%` }} />
                    <span className="small">{h.heure}h</span>
                  </div>
                ))}
              </div>
            )}
            {stats.topHeures?.length > 0 && (
              <p className="small" style={{ margin: '8px 0 0' }}>
                {t('resa.topHours')} {stats.topHeures.map((h) => `${h.heure}h (${h.couverts})`).join(' · ')}
              </p>
            )}
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.sourcesTitle')}</h3>
            <p className="small" style={{ margin: 0 }}>
              {Object.entries(SOURCES).map(([cle, label]) => `${t('resa.' + label)} : ${stats.parSource[cle] || 0}`).join(' · ')}
              {stats.acompteRembourse > 0 && t('resa.depositsRefunded', { amount: euros(stats.acompteRembourse) })}
            </p>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ valeur, label, accent }) {
  return (
    <div className={`resa-stat${accent ? ` resa-stat-${accent}` : ''}`}>
      <b>{valeur}</b>
      <span className="small">{label}</span>
    </div>
  );
}
