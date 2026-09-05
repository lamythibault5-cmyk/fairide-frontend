import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { statusLabel } from '../../orderStatus';

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
  { cle: 'mon', label: 'Lundi' }, { cle: 'tue', label: 'Mardi' }, { cle: 'wed', label: 'Mercredi' },
  { cle: 'thu', label: 'Jeudi' }, { cle: 'fri', label: 'Vendredi' }, { cle: 'sat', label: 'Samedi' },
  { cle: 'sun', label: 'Dimanche' }
];
const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const SOURCES = { client: 'En ligne', restaurant: 'Saisie', phone: 'Téléphone', walk_in: 'Passage' };
const ACOMPTE_LABEL = { pending: 'à payer', paid: 'encaissé', refunded: 'remboursé', kept: 'conservé' };
const ONGLETS = [
  { cle: 'agenda', label: '📅 Agenda' },
  { cle: 'reglages', label: '⚙️ Réglages' },
  { cle: 'salle', label: '🪑 Plan de salle' },
  { cle: 'stats', label: '📊 Statistiques' }
];

function isoDuJour(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}
function heureLocale(ms) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
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
function libelleJour(iso, court = false) {
  const [a, mo, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-BE', court ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' })
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
      <h2 className="section-title" style={{ marginTop: 0 }}>📅 Réservations</h2>

      <div className="resa-onglets" role="tablist" aria-label="Sections des réservations">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`resa-onglet${onglet === o.cle ? ' actif' : ''}`}
            onClick={() => setSearchParams(o.cle === 'agenda' ? {} : { onglet: o.cle })}>
            {o.label}
          </button>
        ))}
      </div>

      {!restaurant?.offersDineIn && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          <p className="small" style={{ margin: 0 }}>
            La réservation de table est désactivée pour ton commerce : aucun nouveau client ne peut
            réserver en ligne (tu peux toujours saisir tes réservations ici). Réactive-la dans
            <b> Mon compte → Services proposés</b>.
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
  const tablesActives = (tables || []).filter((t) => t.active);
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
            onClick={() => setDate((d) => decalerJour(d, -navPas))} aria-label={vue === 'jour' ? 'Jour précédent' : 'Semaine précédente'}>←</button>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', textTransform: 'capitalize' }}>
              {vue === 'jour' ? libelleJour(date) : `Semaine du ${libelleJour(lundi, true)}`}
            </b>
            {!estAujourdhui && (
              <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }}
                onClick={() => setDate(isoDuJour(new Date()))}>revenir à aujourd'hui</button>
            )}
          </div>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, navPas))} aria-label={vue === 'jour' ? 'Jour suivant' : 'Semaine suivante'}>→</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ flex: '1 1 150px', maxWidth: 200 }} />
          <div className="resa-bascule" role="group" aria-label="Vue">
            <button type="button" className={vue === 'jour' ? 'actif' : ''} onClick={() => setVue('jour')}>Jour</button>
            <button type="button" className={vue === 'semaine' ? 'actif' : ''} onClick={() => setVue('semaine')}>Semaine</button>
          </div>
          <button type="button" className="btn-teal" style={{ marginLeft: 'auto' }} onClick={() => setFormulaire((f) => !f)}>
            {formulaire ? 'Fermer' : '＋ Ajouter une réservation'}
          </button>
        </div>
      </div>

      {formulaire && (
        <NouvelleReservation token={token} toast={toast} restoId={restoId} tables={tablesActives} restaurant={restaurant}
          dateInitiale={date}
          onCree={(r) => { setFormulaire(false); setDate(isoDuJour(new Date(r.startAt))); setVue('jour'); setOuverte(r.id); recharger(); }} />
      )}

      {chargement && <p className="small">Chargement…</p>}

      {!chargement && vue === 'semaine' && semaine && (
        <VueSemaine lundi={lundi} reservations={semaine.reservations} onJour={(iso) => { setDate(iso); setVue('jour'); }} />
      )}

      {!chargement && vue === 'jour' && donnees && (
        <>
          {tablesActives.length === 0 && (
            <div className="card">
              <p className="small" style={{ margin: 0 }}>
                Aucune table déclarée : la grille ne peut rien afficher et les réservations en ligne sont
                acceptées <b>sans limite</b>. Ajoute tes tables dans l'onglet <b>Plan de salle</b>.
              </p>
            </div>
          )}

          {tablesActives.length > 0 && (
            <div className="card">
              <p className="small" style={{ margin: '0 0 10px' }}>
                <b>{actives.length}</b> réservation{actives.length > 1 ? 's' : ''} ·
                {' '}<b>{couverts}</b> couvert{couverts > 1 ? 's' : ''} ·
                {' '}{tablesActives.length} table{tablesActives.length > 1 ? 's' : ''}
                {enAttente > 0 && <> · <span className="status-badge status-nouveau">{enAttente} à confirmer</span></>}
              </p>
              <div className="resa-grid-wrap">
                <div className="resa-grid" style={{ '--resa-heures': heures.length }}>
                  <div className="resa-grid-coin" />
                  {heures.map((h) => <div key={h} className="resa-grid-heure">{String(h).padStart(2, '0')}h</div>)}
                  {tablesActives.map((t) => (
                    <Fragment key={t.id}>
                      <div className="resa-grid-table">
                        <b title={t.name}>{t.name}</b>
                        <span className="small">{t.seats} pl.{t.zone ? ` · ${t.zone}` : ''}</span>
                      </div>
                      <div className="resa-grid-piste">
                        {actives.filter((r) => r.tableId === t.id).map((r) => {
                          const d = minutesDansLeJour(r, date);
                          const g = Math.max(d, plage.debut);
                          const f = Math.min(d + r.durationMinutes, plage.fin);
                          if (f <= g) return null;
                          return (
                            <button type="button" key={r.id}
                              className={`resa-bloc resa-bloc-${r.status}${r.arrival === 'arrive' ? ' resa-bloc-arrive' : ''}${r.arrival === 'no_show' ? ' resa-bloc-absent' : ''}${ouverte === r.id ? ' resa-bloc-choisi' : ''}`}
                              style={{ left: `${((g - plage.debut) / largeurMinutes) * 100}%`, width: `${((f - g) / largeurMinutes) * 100}%` }}
                              title={`${r.reservationName} · ${r.partySize} pers. · ${heureLocale(r.startAt)}`}
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
                  ⚠️ {actives.filter((r) => !r.tableId).length} réservation(s) sans table attribuée — ouvre-les
                  ci-dessous pour leur choisir une table.
                </p>
              )}
            </div>
          )}

          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Dans l'ordre d'arrivée</h3>
            {duJour.length === 0 && <p className="small" style={{ margin: 0 }}>Aucune réservation ce jour-là.</p>}
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
              <b style={{ textTransform: 'capitalize' }}>{libelleJour(iso, true)}</b>
              <span className="small">{duJour.length ? `${duJour.length} résa · ${couverts} couv.` : 'Rien'}</span>
              {attente > 0 && <span className="status-badge status-nouveau">{attente} à confirmer</span>}
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
  const table = tables.find((t) => t.id === r.tableId);
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
            {r.partySize} personne{r.partySize > 1 ? 's' : ''}
            {table ? ` · ${table.name}` : ' · sans table attribuée'}
            {r.itemCount > 0 ? ` · ${r.itemCount} plat${r.itemCount > 1 ? 's' : ''} commandé${r.itemCount > 1 ? 's' : ''}` : ''}
            {r.depositAmount > 0 ? ` · 💳 ${euros(r.depositAmount)} ${ACOMPTE_LABEL[r.depositStatus] || ''}` : ''}
            {r.note ? ' · 💬' : ''}{r.internalNote ? ' · 📝' : ''}
          </span>
        </div>
        <span className={`status-badge status-${r.status}`}>{statusLabel(r.status, 'dine_in')}</span>
      </button>

      {ouverte && (
        <div className="resa-detail">
          <div className="resa-detail-infos">
            <span className="pill">{SOURCES[r.source] || 'En ligne'}</span>
            {r.clientPhone && <a className="pill" href={`tel:${r.clientPhone}`}>📞 {r.clientPhone}</a>}
            {r.clientEmail && <a className="pill" href={`mailto:${r.clientEmail}`}>✉️ {r.clientEmail}</a>}
            {r.code && r.paid && <span className="pill">Code {r.code}</span>}
            {r.arrival === 'arrive' && <span className="pill teal">Client arrivé</span>}
            {r.arrival === 'no_show' && <span className="pill" style={{ background: 'rgba(217,45,60,0.12)', color: 'var(--red)' }}>Absent (no-show)</span>}
          </div>
          {r.note && <p className="small resa-note-client">💬 <b>Demande du client :</b> {r.note}</p>}

          {/* Décisions : confirmer/refuser tant que c'est une demande ; arrivée/absence/annulation ensuite. */}
          {aVenir && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {r.status === 'nouveau' && (
                <>
                  <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('accept', () => ordre('accept'))}>{enCours === 'accept' ? '…' : '✅ Confirmer'}</button>
                  <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('refuse', () => ordre('refuse'))}>{enCours === 'refuse' ? '…' : 'Refuser'}</button>
                </>
              )}
              {r.status !== 'nouveau' && !r.arrival && (
                <>
                  <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>{enCours === 'arrive' ? '…' : '✅ Client arrivé'}</button>
                  <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('no_show', () => ordre('arrival', { arrival: 'no_show' }))}>{enCours === 'no_show' ? '…' : '❌ Absent'}</button>
                </>
              )}
              <button type="button" className="btn-ghost" onClick={() => setDeplacement((d) => !d)}>🕐 Déplacer / modifier</button>
            </div>
          )}
          {finie && r.arrival && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn-ghost" disabled={!!enCours} onClick={() => action('attendu', () => ordre('arrival', { arrival: 'attendu' }))}>Annuler ce pointage</button>
            </div>
          )}
          {r.status === 'livre' && !r.arrival && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>✅ Était présent</button>
              <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('no_show', () => ordre('arrival', { arrival: 'no_show' }))}>❌ Absent</button>
            </div>
          )}

          {deplacement && aVenir && (
            <div className="resa-deplacer">
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 130px' }}>
                  <label>Jour</label>
                  <input type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <label>Heure</label>
                  <input type="time" step="900" value={heure} onChange={(e) => setHeure(e.target.value)} />
                </div>
                <div style={{ flex: '0 0 96px' }}>
                  <label>Durée</label>
                  <select value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
                    {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`}</option>)}
                  </select>
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <label>Pers.</label>
                  <input type="number" min="1" max="200" value={couverts} onChange={(e) => setCouverts(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label>Table</label>
                  <select value={r.tableId || ''} disabled={!!enCours}
                    onChange={(e) => action('table', () => champ({ tableId: e.target.value || null, notifier: false }))}>
                    <option value="">Automatique</option>
                    {tables.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.seats} pl.{t.zone ? `, ${t.zone}` : ''})</option>)}
                  </select>
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 8 }}>
                <button type="button" className="btn-teal" disabled={!!enCours}
                  onClick={() => action('deplacer', () => champ({ startAt: new Date(`${jour}T${heure}:00`).toISOString(), durationMinutes: duree, partySize: Number(couverts) }))}>
                  {enCours === 'deplacer' ? '…' : 'Enregistrer (le client est prévenu)'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDeplacement(false)}>Fermer</button>
              </div>
            </div>
          )}

          {/* Note interne : pour la salle, jamais montrée au client (allergie signalée par téléphone,
              anniversaire, client difficile…). */}
          <div style={{ marginTop: 10 }}>
            <label htmlFor={`note-${r.id}`}>📝 Note interne (invisible pour le client)</label>
            <textarea id={`note-${r.id}`} rows={2} value={noteInterne} placeholder="Ex. : anniversaire, chaise bébé, allergie arachides…"
              onChange={(e) => setNoteInterne(e.target.value)} />
            {noteInterne !== (r.internalNote || '') && (
              <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 12px' }} disabled={!!enCours}
                onClick={() => action('note', () => champ({ internalNote: noteInterne }))}>{enCours === 'note' ? '…' : 'Enregistrer la note'}</button>
            )}
          </div>

          {/* Acompte encore détenu par Fairide sur une réservation close : à trancher. */}
          {r.depositAmount > 0 && r.depositStatus === 'paid' && (finie || r.status === 'annule') && (
            <div className="row" style={{ gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="small">💳 Acompte de {euros(r.depositAmount)} encaissé, encore à décider :</span>
              <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => action('keep', () => ordre('deposit', { action: 'keep' }))}>Le conserver</button>
              <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => action('refund', () => ordre('deposit', { action: 'refund' }))}>Le rembourser</button>
            </div>
          )}

          {aVenir && r.status !== 'nouveau' && (
            <details className="resa-annuler" style={{ marginTop: 10 }}>
              <summary className="small">Annuler cette réservation</summary>
              <input value={message} placeholder="Message pour le client (optionnel)" onChange={(e) => setMessage(e.target.value)} style={{ marginTop: 6 }} />
              {r.depositAmount > 0 && r.depositStatus === 'paid' && (
                <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 6 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={garderAcompte} onChange={(e) => setGarderAcompte(e.target.checked)} />
                  <span className="small">Conserver l'acompte ({euros(r.depositAmount)}) — sinon il est remboursé</span>
                </label>
              )}
              <button type="button" className="btn-outline" style={{ marginTop: 6, color: 'var(--red)' }} disabled={!!enCours}
                onClick={() => action('annuler', () => ordre('cancel-reservation', { message, keepDeposit: garderAcompte }))}>
                {enCours === 'annuler' ? '…' : 'Confirmer l\'annulation'}
              </button>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NouvelleReservation({ token, toast, restoId, tables, dateInitiale, onCree, restaurant }) {
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
    if (!nom.trim()) { toast('Indique le nom de la réservation.'); return; }
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
      toast('Réservation ajoutée à l\'agenda.');
      onCree(r);
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }

  return (
    <form className="card" onSubmit={soumettre}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Nouvelle réservation</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>
        Pour une demande reçue par téléphone, par e-mail ou au comptoir. Confirmée d'office ; si tu
        indiques un e-mail, le client reçoit la même confirmation qu'en ligne.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="nr-nom">Nom</label>
          <input id="nr-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Dupont" required />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="nr-tel">Téléphone</label>
          <input id="nr-tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+32…" />
        </div>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="nr-email">E-mail (optionnel)</label>
          <input id="nr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '0 0 90px' }}>
          <label htmlFor="nr-pers">Pers.</label>
          <input id="nr-pers" type="number" min="1" max="200" value={couverts} onChange={(e) => setCouverts(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 140px' }}>
          <label htmlFor="nr-jour">Jour</label>
          <input id="nr-jour" type="date" value={jour} onChange={(e) => setJour(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label htmlFor="nr-heure">Heure</label>
          <input id="nr-heure" type="time" step={pas * 60} value={heure} onChange={(e) => setHeure(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '0 0 110px' }}>
          <label htmlFor="nr-duree">Durée</label>
          <select id="nr-duree" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
            {[60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{`${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 150px' }}>
          <label htmlFor="nr-table">Table</label>
          <select id="nr-table" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Automatique (la plus petite libre)</option>
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.seats} pl.{t.zone ? `, ${t.zone}` : ''})</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 130px' }}>
          <label htmlFor="nr-source">Reçue par</label>
          <select id="nr-source" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="phone">Téléphone</option>
            <option value="walk_in">Passage au comptoir</option>
            <option value="restaurant">Autre (e-mail, réseaux…)</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="nr-note">📝 Note interne</label>
        <input id="nr-note" value={noteInterne} onChange={(e) => setNoteInterne(e.target.value)} placeholder="Anniversaire, chaise bébé, allergie…" />
      </div>
      <button className="btn-teal" disabled={envoi}>{envoi ? '…' : 'Ajouter à l\'agenda'}</button>
    </form>
  );
}

// ------------------------------------------------------------------------------------------------
// RÉGLAGES — ce que le client peut réserver en ligne, et à quelles conditions.
// ------------------------------------------------------------------------------------------------
function Reglages({ token, toast, restaurant, restoId, loadDashboard, tables }) {
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
      toast('Réglages de réservation enregistrés.');
    } catch (err) { toast(err.message); } finally { setEnregistre(false); }
  }

  const lien = `${window.location.origin}/restaurants/${restoId}`;
  async function copierLien() {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2000); } catch { toast(lien); }
  }
  const tablesAvecAcompte = (tables || []).filter((t) => t.active && t.depositAmount !== null);
  if (!restaurant) return <p className="small">Chargement…</p>;

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Quand acceptes-tu des réservations ?</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Par défaut, tes horaires d'ouverture. Beaucoup de salles ne prennent des tables qu'aux
          services du midi et du soir alors que la cuisine tourne en continu pour l'emporter — dans
          ce cas, définis tes propres services.
        </p>
        <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={heuresPropres} onChange={(e) => setHeuresPropres(e.target.checked)} />
          <span className="small">Des horaires de réservation différents de mes horaires d'ouverture</span>
        </label>
        {heuresPropres && (
          <div style={{ marginBottom: 12 }}>
            {JOURS.map((j) => (
              <div key={j.cle} className="opening-hours-day-row" style={{ marginBottom: 8 }}>
                <div className="opening-hours-day-header">
                  <span className="opening-hours-day-label">{j.label}</span>
                  <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => ajouterPlage(j.cle)}>+ service</button>
                </div>
                {(heures[j.cle] || []).length === 0 && <p className="small" style={{ margin: '4px 0 0' }}>Aucune réservation ce jour-là.</p>}
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
            <label htmlFor="resa-pas">Créneaux toutes les</label>
            <select id="resa-pas" value={pas} onChange={(e) => setPas(e.target.value)}>
              <option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 heure</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-duree">Durée maximale</label>
            <select id="resa-duree" value={dureeMax} onChange={(e) => setDureeMax(e.target.value)}>
              <option value="60">1 heure</option><option value="90">1 h 30</option><option value="120">2 heures</option>
              <option value="180">3 heures</option><option value="240">4 heures</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-horizon">Réservable jusqu'à</label>
            <select id="resa-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
              <option value="7">7 jours à l'avance</option><option value="14">14 jours</option><option value="30">30 jours</option>
              <option value="60">60 jours</option><option value="90">90 jours</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Délais et confirmation</h3>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={jourMeme} onChange={(e) => setJourMeme(e.target.checked)} />
          <span><b>Réservation le jour même</b><br /><span className="small">Décoché, tes clients réservent au plus tôt pour demain — et t'appellent pour ce soir.</span></span>
        </label>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-preavis">Préavis minimum</label>
            <select id="resa-preavis" value={preavis} onChange={(e) => setPreavis(e.target.value)}>
              <option value="0">Aucun</option><option value="30">30 minutes</option><option value="60">1 heure</option>
              <option value="120">2 heures</option><option value="180">3 heures</option><option value="360">6 heures</option>
              <option value="720">12 heures</option><option value="1440">24 heures</option><option value="2880">48 heures</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-annul">Annulation gratuite jusqu'à</label>
            <select id="resa-annul" value={annulation} onChange={(e) => setAnnulation(e.target.value)}>
              <option value="0">Jusqu'à l'heure de la réservation</option><option value="2">2 h avant</option><option value="6">6 h avant</option>
              <option value="12">12 h avant</option><option value="24">24 h avant</option><option value="48">48 h avant</option><option value="72">72 h avant</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-max">Groupe maximum en ligne</label>
            <input id="resa-max" type="number" min="1" max="200" value={maxGroupe} placeholder="Ma plus grande table" onChange={(e) => setMaxGroupe(e.target.value)} />
          </div>
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}>Passé le délai d'annulation, le client ne peut plus annuler en ligne et l'acompte éventuel te reste acquis. Au-delà du groupe maximum, il est invité à t'appeler.</p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer', marginTop: 12 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={confirmationAuto} onChange={(e) => setConfirmationAuto(e.target.checked)} />
          <span><b>Confirmation automatique</b><br /><span className="small">Coché, la table est confirmée dès la demande (si une table est libre). Décoché, chaque demande attend ton accord dans l'agenda — le client est prévenu par e-mail de ta décision.</span></span>
        </label>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>💳 Acompte</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>
          Encaissé au moment de la réservation, gardé par Fairide, puis <b>viré sur ton compte</b> quand le
          client arrive (tu le déduis de l'addition) ou ne se présente pas. Il lui est rendu s'il annule
          dans les délais, ou si tu refuses la table. Une commande de plats prépayée n'y est jamais soumise.
        </p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={acompte} onChange={(e) => setAcompte(e.target.checked)} />
          <span><b>Demander un acompte</b></span>
        </label>
        {acompte && (
          <>
            <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
              <div style={{ flex: '1 1 120px' }}>
                <label htmlFor="ac-montant">Montant</label>
                <input id="ac-montant" type="number" min="0" max="500" step="0.5" value={acompteMontant} onChange={(e) => setAcompteMontant(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label htmlFor="ac-mode">Calculé</label>
                <select id="ac-mode" value={acompteMode} onChange={(e) => setAcompteMode(e.target.value)}>
                  <option value="per_person">par personne</option>
                  <option value="per_booking">par réservation</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px' }}>
                <label htmlFor="ac-seuil">À partir de</label>
                <select id="ac-seuil" value={acompteSeuil} onChange={(e) => setAcompteSeuil(e.target.value)}>
                  {[1, 2, 4, 6, 8, 10, 12, 15, 20].map((n) => <option key={n} value={n}>{n === 1 ? 'toute réservation' : `${n} personnes`}</option>)}
                </select>
              </div>
            </div>
            <p className="small" style={{ margin: '8px 0 0' }}>
              Exemple : une table de 4 paiera <b>{euros(acompteMode === 'per_person' ? Number(acompteMontant) * 4 : Number(acompteMontant))}</b>
              {Number(acompteSeuil) > 4 ? ' — non, rien : sous le seuil.' : '.'}
              {' '}Un montant différent <b>selon le type de table</b> (terrasse, salon privé…) se règle dans l'onglet <b>Plan de salle</b>, table par table.
              {tablesAvecAcompte.length > 0 && <> Actuellement : {tablesAvecAcompte.map((t) => `${t.name} ${t.depositAmount === 0 ? 'sans acompte' : euros(t.depositAmount)}`).join(', ')}.</>}
            </p>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="ac-note">Précision affichée au client (optionnel)</label>
              <input id="ac-note" value={acompteNote} maxLength={300} placeholder="Ex. : déduit de l'addition, non remboursable en cas d'absence." onChange={(e) => setAcompteNote(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Message d'accueil</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>Affiché au client au moment de réserver : tenue, retard toléré, animaux, poussettes…</p>
        <textarea rows={2} maxLength={500} value={accueil} onChange={(e) => setAccueil(e.target.value)} placeholder="Ex. : table gardée 15 minutes, merci de prévenir en cas de retard. Chiens bienvenus en terrasse." />
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>🔗 Ton lien de réservation</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>
          À mettre sur ton site, ta fiche Google (bouton « Réserver »), Instagram ou Facebook : le client
          arrive sur ta fiche Fairide et réserve avec tes règles ci-dessus.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input readOnly value={lien} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className="btn-outline" onClick={copierLien}>{copie ? 'Copié ✓' : 'Copier'}</button>
        </div>
      </div>

      <div className="resa-enregistrer">
        <button className="btn-teal" disabled={enregistre} onClick={enregistrer}>{enregistre ? '…' : 'Enregistrer les réglages'}</button>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// PLAN DE SALLE — les tables, leur zone (type) et leur acompte propre.
// ------------------------------------------------------------------------------------------------
function PlanDeSalle({ token, toast, restaurant, restoId, tables, setTables }) {
  const [nom, setNom] = useState('');
  const [places, setPlaces] = useState(2);
  const [zone, setZone] = useState('');
  const [ajout, setAjout] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const acompteActif = !!restaurant?.reservationDepositEnabled;
  const zones = useMemo(() => [...new Set((tables || []).map((t) => t.zone).filter(Boolean))], [tables]);

  async function ajouterTable(e) {
    e.preventDefault();
    if (!nom.trim()) { toast('Donne un nom à la table.'); return; }
    setAjout(true);
    try {
      const t = await api(`/restaurants/${restoId}/tables`, { method: 'POST', token, body: { name: nom.trim(), seats: Number(places), zone: zone.trim() } });
      setTables((l) => [...(l || []), t]);
      setNom(''); setPlaces(2);
      toast('Table ajoutée.');
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
        toast('Table désactivée : elle a déjà servi à une réservation, on la garde pour l’historique.');
      } else {
        setTables((l) => l.filter((x) => x.id !== id));
        toast('Table supprimée.');
      }
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }
  const local = (id, champs) => setTables((l) => l.map((x) => (x.id === id ? { ...x, ...champs } : x)));

  const actives = (tables || []).filter((t) => t.active);
  const totalPlaces = actives.reduce((a, t) => a + Number(t.seats || 0), 0);
  const plusGrande = actives.reduce((m, t) => Math.max(m, Number(t.seats || 0)), 0);

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Tes tables</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>
        Une réservation occupe une table entière, la plus petite qui accueille le groupe. La <b>zone</b>
        {' '}(Salle, Terrasse, Salon privé…) sert à t'y retrouver et à fixer un acompte différent par type de
        table : laisse la colonne Acompte vide pour suivre la règle générale, mets 0 pour n'en jamais demander.
      </p>
      {tables === null && <p className="small">Chargement…</p>}
      {tables !== null && tables.length === 0 && (
        <p className="small" style={{ margin: '0 0 12px', padding: '9px 11px', background: 'var(--cream-dim)', borderRadius: 9 }}>
          ⚠️ Aucune table déclarée : les réservations restent acceptées mais <b>sans aucune limite</b>.
        </p>
      )}
      {tables !== null && tables.length > 0 && (
        <>
          <div className="service-table-wrap">
            <table className="service-table plan-table">
              <thead>
                <tr><th>Table</th><th>Zone</th><th className="col-actif">Places</th>{acompteActif && <th className="col-actif">Acompte</th>}<th className="col-actif">Ouverte</th><th className="col-actif"> </th></tr>
              </thead>
              <tbody>
                {tables.map((t) => (
                  <tr key={t.id} className={t.active ? '' : 'service-off'}>
                    <td>
                      <input value={t.name} disabled={enCours === t.id} style={{ padding: '5px 8px', fontSize: 13 }}
                        onChange={(e) => local(t.id, { name: e.target.value })}
                        onBlur={(e) => e.target.value.trim() !== '' && modifier(t.id, { name: e.target.value.trim() })} />
                    </td>
                    <td>
                      <input value={t.zone || ''} list="resa-zones" placeholder="Salle" disabled={enCours === t.id} style={{ maxWidth: 120, padding: '5px 8px', fontSize: 13 }}
                        onChange={(e) => local(t.id, { zone: e.target.value })}
                        onBlur={(e) => modifier(t.id, { zone: e.target.value.trim() })} />
                    </td>
                    <td className="col-actif">
                      <input type="number" min="1" max="30" value={t.seats} disabled={enCours === t.id} style={{ width: 62, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                        onChange={(e) => local(t.id, { seats: e.target.value })}
                        onBlur={(e) => Number(e.target.value) >= 1 && modifier(t.id, { seats: Number(e.target.value) })} />
                    </td>
                    {acompteActif && (
                      <td className="col-actif">
                        <input type="number" min="0" max="500" step="0.5" value={t.depositAmount ?? ''} placeholder="règle" disabled={enCours === t.id}
                          title="Vide : règle générale. 0 : jamais d'acompte sur cette table."
                          style={{ width: 72, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                          onChange={(e) => local(t.id, { depositAmount: e.target.value === '' ? null : e.target.value })}
                          onBlur={(e) => modifier(t.id, { depositAmount: e.target.value === '' ? null : Number(e.target.value) })} />
                      </td>
                    )}
                    <td className="col-actif">
                      <label className="service-toggle">
                        <input type="checkbox" checked={t.active} disabled={enCours === t.id} onChange={(e) => modifier(t.id, { active: e.target.checked })} />
                        <span className="sr-only">Table {t.name} ouverte à la réservation</span>
                      </label>
                    </td>
                    <td className="col-actif">
                      <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} disabled={enCours === t.id} onClick={() => supprimer(t.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="resa-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
          <p className="small" style={{ margin: '10px 0 0' }}>
            <b>{actives.length}</b> table{actives.length > 1 ? 's' : ''} ouverte{actives.length > 1 ? 's' : ''} ·
            {' '}<b>{totalPlaces}</b> place{totalPlaces > 1 ? 's' : ''} au total ·
            {' '}plus grand groupe acceptable : <b>{plusGrande || 0}</b>
            {zones.length > 0 && <> · zones : {zones.join(', ')}</>}
          </p>
        </>
      )}
      <form onSubmit={ajouterTable} className="row" style={{ gap: 8, marginTop: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <label htmlFor="table-nom">Nom de la table</label>
          <input id="table-nom" value={nom} placeholder="Table 1, Terrasse 2…" onChange={(e) => setNom(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 120px' }}>
          <label htmlFor="table-zone">Zone</label>
          <input id="table-zone" value={zone} list="resa-zones" placeholder="Salle" onChange={(e) => setZone(e.target.value)} />
        </div>
        <div style={{ flex: '0 0 96px' }}>
          <label htmlFor="table-places">Places</label>
          <input id="table-places" type="number" min="1" max="30" value={places} onChange={(e) => setPlaces(e.target.value)} />
        </div>
        <button className="btn-teal" disabled={ajout}>{ajout ? '…' : 'Ajouter'}</button>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// STATISTIQUES — volume, couverts, absents, acomptes, et la forme de la semaine.
// ------------------------------------------------------------------------------------------------
function Statistiques({ token, toast, restoId }) {
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
          <b style={{ flex: 1 }}>Période</b>
          <select value={periode} onChange={(e) => setPeriode(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
            <option value="mois">Mois en cours</option>
            <option value="avenir">30 prochains jours</option>
          </select>
        </div>
      </div>
      {chargement && <p className="small">Chargement…</p>}
      {!chargement && stats && (
        <>
          <div className="resa-stats">
            <Stat valeur={stats.total} label="réservations" />
            <Stat valeur={stats.couverts} label="couverts" />
            <Stat valeur={stats.couvertsMoyens ?? '–'} label="couverts par table" />
            <Stat valeur={stats.enAttente} label="à confirmer" accent={stats.enAttente > 0 ? 'warn' : undefined} />
            <Stat valeur={stats.absents} label={`absents${stats.tauxAbsence !== null ? ` · ${stats.tauxAbsence} %` : ''}`} accent={stats.absents > 0 ? 'danger' : undefined} />
            <Stat valeur={stats.annulees + stats.refusees} label="annulées / refusées" />
            <Stat valeur={euros(stats.acompteEncaisse)} label="acomptes encaissés" />
            <Stat valeur={euros(stats.acompteConserve)} label="acomptes conservés" />
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Couverts par jour de la semaine</h3>
            <div className="resa-barres">
              {ordreJours.map((d) => (
                <div key={d} className="resa-barre-col" title={`${stats.parJourSemaine[d].reservations} réservation(s), ${stats.parJourSemaine[d].couverts} couverts`}>
                  <span className="small">{stats.parJourSemaine[d].couverts || ''}</span>
                  <div className="resa-barre" style={{ height: `${(stats.parJourSemaine[d].couverts / maxJour) * 100}%` }} />
                  <span className="small">{JOURS_COURTS[d]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Couverts par heure d'arrivée</h3>
            {heuresUtiles.length === 0 && <p className="small" style={{ margin: 0 }}>Aucune réservation sur la période.</p>}
            {heuresUtiles.length > 0 && (
              <div className="resa-barres">
                {heuresUtiles.map((h) => (
                  <div key={h.heure} className="resa-barre-col" title={`${h.reservations} réservation(s), ${h.couverts} couverts`}>
                    <span className="small">{h.couverts || ''}</span>
                    <div className="resa-barre" style={{ height: `${(h.couverts / maxHeure) * 100}%` }} />
                    <span className="small">{h.heure}h</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>D'où viennent tes réservations</h3>
            <p className="small" style={{ margin: 0 }}>
              {Object.entries(SOURCES).map(([cle, label]) => `${label} : ${stats.parSource[cle] || 0}`).join(' · ')}
              {stats.acompteRembourse > 0 && <> · acomptes remboursés : {euros(stats.acompteRembourse)}</>}
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
