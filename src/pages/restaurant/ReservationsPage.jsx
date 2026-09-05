import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { statusLabel } from '../../orderStatus';
import { useLanguage, getLocale } from '../../context/LanguageContext';

// Réservations : tout ce que le restaurateur fait avec ses tables, en un seul endroit.
//
// Quatre onglets, quatre questions. AGENDA : qui vient, quand, où — et quoi faire de chaque demande
// (confirmer, pointer l'arrivée, déplacer, annoter). RÉGLAGES : ce que le client peut réserver en
// ligne (jour même, préavis, horizon, groupe, acompte, annulation). PLAN DE SALLE : les tables, leur
// zone et leur acompte propre. STATISTIQUES : ce que la salle a fait, pour ajuster les trois autres.
//
// Une réservation reste une commande `dine_in` côté serveur (voir routes/orders.js) : les actions de
// statut passent par /orders/:id/…, la lecture et les modifications de champ par
// /restaurants/:id/reservations.

const PLAGE_DEFAUT = { debut: 11, fin: 23 };
const JOURS = [
  { cle: 'mon', label: 'monday' }, { cle: 'tue', label: 'tuesday' }, { cle: 'wed', label: 'wednesday' },
  { cle: 'thu', label: 'thursday' }, { cle: 'fri', label: 'friday' }, { cle: 'sat', label: 'saturday' },
  { cle: 'sun', label: 'sunday' }
];
const JOURS_COURTS = ['wdSun', 'wdMon', 'wdTue', 'wdWed', 'wdThu', 'wdFri', 'wdSat'];
const SOURCES = { client: 'srcClient', restaurant: 'srcRestaurant', phone: 'srcPhone', walk_in: 'srcWalkIn' };
const ACOMPTE_LABEL = { pending: 'depPending', paid: 'depPaid', refunded: 'depRefunded', kept: 'depKept' };
const ONGLETS = [
  { cle: 'agenda', label: 'tabAgenda' },
  { cle: 'reglages', label: 'tabSettings' },
  { cle: 'salle', label: 'tabFloor' },
  { cle: 'stats', label: 'tabStats' }
];

function isoDuJour(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}
function heureLocale(ms) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}
// Minutes depuis minuit, à l'heure de Bruxelles — le navigateur du restaurateur peut être ailleurs,
// et une réservation doit s'afficher à l'heure de sa salle, pas à celle de son téléphone.
function minutesLocales(ms) {
  const [h, m] = heureLocale(ms).split(':').map(Number);
  return h * 60 + m;
}
// Minutes depuis minuit DU JOUR AFFICHÉ — négatif pour une réservation entamée la veille.
function minutesDansLeJour(r, date) {
  const m = minutesLocales(r.startAt);
  return isoDuJour(new Date(r.startAt)) === date ? m : m - 1440;
}
function decalerJour(iso, jours) {
  const [a, mo, j] = iso.split('-').map(Number);
  return isoDuJour(new Date(Date.UTC(a, mo - 1, j + jours, 12)));
}
function libelleJour(iso, court = false, locale = getLocale()) {
  const [a, mo, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, court ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(a, mo - 1, j, 12)));
}
function lundiDe(iso) {
  const [a, mo, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j, 12));
  const decal = (d.getUTCDay() + 6) % 7;
  return decalerJour(iso, -decal);
}
function euros(n) { return `${Number(n || 0).toFixed(2).replace('.', ',')} €`; }
function estClose(r) { return ['refuse', 'annule', 'livre'].includes(r.status); }

export default function ReservationsPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId, loadDashboard } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const onglet = ONGLETS.some((o) => o.cle === searchParams.get('onglet')) ? searchParams.get('onglet') : 'agenda';

  // Les tables servent à trois onglets (agenda, plan de salle, réglages d'acompte) : chargées ici.
  const [tables, setTables] = useState(null);
  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/tables`, { token }).then(setTables).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  const commun = { token, toast, restaurant, restoId, loadDashboard, tables, setTables };

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('resa.title')}</h2>

      <div className="resa-onglets" role="tablist" aria-label={t('resa.ariaSections')}>
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`resa-onglet${onglet === o.cle ? ' actif' : ''}`}
            onClick={() => setSearchParams(o.cle === 'agenda' ? {} : { onglet: o.cle })}>
            {t(`resa.${o.label}`)}
          </button>
        ))}
      </div>

      {!restaurant?.offersDineIn && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          <p className="small" style={{ margin: 0 }}>
            {t('resa.disabledIntro')}
            <b> {t('resa.disabledPath')}</b>.
          </p>
        </div>
      )}

      {onglet === 'agenda' && <Agenda {...commun} />}
      {onglet === 'reglages' && <Reglages {...commun} />}
      {onglet === 'salle' && <PlanDeSalle {...commun} />}
      {onglet === 'stats' && <Statistiques {...commun} />}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// AGENDA — jour (grille salle × heures + liste) ou semaine (sept colonnes), saisie manuelle, actions.
// ------------------------------------------------------------------------------------------------
function Agenda({ token, toast, restoId, tables, restaurant }) {
  const { t, locale } = useLanguage();
  const [date, setDate] = useState(() => isoDuJour(new Date()));
  const [vue, setVue] = useState('jour');
  const [donnees, setDonnees] = useState(null);
  const [semaine, setSemaine] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [ouverte, setOuverte] = useState(null);
  const [formulaire, setFormulaire] = useState(false);
  const [version, setVersion] = useState(0);
  const recharger = () => setVersion((v) => v + 1);

  const lundi = lundiDe(date);
  useEffect(() => {
    if (!restoId) return;
    setChargement(true);
    const requete = vue === 'jour'
      ? api(`/restaurants/${restoId}/reservations?date=${date}`, { token }).then(setDonnees)
      : api(`/restaurants/${restoId}/reservations?from=${lundi}&to=${decalerJour(lundi, 6)}`, { token }).then(setSemaine);
    requete.catch((e) => toast(e.message)).finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, date, vue, version]);

  // Les réservations renvoyées débordent d'un jour de chaque côté ; on garde celles qui touchent le jour.
  const duJour = useMemo(() => {
    if (!donnees) return [];
    return donnees.reservations.filter((r) => {
      const finIso = isoDuJour(new Date(r.startAt + r.durationMinutes * 60000));
      return isoDuJour(new Date(r.startAt)) === date || finIso === date;
    });
  }, [donnees, date]);
  const actives = useMemo(() => duJour.filter((r) => !['refuse', 'annule'].includes(r.status)), [duJour]);
  const enAttente = actives.filter((r) => r.status === 'nouveau').length;

  const plage = useMemo(() => {
    let debut = PLAGE_DEFAUT.debut * 60;
    let fin = PLAGE_DEFAUT.fin * 60;
    for (const r of actives) {
      const d = minutesDansLeJour(r, date);
      debut = Math.min(debut, Math.max(0, d));
      fin = Math.max(fin, d + r.durationMinutes);
    }
    return { debut: Math.max(0, Math.floor(debut / 60) * 60), fin: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
  }, [actives, date]);
  const heures = useMemo(() => {
    const out = [];
    for (let m = plage.debut; m < plage.fin; m += 60) out.push(m / 60);
    return out;
  }, [plage]);
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
      arrival: maj.arrival ?? maj.reservationArrival ?? r.arrival,
      depositStatus: maj.depositStatus ?? maj.reservationDepositStatus ?? r.depositStatus,
      internalNote: maj.internalNote ?? maj.reservationInternalNote ?? r.internalNote,
      tableId: maj.tableId !== undefined ? maj.tableId : (maj.reservationTableId !== undefined ? maj.reservationTableId : r.tableId),
      startAt: maj.startAt ?? maj.scheduledFor ?? r.startAt,
      durationMinutes: maj.durationMinutes ?? maj.reservationDurationMinutes ?? r.durationMinutes,
      partySize: maj.partySize ?? r.partySize,
      reservationName: maj.reservationName ?? r.reservationName,
      clientPhone: maj.clientPhone ?? r.clientPhone,
      clientEmail: maj.clientEmail ?? r.clientEmail
    } : r);
    setDonnees((d) => (d ? { ...d, reservations: d.reservations.map(patch) } : d));
    setSemaine((s) => (s ? { ...s, reservations: s.reservations.map(patch) } : s));
  }

  const navPas = vue === 'jour' ? 1 : 7;
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
              <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }}
                onClick={() => setDate(isoDuJour(new Date()))}>{t('resa.backToToday')}</button>
            )}
          </div>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, navPas))} aria-label={vue === 'jour' ? t('resa.nextDay') : t('resa.nextWeek')}>→</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ flex: '1 1 150px', maxWidth: 200 }} />
          <div className="resa-bascule" role="group" aria-label={t('resa.ariaView')}>
            <button type="button" className={vue === 'jour' ? 'actif' : ''} onClick={() => setVue('jour')}>{t('resa.day')}</button>
            <button type="button" className={vue === 'semaine' ? 'actif' : ''} onClick={() => setVue('semaine')}>{t('resa.week')}</button>
          </div>
          <button type="button" className="btn-teal" style={{ marginLeft: 'auto' }} onClick={() => setFormulaire((f) => !f)}>
            {formulaire ? t('resa.close') : t('resa.addReservation')}
          </button>
        </div>
      </div>

      {formulaire && (
        <NouvelleReservation token={token} toast={toast} restoId={restoId} tables={tablesActives} restaurant={restaurant}
          dateInitiale={date}
          onCree={(r) => { setFormulaire(false); setDate(isoDuJour(new Date(r.startAt))); setVue('jour'); setOuverte(r.id); recharger(); }} />
      )}

      {chargement && <p className="small">{t('resa.loading')}</p>}

      {!chargement && vue === 'semaine' && semaine && (
        <VueSemaine lundi={lundi} reservations={semaine.reservations} onJour={(iso) => { setDate(iso); setVue('jour'); }} />
      )}

      {!chargement && vue === 'jour' && donnees && (
        <>
          {tablesActives.length === 0 && (
            <div className="card">
              <p className="small" style={{ margin: 0 }}>
                {t('resa.noTablesGrid1')} <b>{t('resa.noTablesGrid2')}</b>{t('resa.noTablesGrid3')} <b>{t('resa.floorPlan')}</b>.
              </p>
            </div>
          )}

          {tablesActives.length > 0 && (
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
                        <b title={tb.name}>{tb.name}</b>
                        <span className="small">{t('resa.seatsShort', { n: tb.seats })}{tb.zone ? ` · ${tb.zone}` : ''}</span>
                      </div>
                      <div className="resa-grid-piste">
                        {actives.filter((r) => r.tableId === tb.id).map((r) => {
                          const d = minutesDansLeJour(r, date);
                          const g = Math.max(d, plage.debut);
                          const f = Math.min(d + r.durationMinutes, plage.fin);
                          if (f <= g) return null;
                          return (
                            <button type="button" key={r.id}
                              className={`resa-bloc resa-bloc-${r.status}${r.arrival === 'arrive' ? ' resa-bloc-arrive' : ''}${r.arrival === 'no_show' ? ' resa-bloc-absent' : ''}${ouverte === r.id ? ' resa-bloc-choisi' : ''}`}
                              style={{ left: `${((g - plage.debut) / largeurMinutes) * 100}%`, width: `${((f - g) / largeurMinutes) * 100}%` }}
                              title={t('resa.blocTitle', { name: r.reservationName, n: r.partySize, time: heureLocale(r.startAt) })}
                              onClick={() => setOuverte(ouverte === r.id ? null : r.id)}>
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
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{t('resa.inArrivalOrder')}</h3>
            {duJour.length === 0 && <p className="small" style={{ margin: 0 }}>{t('resa.noneThatDay')}</p>}
            {duJour.slice().sort((a, b) => a.startAt - b.startAt).map((r) => (
              <LigneReservation key={r.id} r={r} tables={tables || []} ouverte={ouverte === r.id}
                onToggle={() => setOuverte(ouverte === r.id ? null : r.id)}
                token={token} toast={toast} restoId={restoId} onMaj={majReservation} onRecharger={recharger} />
            ))}
          </div>
        </>
      )}
    </>
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
          const duJour = reservations.filter((r) => isoDuJour(new Date(r.startAt)) === iso && !['refuse', 'annule'].includes(r.status)).sort((a, b) => a.startAt - b.startAt);
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

function LigneReservation({ r, tables, ouverte, onToggle, token, toast, restoId, onMaj, onRecharger }) {
  const { t } = useLanguage();
  const table = tables.find((tb) => tb.id === r.tableId);
  const [enCours, setEnCours] = useState(null);
  const [noteInterne, setNoteInterne] = useState(r.internalNote || '');
  const [message, setMessage] = useState('');
  const [garderAcompte, setGarderAcompte] = useState(false);
  const [deplacement, setDeplacement] = useState(false);
  const [heure, setHeure] = useState(heureLocale(r.startAt));
  const [jour, setJour] = useState(isoDuJour(new Date(r.startAt)));
  const [duree, setDuree] = useState(r.durationMinutes);
  const [couverts, setCouverts] = useState(r.partySize);
  useEffect(() => { setNoteInterne(r.internalNote || ''); }, [r.internalNote]);

  async function action(nom, requete) {
    setEnCours(nom);
    try {
      const maj = await requete();
      if (maj) onMaj(maj);
      onRecharger();
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  const ordre = (chemin, body) => api(`/orders/${r.id}/${chemin}`, { method: 'PATCH', token, body });
  const champ = (body) => api(`/restaurants/${restoId}/reservations/${r.id}`, { method: 'PATCH', token, body });

  const aVenir = !estClose(r);
  const finie = r.status === 'livre';
  return (
    <div className={`resa-ligne${ouverte ? ' ouverte' : ''}`}>
      <button type="button" className="resa-ligne-tete" onClick={onToggle} aria-expanded={ouverte}>
        <div className="resa-ligne-heure">
          <b>{heureLocale(r.startAt)}</b>
          <span className="small">{heureLocale(r.startAt + r.durationMinutes * 60000)}</span>
        </div>
        <div className="resa-ligne-corps">
          <b>{r.reservationName}{r.arrival === 'arrive' ? ' ✅' : r.arrival === 'no_show' ? ' ❌' : ''}</b>
          <span className="small">
            {t('resa.nPeople', { n: r.partySize })}
            {table ? ` · ${table.name}` : t('resa.noTableAssigned')}
            {r.itemCount > 0 ? t('resa.dishesOrdered', { n: r.itemCount }) : ''}
            {r.depositAmount > 0 ? ` · 💳 ${euros(r.depositAmount)} ${ACOMPTE_LABEL[r.depositStatus] ? t(`resa.${ACOMPTE_LABEL[r.depositStatus]}`) : ''}` : ''}
            {r.note ? ' · 💬' : ''}{r.internalNote ? ' · 📝' : ''}
          </span>
        </div>
        <span className={`status-badge status-${r.status}`}>{statusLabel(r.status, 'dine_in', t)}</span>
      </button>

      {ouverte && (
        <div className="resa-detail">
          <div className="resa-detail-infos">
            <span className="pill">{t(`resa.${SOURCES[r.source] || 'srcClient'}`)}</span>
            {r.clientPhone && <a className="pill" href={`tel:${r.clientPhone}`}>📞 {r.clientPhone}</a>}
            {r.clientEmail && <a className="pill" href={`mailto:${r.clientEmail}`}>✉️ {r.clientEmail}</a>}
            {r.code && r.paid && <span className="pill">{t('resa.codeLabel', { code: r.code })}</span>}
            {r.arrival === 'arrive' && <span className="pill teal">{t('resa.guestArrived')}</span>}
            {r.arrival === 'no_show' && <span className="pill" style={{ background: 'rgba(217,45,60,0.12)', color: 'var(--red)' }}>{t('resa.noShowBadge')}</span>}
          </div>
          {r.note && <p className="small resa-note-client">💬 <b>{t('resa.guestRequest')}</b> {r.note}</p>}

          {/* Décisions : confirmer/refuser tant que c'est une demande ; arrivée/absence/annulation ensuite. */}
          {aVenir && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {r.status === 'nouveau' && (
                <>
                  <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('accept', () => ordre('accept'))}>{enCours === 'accept' ? '…' : t('resa.confirm')}</button>
                  <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('refuse', () => ordre('refuse'))}>{enCours === 'refuse' ? '…' : t('resa.refuse')}</button>
                </>
              )}
              {r.status !== 'nouveau' && !r.arrival && (
                <>
                  <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>{enCours === 'arrive' ? '…' : t('resa.guestArrivedBtn')}</button>
                  <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('no_show', () => ordre('arrival', { arrival: 'no_show' }))}>{enCours === 'no_show' ? '…' : '❌ Absent'}</button>
                </>
              )}
              <button type="button" className="btn-ghost" onClick={() => setDeplacement((d) => !d)}>{t('resa.moveEdit')}</button>
            </div>
          )}
          {finie && r.arrival && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn-ghost" disabled={!!enCours} onClick={() => action('attendu', () => ordre('arrival', { arrival: 'attendu' }))}>{t('resa.undoCheckin')}</button>
            </div>
          )}
          {r.status === 'livre' && !r.arrival && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>{t('resa.wasPresent')}</button>
              <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('no_show', () => ordre('arrival', { arrival: 'no_show' }))}>{t('resa.absent')}</button>
            </div>
          )}

          {deplacement && aVenir && (
            <div className="resa-deplacer">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 130px' }}>
                  <label>{t('resa.day')}</label>
                  <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <label>{t('resa.time')}</label>
                  <input type="time" step="900" value={heure} onChange={(e) => setHeure(e.target.value)} />
                </div>
                <div style={{ flex: '0 0 96px' }}>
                  <label>{t('resa.duration')}</label>
                  <select value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
                    {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m % 60 ? t('resa.durationHM', { h: Math.floor(m / 60), m: m % 60 }) : t('resa.durationH', { h: m / 60 })}</option>)}
                  </select>
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <label>{t('resa.ppl')}</label>
                  <input type="number" min="1" max="200" value={couverts} onChange={(e) => setCouverts(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label>{t('resa.table')}</label>
                  <select value={r.tableId || ''} disabled={!!enCours}
                    onChange={(e) => action('table', () => champ({ tableId: e.target.value || null, notifier: false }))}>
                    <option value="">{t('resa.automatic')}</option>
                    {tables.filter((tb) => tb.active).map((tb) => <option key={tb.id} value={tb.id}>{tb.name} ({t('resa.seatsShort', { n: tb.seats })}{tb.zone ? `, ${tb.zone}` : ''})</option>)}
                  </select>
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <button type="button" className="btn-teal" disabled={!!enCours}
                  onClick={() => action('deplacer', () => champ({ startAt: new Date(`${jour}T${heure}:00`).toISOString(), durationMinutes: duree, partySize: Number(couverts) }))}>
                  {enCours === 'deplacer' ? '…' : t('resa.saveGuestNotified')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDeplacement(false)}>{t('resa.close')}</button>
              </div>
            </div>
          )}

          {/* Note interne : pour la salle, jamais montrée au client (allergie signalée par téléphone,
              anniversaire, client difficile…). */}
          <div style={{ marginTop: 10 }}>
            <label htmlFor={`note-${r.id}`}>{t('resa.internalNoteLabel')}</label>
            <textarea id={`note-${r.id}`} rows={2} value={noteInterne} placeholder={t('resa.phInternalNote')}
              onChange={(e) => setNoteInterne(e.target.value)} />
            {noteInterne !== (r.internalNote || '') && (
              <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 12px' }} disabled={!!enCours}
                onClick={() => action('note', () => champ({ internalNote: noteInterne }))}>{enCours === 'note' ? '…' : t('resa.saveNote')}</button>
            )}
          </div>

          {/* Acompte encore détenu par Fairide sur une réservation close : à trancher. */}
          {r.depositAmount > 0 && r.depositStatus === 'paid' && (finie || r.status === 'annule') && (
            <div className="row" style={{ gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="small">{t('resa.depositToDecide', { amount: euros(r.depositAmount) })}</span>
              <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => action('keep', () => ordre('deposit', { action: 'keep' }))}>{t('resa.keepIt')}</button>
              <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => action('refund', () => ordre('deposit', { action: 'refund' }))}>{t('resa.refundIt')}</button>
            </div>
          )}

          {aVenir && r.status !== 'nouveau' && (
            <details className="resa-annuler" style={{ marginTop: 10 }}>
              <summary className="small">{t('resa.cancelThis')}</summary>
              <input value={message} placeholder={t('resa.phCancelMessage')} onChange={(e) => setMessage(e.target.value)} style={{ marginTop: 6 }} />
              {r.depositAmount > 0 && r.depositStatus === 'paid' && (
                <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 6 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={garderAcompte} onChange={(e) => setGarderAcompte(e.target.checked)} />
                  <span className="small">{t('resa.keepDepositElseRefund', { amount: euros(r.depositAmount) })}</span>
                </label>
              )}
              <button type="button" className="btn-outline" style={{ marginTop: 6, color: 'var(--red)' }} disabled={!!enCours}
                onClick={() => action('annuler', () => ordre('cancel-reservation', { message, keepDeposit: garderAcompte }))}>
                {enCours === 'annuler' ? '…' : t('resa.confirmCancel')}
              </button>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NouvelleReservation({ token, toast, restoId, tables, dateInitiale, onCree, restaurant }) {
  const { t } = useLanguage();
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [couverts, setCouverts] = useState(2);
  const [jour, setJour] = useState(dateInitiale);
  const [heure, setHeure] = useState('19:30');
  const [duree, setDuree] = useState(120);
  const [tableId, setTableId] = useState('');
  const [source, setSource] = useState('phone');
  const [noteInterne, setNoteInterne] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const pas = restaurant?.reservationSlotMinutes || 30;

  async function soumettre(e) {
    e.preventDefault();
    if (!nom.trim()) { toast(t('resa.toastNameRequired')); return; }
    setEnvoi(true);
    try {
      const r = await api(`/restaurants/${restoId}/reservations`, {
        method: 'POST', token,
        body: {
          reservationName: nom.trim(), clientPhone: telephone.trim(), clientEmail: email.trim(), partySize: Number(couverts),
          startAt: new Date(`${jour}T${heure}:00`).toISOString(), durationMinutes: duree, tableId: tableId || null,
          internalNote: noteInterne, source
        }
      });
      toast(t('resa.toastAdded'));
      onCree(r);
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }

  return (
    <form className="card" onSubmit={soumettre}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.newReservation')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        {t('resa.newIntro')}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="nr-nom">{t('resa.name')}</label>
          <input id="nr-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('resa.phName')} required />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="nr-tel">{t('resa.phone')}</label>
          <input id="nr-tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+32…" />
        </div>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="nr-email">{t('resa.emailOptional')}</label>
          <input id="nr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '0 0 90px' }}>
          <label htmlFor="nr-pers">{t('resa.ppl')}</label>
          <input id="nr-pers" type="number" min="1" max="200" value={couverts} onChange={(e) => setCouverts(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="nr-jour">{t('resa.day')}</label>
          <input id="nr-jour" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label htmlFor="nr-heure">{t('resa.time')}</label>
          <input id="nr-heure" type="time" step={pas * 60} value={heure} onChange={(e) => setHeure(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label htmlFor="nr-duree">{t('resa.duration')}</label>
          <select id="nr-duree" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
            {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m % 60 ? t('resa.durationHM', { h: Math.floor(m / 60), m: m % 60 }) : t('resa.durationH', { h: m / 60 })}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 150px' }}>
          <label htmlFor="nr-table">{t('resa.table')}</label>
          <select id="nr-table" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">{t('resa.automaticSmallest')}</option>
            {tables.map((tb) => <option key={tb.id} value={tb.id}>{tb.name} ({t('resa.seatsShort', { n: tb.seats })}{tb.zone ? `, ${tb.zone}` : ''})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label htmlFor="nr-source">{t('resa.receivedVia')}</label>
          <select id="nr-source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="phone">{t('resa.phone')}</option>
            <option value="walk_in">{t('resa.walkIn')}</option>
            <option value="restaurant">{t('resa.otherSource')}</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="nr-note">{t('resa.internalNoteShort')}</label>
        <input id="nr-note" value={noteInterne} onChange={(e) => setNoteInterne(e.target.value)} placeholder={t('resa.phInternalNoteShort')} />
      </div>
      <button className="btn-teal" disabled={envoi}>{envoi ? '…' : t('resa.addToAgenda')}</button>
    </form>
  );
}

// ------------------------------------------------------------------------------------------------
// RÉGLAGES — ce que le client peut réserver en ligne, et à quelles conditions.
// ------------------------------------------------------------------------------------------------
function Reglages({ token, toast, restaurant, restoId, loadDashboard, tables }) {
  const { t } = useLanguage();
  const [heuresPropres, setHeuresPropres] = useState(false);
  const [heures, setHeures] = useState({});
  const [pas, setPas] = useState(30);
  const [dureeMax, setDureeMax] = useState(180);
  const [horizon, setHorizon] = useState(30);
  const [jourMeme, setJourMeme] = useState(true);
  const [preavis, setPreavis] = useState(60);
  const [confirmationAuto, setConfirmationAuto] = useState(true);
  const [annulation, setAnnulation] = useState(24);
  const [maxGroupe, setMaxGroupe] = useState('');
  const [acompte, setAcompte] = useState(false);
  const [acompteMode, setAcompteMode] = useState('per_person');
  const [acompteMontant, setAcompteMontant] = useState(10);
  const [acompteSeuil, setAcompteSeuil] = useState(1);
  const [acompteNote, setAcompteNote] = useState('');
  const [accueil, setAccueil] = useState('');
  const [enregistre, setEnregistre] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setHeuresPropres(!!restaurant.reservationHours);
    setHeures(restaurant.reservationHours || restaurant.hours || {});
    setPas(restaurant.reservationSlotMinutes || 30);
    setDureeMax(restaurant.reservationMaxMinutes || 180);
    setHorizon(restaurant.reservationMaxDays || 30);
    setJourMeme(restaurant.reservationSameDay !== false);
    setPreavis(restaurant.reservationMinNoticeMinutes ?? 60);
    setConfirmationAuto(restaurant.reservationAutoConfirm !== false);
    setAnnulation(restaurant.reservationCancelHours ?? 24);
    setMaxGroupe(restaurant.reservationMaxParty || '');
    setAcompte(!!restaurant.reservationDepositEnabled);
    setAcompteMode(restaurant.reservationDepositMode || 'per_person');
    setAcompteMontant(restaurant.reservationDepositAmount || 10);
    setAcompteSeuil(restaurant.reservationDepositMinParty || 1);
    setAcompteNote(restaurant.reservationDepositNote || '');
    setAccueil(restaurant.reservationWelcomeMessage || '');
  }, [restaurant]);

  function majPlage(jour, index, champ, valeur) {
    setHeures((h) => {
      const jourPlages = [...(h[jour] || [])];
      jourPlages[index] = { ...jourPlages[index], [champ]: valeur };
      return { ...h, [jour]: jourPlages };
    });
  }
  const ajouterPlage = (jour) => setHeures((h) => ({ ...h, [jour]: [...(h[jour] || []), { open: '19:00', close: '22:00' }] }));
  const retirerPlage = (jour, index) => setHeures((h) => ({ ...h, [jour]: (h[jour] || []).filter((_, i) => i !== index) }));

  async function enregistrer() {
    setEnregistre(true);
    try {
      await api(`/restaurants/${restoId}/reservation-settings`, {
        method: 'PATCH', token,
        body: {
          reservationHours: heuresPropres ? heures : null,
          slotMinutes: Number(pas), maxMinutes: Number(dureeMax), maxDays: Number(horizon),
          sameDay: jourMeme, minNoticeMinutes: Number(preavis), autoConfirm: confirmationAuto, cancelHours: Number(annulation),
          maxParty: maxGroupe === '' ? null : Number(maxGroupe),
          depositEnabled: acompte, depositMode: acompteMode, depositAmount: Number(acompteMontant), depositMinParty: Number(acompteSeuil),
          depositNote: acompteNote, welcomeMessage: accueil
        }
      });
      loadDashboard?.(restoId);
      toast(t('resa.toastSettingsSaved'));
    } catch (err) { toast(err.message); } finally { setEnregistre(false); }
  }

  const lien = `${window.location.origin}/restaurants/${restoId}`;
  async function copierLien() {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { toast(lien); }
  }
  const tablesAvecAcompte = (tables || []).filter((tb) => tb.active && tb.depositAmount !== null);
  if (!restaurant) return <p className="small">{t('resa.loading')}</p>;

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.whenTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          {t('resa.whenIntro')}
        </p>
        <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={heuresPropres} onChange={(e) => setHeuresPropres(e.target.checked)} />
          <span className="small">{t('resa.ownHours')}</span>
        </label>
        {heuresPropres && (
          <div style={{ marginBottom: 12 }}>
            {JOURS.map((j) => (
              <div key={j.cle} className="opening-hours-day-row" style={{ marginBottom: 8 }}>
                <div className="opening-hours-day-header">
                  <span className="opening-hours-day-label">{t(`resa.${j.label}`)}</span>
                  <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => ajouterPlage(j.cle)}>{t('resa.addService')}</button>
                </div>
                {(heures[j.cle] || []).length === 0 && <p className="small" style={{ margin: '4px 0 0' }}>{t('resa.noneThatDay')}</p>}
                {(heures[j.cle] || []).map((p, i) => (
                  <div key={i} className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <input type="time" value={p.open} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'open', e.target.value)} />
                    <span className="small">→</span>
                    <input type="time" value={p.close} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'close', e.target.value)} />
                    <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => retirerPlage(j.cle, i)}>🗑️</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-pas">{t('resa.slotsEvery')}</label>
            <select id="resa-pas" value={pas} onChange={(e) => setPas(e.target.value)}>
              <option value="15">{t('resa.min15')}</option><option value="30">{t('resa.min30')}</option><option value="60">{t('resa.h1')}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-duree">{t('resa.maxDuration')}</label>
            <select id="resa-duree" value={dureeMax} onChange={(e) => setDureeMax(e.target.value)}>
              <option value="60">{t('resa.h1')}</option><option value="90">{t('resa.h1_30')}</option><option value="120">{t('resa.h2')}</option>
              <option value="180">{t('resa.h3')}</option><option value="240">{t('resa.h4')}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-horizon">{t('resa.bookableUpTo')}</label>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <input id="resa-horizon" type="number" min={1} max={365} step={1} value={horizon} style={{ width: 90 }}
                onChange={(e) => setHorizon(e.target.value)} onBlur={() => setHorizon((h) => String(Math.min(365, Math.max(1, Number(h) || 1))))} />
              <span className="small">{t('resa.daysAhead')}</span>
            </div>
            <div className="pill-row" style={{ marginTop: 6 }}>
              {[1, 3, 7, 14, 30, 60, 90, 180, 365].map((j) => (
                <button key={j} type="button" className={`pill${Number(horizon) === j ? ' gold' : ''}`} style={{ cursor: 'pointer', border: '1px solid var(--line)' }} onClick={() => setHorizon(String(j))}>{j}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="small" style={{ margin: '10px 0 0' }}>{t('resa.horizonHelp')}</p>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.delaysTitle')}</h3>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={jourMeme} onChange={(e) => setJourMeme(e.target.checked)} />
          <span><b>{t('resa.sameDay')}</b><br /><span className="small">{t('resa.sameDayHelp')}</span></span>
        </label>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-preavis">{t('resa.minNotice')}</label>
            <select id="resa-preavis" value={preavis} onChange={(e) => setPreavis(e.target.value)}>
              <option value="0">{t('resa.none')}</option><option value="30">{t('resa.min30')}</option><option value="60">{t('resa.h1')}</option>
              <option value="120">{t('resa.h2')}</option><option value="180">{t('resa.h3')}</option><option value="360">{t('resa.h6')}</option>
              <option value="720">{t('resa.h12')}</option><option value="1440">{t('resa.h24')}</option><option value="2880">{t('resa.h48')}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-annul">{t('resa.freeCancelUntil')}</label>
            <select id="resa-annul" value={annulation} onChange={(e) => setAnnulation(e.target.value)}>
              <option value="0">{t('resa.untilReservationTime')}</option><option value="2">{t('resa.before2h')}</option><option value="6">{t('resa.before6h')}</option>
              <option value="12">{t('resa.before12h')}</option><option value="24">{t('resa.before24h')}</option><option value="48">{t('resa.before48h')}</option><option value="72">{t('resa.before72h')}</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-max">{t('resa.maxPartyOnline')}</label>
            <input id="resa-max" type="number" min="1" max="200" value={maxGroupe} placeholder={t('resa.phMaxParty')} onChange={(e) => setMaxGroupe(e.target.value)} />
          </div>
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('resa.delaysHelp')}</p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer', marginTop: 12 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={confirmationAuto} onChange={(e) => setConfirmationAuto(e.target.checked)} />
          <span><b>{t('resa.autoConfirm')}</b><br /><span className="small">{t('resa.autoConfirmHelp')}</span></span>
        </label>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.depositTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>
          {t('resa.depositIntro1')} <b>{t('resa.depositIntro2')}</b> {t('resa.depositIntro3')}
        </p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={acompte} onChange={(e) => setAcompte(e.target.checked)} />
          <span><b>{t('resa.askDeposit')}</b></span>
        </label>
        {acompte && (
          <>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="ac-montant">{t('resa.amount')}</label>
                <input id="ac-montant" type="number" min="0" max="500" step="0.5" value={acompteMontant} onChange={(e) => setAcompteMontant(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label htmlFor="ac-mode">{t('resa.computed')}</label>
                <select id="ac-mode" value={acompteMode} onChange={(e) => setAcompteMode(e.target.value)}>
                  <option value="per_person">{t('resa.perPerson')}</option>
                  <option value="per_booking">{t('resa.perBooking')}</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label htmlFor="ac-seuil">{t('resa.from')}</label>
                <select id="ac-seuil" value={acompteSeuil} onChange={(e) => setAcompteSeuil(e.target.value)}>
                  {[1, 2, 4, 6, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n === 1 ? t('resa.anyReservation') : t('resa.nPeople', { n })}</option>)}
                </select>
              </div>
            </div>
            <p className="small" style={{ margin: '8px 0 0' }}>
              {t('resa.exampleTable4')} <b>{euros(acompteMode === 'per_person' ? Number(acompteMontant) * 4 : Number(acompteMontant))}</b>
              {Number(acompteSeuil) > 4 ? t('resa.belowThreshold') : '.'}
              {' '}{t('resa.differentAmount1')} <b>{t('resa.differentAmount2')}</b> {t('resa.differentAmount3')} <b>{t('resa.floorPlan')}</b>{t('resa.tableByTable')}
              {tablesAvecAcompte.length > 0 && <> {t('resa.currently')} {tablesAvecAcompte.map((tb) => `${tb.name} ${tb.depositAmount === 0 ? t('resa.noDeposit') : euros(tb.depositAmount)}`).join(', ')}.</>}
            </p>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="ac-note">{t('resa.depositNoteLabel')}</label>
              <input id="ac-note" value={acompteNote} maxLength={300} placeholder={t('resa.phDepositNote')} onChange={(e) => setAcompteNote(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.welcomeTitle')}</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.welcomeHelp')}</p>
        <textarea rows={2} maxLength={500} value={accueil} onChange={(e) => setAccueil(e.target.value)} placeholder={t('resa.phWelcome')} />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.linkTitle')}</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>
          {t('resa.linkHelp')}
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input readOnly value={lien} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="btn-outline" onClick={copierLien}>{copie ? t('resa.copied') : t('resa.copy')}</button>
        </div>
      </div>

      <div className="resa-enregistrer">
        <button className="btn-teal" disabled={enregistre} onClick={enregistrer}>{enregistre ? '…' : t('resa.saveSettings')}</button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// PLAN DE SALLE — les tables, leur zone (type) et leur acompte propre.
// ------------------------------------------------------------------------------------------------
function PlanDeSalle({ token, toast, restaurant, restoId, tables, setTables }) {
  const { t } = useLanguage();
  const [nom, setNom] = useState('');
  const [places, setPlaces] = useState(2);
  const [zone, setZone] = useState('');
  const [ajout, setAjout] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const acompteActif = !!restaurant?.reservationDepositEnabled;
  const zones = useMemo(() => [...new Set((tables || []).map((tb) => tb.zone).filter(Boolean))], [tables]);

  async function ajouterTable(e) {
    e.preventDefault();
    if (!nom.trim()) { toast(t('resa.toastTableName')); return; }
    setAjout(true);
    try {
      const t = await api(`/restaurants/${restoId}/tables`, { method: 'POST', token, body: { name: nom.trim(), seats: Number(places), zone: zone.trim() } });
      setTables((l) => [...(l || []), t]);
      setNom(''); setPlaces(2);
      toast(t('resa.toastTableAdded'));
    } catch (err) { toast(err.message); } finally { setAjout(false); }
  }
  async function modifier(id, champs) {
    setEnCours(id);
    try {
      const t = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'PATCH', token, body: champs });
      setTables((l) => l.map((x) => (x.id === id ? t : x)));
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }
  async function supprimer(id) {
    setEnCours(id);
    try {
      const r = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'DELETE', token });
      if (r.desactivee) {
        setTables((l) => l.map((x) => (x.id === id ? r.table : x)));
        toast(t('resa.toastTableDisabled'));
      } else {
        setTables((l) => l.filter((x) => x.id !== id));
        toast(t('resa.toastTableDeleted'));
      }
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }
  const local = (id, champs) => setTables((l) => l.map((x) => (x.id === id ? { ...x, ...champs } : x)));

  const actives = (tables || []).filter((tb) => tb.active);
  const totalPlaces = actives.reduce((a, tb) => a + Number(tb.seats || 0), 0);
  const plusGrande = actives.reduce((m, tb) => Math.max(m, Number(tb.seats || 0)), 0);

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.yourTables')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>
        {t('resa.zoneIntro1')} <b>zone</b>
        {' '}{t('resa.zoneIntro2')}
      </p>
      {tables === null && <p className="small">{t('resa.loading')}</p>}
      {tables !== null && tables.length === 0 && (
        <p className="small" style={{ margin: '0 0 12px', padding: '9px 11px', background: 'var(--cream-dim)', borderRadius: 9 }}>
          {t('resa.noTablesWarn1')} <b>{t('resa.noTablesWarn2')}</b>.
        </p>
      )}
      {tables !== null && tables.length > 0 && (
        <>
          <div className="service-table-wrap">
            <table className="service-table plan-table">
              <thead>
                <tr><th>{t('resa.table')}</th><th>{t('resa.zone')}</th><th className="col-actif">{t('resa.seats')}</th>{acompteActif && <th className="col-actif">{t('resa.deposit')}</th>}<th className="col-actif">{t('resa.open')}</th><th className="col-actif"> </th></tr>
              </thead>
              <tbody>
                {tables.map((tb) => (
                  <tr key={tb.id} className={tb.active ? '' : 'service-off'}>
                    <td>
                      <input value={tb.name} disabled={enCours === tb.id} style={{ padding: '5px 8px', fontSize: 13 }}
                        onChange={(e) => local(tb.id, { name: e.target.value })}
                        onBlur={(e) => e.target.value.trim() !== '' && modifier(tb.id, { name: e.target.value.trim() })} />
                    </td>
                    <td>
                      <input value={tb.zone || ''} list="resa-zones" placeholder={t('resa.phZone')} disabled={enCours === tb.id} style={{ maxWidth: 120, padding: '5px 8px', fontSize: 13 }}
                        onChange={(e) => local(tb.id, { zone: e.target.value })}
                        onBlur={(e) => modifier(tb.id, { zone: e.target.value.trim() })} />
                    </td>
                    <td className="col-actif">
                      <input type="number" min="1" max="30" value={tb.seats} disabled={enCours === tb.id} style={{ width: 62, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                        onChange={(e) => local(tb.id, { seats: e.target.value })}
                        onBlur={(e) => Number(e.target.value) >= 1 && modifier(tb.id, { seats: Number(e.target.value) })} />
                    </td>
                    {acompteActif && (
                      <td className="col-actif">
                        <input type="number" min="0" max="500" step="0.5" value={tb.depositAmount ?? ''} placeholder={t('resa.phRule')} disabled={enCours === tb.id}
                          title={t('resa.titleDepositCell')}
                          style={{ width: 72, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                          onChange={(e) => local(tb.id, { depositAmount: e.target.value === '' ? null : e.target.value })}
                          onBlur={(e) => modifier(tb.id, { depositAmount: e.target.value === '' ? null : Number(e.target.value) })} />
                      </td>
                    )}
                    <td className="col-actif">
                      <label className="service-toggle">
                        <input type="checkbox" checked={tb.active} disabled={enCours === tb.id} onChange={(e) => modifier(tb.id, { active: e.target.checked })} />
                        <span className="sr-only">{t('resa.tableOpenSr', { name: tb.name })}</span>
                      </label>
                    </td>
                    <td className="col-actif">
                      <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} disabled={enCours === tb.id} onClick={() => supprimer(tb.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="resa-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
          <p className="small" style={{ margin: '10px 0 0' }}>
            {t('resa.tablesSummary', { n: actives.length, seats: totalPlaces, max: plusGrande || 0 })}
            {zones.length > 0 && t('resa.zonesList', { zones: zones.join(', ') })}
          </p>
        </>
      )}
      <form onSubmit={ajouterTable} className="row" style={{ gap: 8, marginTop: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <label htmlFor="table-nom">{t('resa.tableName')}</label>
          <input id="table-nom" value={nom} placeholder={t('resa.phTableName')} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label htmlFor="table-zone">{t('resa.zone')}</label>
          <input id="table-zone" value={zone} list="resa-zones" placeholder={t('resa.phZone')} onChange={(e) => setZone(e.target.value)} />
        </div>
        <div style={{ flex: '0 0 96px' }}>
          <label htmlFor="table-places">{t('resa.seats')}</label>
          <input id="table-places" type="number" min="1" max="30" value={places} onChange={(e) => setPlaces(e.target.value)} />
        </div>
        <button className="btn-teal" disabled={ajout}>{ajout ? '…' : t('resa.add')}</button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// STATISTIQUES — volume, couverts, absents, acomptes, et la forme de la semaine.
// ------------------------------------------------------------------------------------------------
function Statistiques({ token, toast, restoId }) {
  const { t } = useLanguage();
  const [periode, setPeriode] = useState('30');
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!restoId) return;
    const aujourdhui = isoDuJour(new Date());
    let from; let to = aujourdhui;
    if (periode === 'mois') { from = `${aujourdhui.slice(0, 7)}-01`; }
    else if (periode === 'avenir') { from = aujourdhui; to = decalerJour(aujourdhui, 30); }
    else from = decalerJour(aujourdhui, -Number(periode));
    setChargement(true);
    api(`/restaurants/${restoId}/reservations/stats?from=${from}&to=${to}`, { token })
      .then(setStats).catch((e) => toast(e.message)).finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, periode]);

  const maxJour = stats ? Math.max(1, ...stats.parJourSemaine.map((j) => j.couverts)) : 1;
  const heuresUtiles = stats ? stats.parHeure.map((h, i) => ({ ...h, heure: i })).filter((h, i, arr) => {
    const premier = arr.findIndex((x) => x.reservations > 0);
    let dernier = -1; arr.forEach((x, k) => { if (x.reservations > 0) dernier = k; });
    return premier >= 0 && i >= premier && i <= dernier;
  }) : [];
  const maxHeure = Math.max(1, ...heuresUtiles.map((h) => h.couverts));
  const ordreJours = [1, 2, 3, 4, 5, 6, 0];

  return (
    <>
      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ flex: 1 }}>{t('resa.period')}</b>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="7">{t('resa.last7')}</option>
            <option value="30">{t('resa.last30')}</option>
            <option value="90">{t('resa.last90')}</option>
            <option value="mois">{t('resa.thisMonth')}</option>
            <option value="avenir">{t('resa.next30')}</option>
          </select>
        </div>
      </div>
      {chargement && <p className="small">{t('resa.loading')}</p>}
      {!chargement && stats && (
        <>
          <div className="resa-stats">
            <Stat valeur={stats.total} label={t('resa.statReservations')} />
            <Stat valeur={stats.couverts} label={t('resa.statCovers')} />
            <Stat valeur={stats.couvertsMoyens ?? '–'} label={t('resa.statCoversPerTable')} />
            <Stat valeur={stats.enAttente} label={t('resa.statToConfirm')} accent={stats.enAttente > 0 ? 'warn' : undefined} />
            <Stat valeur={stats.absents} label={`${t('resa.statAbsent')}${stats.tauxAbsence !== null ? ` · ${stats.tauxAbsence} %` : ''}`} accent={stats.absents > 0 ? 'danger' : undefined} />
            <Stat valeur={stats.annulees + stats.refusees} label={t('resa.statCancelled')} />
            <Stat valeur={euros(stats.acompteEncaisse)} label={t('resa.statDepositsCollected')} />
            <Stat valeur={euros(stats.acompteConserve)} label={t('resa.statDepositsKept')} />
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
