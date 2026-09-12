import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, api } from '../../api';
import ReservationSteps from '../ReservationSteps';
import FloorPlan, { AREA_ICONS, areaLabel } from '../FloorPlan';
import { useLanguage } from '../../context/LanguageContext';
import ReservationRow from './ReservationRow';
import { dateCourte, decalerJour, estActive, etatResa, euros, heureInput, heureLocale, instantBruxelles, isoDuJour, libelleJour, lundiDe, minutesDansLeJour, nomTable } from './resaUtils';

// AGENDA — le cahier de réservation : vue jour (grille salle × heures + liste), vue semaine, saisie
// rapide d'une réservation reçue par téléphone, recherche par nom / téléphone, filtres par état,
// impression et export CSV de la journée.

const PLAGE_DEFAUT = { debut: 11, fin: 23 };
const FILTRES = ['tous', 'a_confirmer', 'a_venir', 'en_salle', 'terminees', 'annulees'];
const DUREES = [60, 90, 120, 150, 180, 240];

function filtreOk(filtre, r) {
  const e = etatResa(r);
  if (filtre === 'tous') return true;
  if (filtre === 'a_confirmer') return e === 'a_confirmer';
  if (filtre === 'a_venir') return e === 'confirmee' || e === 'table_prete';
  if (filtre === 'en_salle') return e === 'installee';
  if (filtre === 'terminees') return e === 'terminee' || e === 'no_show';
  if (filtre === 'annulees') return e === 'annulee' || e === 'refusee';
  return true;
}

export default function ReservationsAgenda({ token, toast, restoId, tables, setTables, restaurant }) {
  const { t, locale } = useLanguage();
  const [date, setDate] = useState(() => isoDuJour(new Date()));
  const [vue, setVue] = useState('jour');
  const [donnees, setDonnees] = useState(null);
  const [semaine, setSemaine] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [ouverte, setOuverte] = useState(null);
  const [formulaire, setFormulaire] = useState(null); // null | 'rapide' | 'assistant'
  const [placer, setPlacer] = useState(null);
  const [filtre, setFiltre] = useState('tous');
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [version, setVersion] = useState(0);
  const recharger = () => setVersion((v) => v + 1);
  const minuterie = useRef(null);

  const lundi = lundiDe(date);
  useEffect(() => {
    if (!restoId) return;
    setChargement(true); setErreur('');
    const requete = vue === 'jour'
      ? api(`/restaurants/${restoId}/reservations?date=${date}`, { token }).then(setDonnees)
      : api(`/restaurants/${restoId}/reservations?from=${lundi}&to=${decalerJour(lundi, 6)}`, { token }).then(setSemaine);
    requete.catch((e) => setErreur(e.message)).finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, date, vue, version]);

  // Recherche par nom / téléphone / e-mail, toutes dates : lancée 300 ms après la dernière frappe.
  useEffect(() => {
    clearTimeout(minuterie.current);
    const q = recherche.trim();
    if (q.length < 2) { setResultats(null); setRechercheEnCours(false); return undefined; }
    setRechercheEnCours(true);
    minuterie.current = setTimeout(() => {
      api(`/restaurants/${restoId}/reservations/search?q=${encodeURIComponent(q)}`, { token })
        .then(setResultats).catch((e) => { setResultats([]); toast(e.message); }).finally(() => setRechercheEnCours(false));
    }, 300);
    return () => clearTimeout(minuterie.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, version]);

  const duJour = useMemo(() => {
    if (!donnees) return [];
    return donnees.reservations.filter((r) => {
      const finIso = isoDuJour(new Date(r.startAt + r.durationMinutes * 60000));
      return isoDuJour(new Date(r.startAt)) === date || finIso === date;
    });
  }, [donnees, date]);
  const actives = useMemo(() => duJour.filter(estActive), [duJour]);
  const compte = useMemo(() => Object.fromEntries(FILTRES.map((f) => [f, duJour.filter((r) => filtreOk(f, r)).length])), [duJour]);
  const enAttente = compte.a_confirmer;

  const plage = useMemo(() => {
    let debut = PLAGE_DEFAUT.debut * 60; let fin = PLAGE_DEFAUT.fin * 60;
    for (const r of actives) { const d = minutesDansLeJour(r, date); debut = Math.min(debut, Math.max(0, d)); fin = Math.max(fin, d + r.durationMinutes); }
    return { debut: Math.max(0, Math.floor(debut / 60) * 60), fin: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
  }, [actives, date]);
  const heures = useMemo(() => { const out = []; for (let m = plage.debut; m < plage.fin; m += 60) out.push(m / 60); return out; }, [plage]);
  const tablesActives = (tables || []).filter((tb) => tb.active);
  const couverts = actives.reduce((a, r) => a + (r.partySize || 0), 0);
  const largeurMinutes = Math.max(1, plage.fin - plage.debut);
  const estAujourdhui = date === isoDuJour(new Date());

  function majReservation(maj) {
    // Une réponse /orders (mapOrder) et une réponse /restaurants/.../reservations (mapReservation)
    // n'ont pas la même forme : on ne recopie que ce qui change, et on relit l'agenda derrière.
    const patch = (r) => (r.id === maj.id ? {
      ...r,
      status: maj.status ?? r.status,
      arrival: maj.arrival !== undefined ? maj.arrival : (maj.reservationArrival !== undefined ? maj.reservationArrival : r.arrival),
      depositStatus: maj.depositStatus ?? maj.reservationDepositStatus ?? r.depositStatus,
      internalNote: maj.internalNote ?? maj.reservationInternalNote ?? r.internalNote,
      tableId: maj.tableId !== undefined ? maj.tableId : (maj.reservationTableId !== undefined ? maj.reservationTableId : r.tableId),
      tableIds: maj.tableIds ?? maj.reservationTableIds ?? r.tableIds,
      startAt: maj.startAt ?? maj.scheduledFor ?? r.startAt,
      durationMinutes: maj.durationMinutes ?? maj.reservationDurationMinutes ?? r.durationMinutes,
      partySize: maj.partySize ?? r.partySize,
      reservationName: maj.reservationName ?? r.reservationName,
      clientPhone: maj.clientPhone ?? r.clientPhone,
      clientEmail: maj.clientEmail ?? r.clientEmail,
      guestNote: maj.guestNote ?? r.guestNote,
      guestTags: maj.guestTags ?? r.guestTags,
      guestKey: maj.guestKey ?? r.guestKey,
      messageCount: maj.messageCount ?? r.messageCount
    } : r);
    setDonnees((d) => (d ? { ...d, reservations: d.reservations.map(patch) } : d));
    setSemaine((s) => (s ? { ...s, reservations: s.reservations.map(patch) } : s));
    setResultats((l) => (l ? l.map(patch) : l));
  }

  async function exporterCsv() {
    try {
      const res = await fetch(`${API_BASE}/restaurants/${restoId}/reservations/export?date=${date}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(t('resa.exportFailed'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `reservations-${date}.csv`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast(e.message); }
  }

  const ligneProps = { tables: tables || [], token, toast, restoId, restaurant, onMaj: majReservation, onRecharger: recharger };
  const navPas = vue === 'jour' ? 1 : 7;
  const listeFiltree = duJour.filter((r) => filtreOk(filtre, r)).sort((a, b) => a.startAt - b.startAt);
  const tableDe = (r) => (r.tableIds && r.tableIds.length ? r.tableIds : (r.tableId ? [r.tableId] : [])).map((id) => nomTable((tables || []).find((tb) => tb.id === id))).filter(Boolean).join(' + ');

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, -navPas))} aria-label={vue === 'jour' ? t('resa.prevDay') : t('resa.prevWeek')}>←</button>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', textTransform: 'capitalize' }}>
              {vue === 'jour' ? libelleJour(date, false, locale) : `${t('resa.weekOf')} ${libelleJour(lundi, true, locale)}`}
            </b>
            {!estAujourdhui && (
              <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => setDate(isoDuJour(new Date()))}>{t('resa.backToToday')}</button>
            )}
          </div>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, navPas))} aria-label={vue === 'jour' ? t('resa.nextDay') : t('resa.nextWeek')}>→</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ flex: '1 1 150px', maxWidth: 200 }} aria-label={t('resa.day')} />
          <div className="resa-bascule" role="group" aria-label={t('resa.ariaView')}>
            <button type="button" className={vue === 'jour' ? 'actif' : ''} onClick={() => setVue('jour')}>{t('resa.day')}</button>
            <button type="button" className={vue === 'semaine' ? 'actif' : ''} onClick={() => setVue('semaine')}>{t('resa.week')}</button>
          </div>
          <button type="button" className="btn-teal" style={{ marginLeft: 'auto' }} onClick={() => setFormulaire((f) => (f === 'rapide' ? null : 'rapide'))}>
            {formulaire === 'rapide' ? t('resa.close') : t('resa.quickAddPhone')}
          </button>
        </div>
        <div className="resa-outils">
          <div className="resa-recherche">
            <input value={recherche} placeholder={t('resa.searchPh')} onChange={(e) => setRecherche(e.target.value)} aria-label={t('resa.searchAria')} />
          </div>
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => window.print()} disabled={vue !== 'jour' || !duJour.length}>{t('resa.print')}</button>
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={exporterCsv} disabled={vue !== 'jour'}>{t('resa.exportCsv')}</button>
          <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setFormulaire((f) => (f === 'assistant' ? null : 'assistant'))}>{t('resa.fullWizard')}</button>
        </div>
      </div>

      {formulaire === 'rapide' && (
        <SaisieRapide restoId={restoId} token={token} toast={toast} tables={tablesActives} date={date}
          onClose={() => setFormulaire(null)}
          onDone={(r) => { setFormulaire(null); setDate(isoDuJour(new Date(r.startAt))); setVue('jour'); setOuverte(r.id); recharger(); }} />
      )}
      {formulaire === 'assistant' && (
        <ReservationSteps mode="resto" restaurantId={restoId} restaurant={restaurant} token={token} tables={tablesActives} dateInitiale={date}
          onClose={() => setFormulaire(null)}
          onDone={(r) => { setFormulaire(null); setDate(isoDuJour(new Date(r.startAt))); setVue('jour'); setOuverte(r.id); recharger(); }} />
      )}

      {placer && (
        <div className="card">
          <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>{t('resa.placeOnPlanTitle', { name: placer.reservationName })}</h3>
            <button type="button" className="btn-ghost" onClick={() => setPlacer(null)}>{t('resa.close')}</button>
          </div>
          <FloorPlan restoId={restoId} token={token} toast={toast} tables={tables} setTables={setTables} restaurant={restaurant}
            dateInitiale={isoDuJour(new Date(placer.startAt))} heureInitiale={heureInput(placer.startAt)}
            assigner={{
              reservation: placer,
              onChoisir: async (tb) => {
                try {
                  const maj = await api(`/restaurants/${restoId}/reservations/${placer.id}`, { method: 'PATCH', token, body: { tableId: tb.id, notifier: false } });
                  majReservation(maj);
                  toast(t('resa.toastTableAssigned', { n: tb.number ?? tb.name }));
                  setPlacer(null);
                  recharger();
                } catch (e) { toast(e.message); }
              }
            }} />
        </div>
      )}

      {/* Résultats de recherche : remplacent la journée tant qu'une recherche est tapée. */}
      {recherche.trim().length >= 2 && (
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.searchResults', { q: recherche.trim() })}</h3>
          {rechercheEnCours && <p className="small">{t('resa.loading')}</p>}
          {!rechercheEnCours && resultats && resultats.length === 0 && <div className="resa-vide"><b>{t('resa.searchEmptyTitle')}</b>{t('resa.searchEmptyHelp')}</div>}
          {resultats && resultats.map((r) => (
            <div key={r.id}>
              <p className="small" style={{ margin: '8px 0 2px', textTransform: 'capitalize' }}>{libelleJour(isoDuJour(new Date(r.startAt)), true, locale)}</p>
              <ReservationRow r={r} ouverte={ouverte === r.id} onToggle={() => setOuverte(ouverte === r.id ? null : r.id)} {...ligneProps}
                onPlacer={() => { setRecherche(''); setDate(isoDuJour(new Date(r.startAt))); setPlacer(r); }} />
            </div>
          ))}
        </div>
      )}

      {recherche.trim().length < 2 && (
        <>
          {chargement && <p className="small">{t('resa.loading')}</p>}
          {!chargement && erreur && (
            <div className="card"><p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erreur}</p><button type="button" className="btn-outline" style={{ marginTop: 8 }} onClick={recharger}>{t('resa.retry')}</button></div>
          )}

          {!chargement && !erreur && vue === 'semaine' && semaine && (
            <VueSemaine lundi={lundi} reservations={semaine.reservations} onJour={(iso) => { setDate(iso); setVue('jour'); }} />
          )}

          {!chargement && !erreur && vue === 'jour' && donnees && (
            <>
              {tablesActives.length === 0 && (
                <div className="card">
                  <p className="small" style={{ margin: 0 }}>
                    {t('resa.noTablesGrid1')} <b>{t('resa.noTablesGrid2')}</b>{t('resa.noTablesGrid3')} <b>{t('resa.floorPlan')}</b>.
                  </p>
                </div>
              )}

              {tablesActives.length > 0 && actives.length > 0 && (
                <div className="card">
                  <p className="small" style={{ margin: '0 0 10px' }}>
                    {t('resa.daySummary', { n: actives.length, c: couverts, k: tablesActives.length })}
                    {enAttente > 0 && <> · <span className="status-badge status-nouveau">{t('resa.toConfirmCount', { n: enAttente })}</span></>}
                  </p>
                  <div className="resa-grid-wrap">
                    <div className="resa-grid" style={{ '--resa-heures': heures.length }}>
                      <div className="resa-grid-coin" />
                      {heures.map((h) => <div key={h} className="resa-grid-heure">{String(h).padStart(2, '0')}h</div>)}
                      {tablesActives.map((tb) => (
                        <Fragment key={tb.id}>
                          <div className="resa-grid-table">
                            <b title={tb.name}>{nomTable(tb)}</b>
                            <span className="small">{t('resa.seatsShort', { n: tb.seats })} · {AREA_ICONS[tb.area] || ''} {areaLabel(t, tb.area)}</span>
                          </div>
                          <div className="resa-grid-piste">
                            {actives.filter((r) => (r.tableIds && r.tableIds.length ? r.tableIds : [r.tableId]).includes(tb.id)).map((r) => {
                              const d = minutesDansLeJour(r, date);
                              const g = Math.max(d, plage.debut);
                              const f = Math.min(d + r.durationMinutes, plage.fin);
                              if (f <= g) return null;
                              const e = etatResa(r);
                              return (
                                <button type="button" key={r.id}
                                  className={`resa-bloc resa-bloc-${r.status} resa-bloc-e-${e}${r.arrival === 'arrive' ? ' resa-bloc-arrive' : ''}${r.arrival === 'no_show' ? ' resa-bloc-absent' : ''}${ouverte === r.id ? ' resa-bloc-choisi' : ''}`}
                                  style={{ left: `${((g - plage.debut) / largeurMinutes) * 100}%`, width: `${((f - g) / largeurMinutes) * 100}%` }}
                                  title={t('resa.blocTitle', { name: r.reservationName, n: r.partySize, time: heureLocale(r.startAt) })}
                                  onClick={() => { setOuverte(ouverte === r.id ? null : r.id); setFiltre('tous'); }}>
                                  <b>{r.reservationName}</b>
                                  <span>{r.partySize}p{r.depositAmount > 0 ? ' · 💳' : ''}{r.note ? ' · 💬' : ''}</span>
                                </button>
                              );
                            })}
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                  {actives.some((r) => !r.tableId) && (
                    <p className="small" style={{ margin: '10px 0 0', padding: '8px 10px', background: 'var(--cream-dim)', borderRadius: 9 }}>
                      {t('resa.withoutTableWarn', { n: actives.filter((r) => !r.tableId).length })}
                    </p>
                  )}
                </div>
              )}

              <div className="card">
                <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, flex: '1 1 auto' }}>{t('resa.inArrivalOrder')}</h3>
                  {duJour.length > 0 && (
                    <div className="resa-filtres" role="group" aria-label={t('resa.filtersAria')}>
                      {FILTRES.map((f) => (
                        <button key={f} type="button" className={filtre === f ? 'actif' : ''} onClick={() => setFiltre(f)}>{t(`resa.filter_${f}`)}<b>{compte[f]}</b></button>
                      ))}
                    </div>
                  )}
                </div>
                {duJour.length === 0 && (
                  <div className="resa-vide">
                    <b>{t('resa.emptyDayTitle')}</b>
                    {t('resa.emptyDayHelp')}
                    <div style={{ marginTop: 10 }}><button type="button" className="btn-outline" onClick={() => setFormulaire('rapide')}>{t('resa.quickAddPhone')}</button></div>
                  </div>
                )}
                {duJour.length > 0 && listeFiltree.length === 0 && <p className="small" style={{ margin: 0 }}>{t('resa.filterEmpty')}</p>}
                {listeFiltree.map((r) => (
                  <ReservationRow key={r.id} r={r} ouverte={ouverte === r.id} onToggle={() => setOuverte(ouverte === r.id ? null : r.id)} onPlacer={() => setPlacer(r)} {...ligneProps} />
                ))}
              </div>

              {/* Feuille de service imprimable (visible seulement à l'impression, voir reservations.css). */}
              <div className="resa-print-zone" aria-hidden="true">
                <h1>{restaurant?.name}, {libelleJour(date, false, locale)}</h1>
                <p>{t('resa.daySummary', { n: actives.length, c: couverts, k: tablesActives.length })}</p>
                <table>
                  <thead><tr><th>{t('resa.time')}</th><th>{t('resa.name')}</th><th>{t('resa.ppl')}</th><th>{t('resa.table')}</th><th>{t('resa.phone')}</th><th>{t('resa.printStatus')}</th><th>{t('resa.printNotes')}</th></tr></thead>
                  <tbody>
                    {duJour.filter(estActive).sort((a, b) => a.startAt - b.startAt).map((r) => (
                      <tr key={r.id}>
                        <td>{heureLocale(r.startAt)}</td><td>{r.reservationName}</td><td>{r.partySize}</td><td>{tableDe(r)}</td><td>{r.clientPhone || ''}</td>
                        <td>{t(`resa.st_${etatResa(r)}`)}{r.depositAmount > 0 ? ` · ${euros(r.depositAmount)}` : ''}</td>
                        <td>{[r.note, r.internalNote, r.guestNote, ...(r.guestTags || [])].filter(Boolean).join(' · ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small">{t('resa.printedAt', { date: dateCourte(Date.now()) })}</p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

// Saisie rapide d'une réservation prise au téléphone ou au comptoir : une seule carte, les champs
// essentiels, confirmée d'office. L'assistant complet (calendrier, créneaux) reste à un clic.
function SaisieRapide({ restoId, token, toast, tables, date, onClose, onDone }) {
  const { t } = useLanguage();
  const [f, setF] = useState({ nom: '', tel: '', email: '', couverts: 2, date, heure: '19:30', duree: 120, tableId: '', source: 'phone', note: '', noteInterne: '' });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.nom.trim()) { setErreur(t('resa.toastNameRequired')); return; }
    setEnvoi(true); setErreur('');
    try {
      const r = await api(`/restaurants/${restoId}/reservations`, {
        method: 'POST', token,
        body: {
          reservationName: f.nom.trim(), clientPhone: f.tel.trim(), clientEmail: f.email.trim(), partySize: Number(f.couverts),
          startAt: instantBruxelles(f.date, f.heure), durationMinutes: Number(f.duree), tableId: f.tableId || null,
          internalNote: f.noteInterne.trim(), note: f.note.trim(), source: f.source
        }
      });
      toast(t('resa.toastAdded'));
      onDone(r);
    } catch (err) { setErreur(err.message); } finally { setEnvoi(false); }
  }

  return (
    <form className="card" onSubmit={enregistrer}>
      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>{t('resa.quickTitle')}</h3>
        <button type="button" className="btn-ghost" onClick={onClose}>{t('resa.close')}</button>
      </div>
      <div className="resa-choices" style={{ marginBottom: 10 }}>
        {[['phone', '📞', t('resa.phone')], ['walk_in', '🚶', t('resa.walkIn')], ['restaurant', '✉️', t('resa.otherSource')]].map(([v, ico, lib]) => (
          <button key={v} type="button" className={f.source === v ? 'active' : ''} onClick={() => setF((s) => ({ ...s, source: v }))}>{ico} {lib}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 180px' }}>
          <label htmlFor="qa-nom">{t('resa.name')}</label>
          <input id="qa-nom" value={f.nom} maxLength={80} autoFocus onChange={champ('nom')} placeholder={t('resa.phName')} required />
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <label htmlFor="qa-tel">{t('resa.phone')}</label>
          <input id="qa-tel" type="tel" value={f.tel} maxLength={30} onChange={champ('tel')} placeholder="+32 4xx xx xx xx" />
        </div>
        <div style={{ flex: '0 0 90px' }}>
          <label htmlFor="qa-couverts">{t('resa.ppl')}</label>
          <input id="qa-couverts" type="number" min="1" max="200" value={f.couverts} onChange={champ('couverts')} required />
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
        <div style={{ flex: '1 1 140px' }}>
          <label htmlFor="qa-date">{t('resa.day')}</label>
          <input id="qa-date" type="date" value={f.date} onChange={champ('date')} required />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <label htmlFor="qa-heure">{t('resa.time')}</label>
          <input id="qa-heure" type="time" step="900" value={f.heure} onChange={champ('heure')} required />
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <label htmlFor="qa-duree">{t('resa.duration')}</label>
          <select id="qa-duree" value={f.duree} onChange={champ('duree')}>
            {DUREES.map((m) => <option key={m} value={m}>{m % 60 ? t('resa.durationHM', { h: Math.floor(m / 60), m: m % 60 }) : t('resa.durationH', { h: m / 60 })}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label htmlFor="qa-table">{t('resa.table')}</label>
          <select id="qa-table" value={f.tableId} onChange={champ('tableId')}>
            <option value="">{t('resa.automaticSmallest')}</option>
            {tables.map((tb) => <option key={tb.id} value={tb.id}>{nomTable(tb)} ({t('resa.seatsShort', { n: tb.seats })})</option>)}
          </select>
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="qa-email">{t('resa.emailOptional')}</label>
          <input id="qa-email" type="email" value={f.email} maxLength={200} onChange={champ('email')} />
        </div>
        <div style={{ flex: '2 1 240px' }}>
          <label htmlFor="qa-note">{t('resa.internalNoteShort')}</label>
          <input id="qa-note" value={f.noteInterne} maxLength={1000} onChange={champ('noteInterne')} placeholder={t('resa.phInternalNoteShort')} />
        </div>
      </div>
      {erreur && <p className="small" style={{ color: 'var(--red)', margin: '8px 0 0' }}>{erreur}</p>}
      <p className="small" style={{ margin: '8px 0 0' }}>{f.email.trim() ? t('resa.quickHelpEmail') : t('resa.quickHelp')}</p>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('resa.addToAgenda')}</button>
      </div>
    </form>
  );
}

function VueSemaine({ lundi, reservations, onJour }) {
  const { t, locale } = useLanguage();
  const jours = Array.from({ length: 7 }, (_, i) => decalerJour(lundi, i));
  const aujourdhui = isoDuJour(new Date());
  return (
    <div className="card">
      <div className="resa-semaine">
        {jours.map((iso) => {
          const duJour = reservations.filter((r) => isoDuJour(new Date(r.startAt)) === iso && estActive(r)).sort((a, b) => a.startAt - b.startAt);
          const couverts = duJour.reduce((a, r) => a + (r.partySize || 0), 0);
          const attente = duJour.filter((r) => r.status === 'nouveau').length;
          return (
            <button type="button" key={iso} className={`resa-semaine-jour${iso === aujourdhui ? ' aujourdhui' : ''}`} onClick={() => onJour(iso)}>
              <b style={{ textTransform: 'capitalize' }}>{libelleJour(iso, true, locale)}</b>
              <span className="small">{duJour.length ? t('resa.weekSummary', { n: duJour.length, c: couverts }) : t('resa.nothing')}</span>
              {attente > 0 && <span className="status-badge status-nouveau">{t('resa.toConfirmCount', { n: attente })}</span>}
              <span className="resa-semaine-liste">
                {duJour.slice(0, 5).map((r) => <span key={r.id}>{heureLocale(r.startAt)} {r.reservationName} ({r.partySize})</span>)}
                {duJour.length > 5 && <span>+{duJour.length - 5}…</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
