import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';

// Parcours de réservation en cinq étapes (convives → date et heure → préférences → coordonnées →
// confirmation), partagé entre :
//  - le client (mode 'client', page /restaurants/:id/reserver) : disponibilités strictes (horizon,
//    préavis, jour même), connexion demandée à l'étape des coordonnées, acompte payé via Stripe ;
//  - le restaurateur (mode 'resto', Mon commerce → Réservations) : saisie d'une demande reçue par
//    téléphone ou au comptoir. Les règles « en ligne » ne s'appliquent pas à lui : il peut réserver
//    aujourd'hui, au-delà de l'horizon, à une heure libre, forcer une table ; seuls ses horaires et ses
//    fermetures restent affichés pour l'aider. La réservation est confirmée d'office.
// Les disponibilités (jours puis créneaux) sont recalculées par le serveur à chaque affichage.

const ETAPES = ['guests', 'when', 'prefs', 'contact', 'confirm'];
const ICONES = { guests: '👥', when: '📅', prefs: '✏️', contact: '👤', confirm: '✅' };
const CLE_BROUILLON = (id) => `fairide_resa_draft_${id}`;
const DUREES = [60, 90, 120, 150, 180, 240];

function lireBrouillon(id) {
  try { return JSON.parse(sessionStorage.getItem(CLE_BROUILLON(id)) || 'null') || {}; } catch { return {}; }
}
function moisISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function joursDuMois(annee, mois) {
  const premier = new Date(annee, mois, 1);
  const decal = (premier.getDay() + 6) % 7; // lundi en tête
  const cellules = [];
  for (let i = 0; i < decal; i++) cellules.push(null);
  const nb = new Date(annee, mois + 1, 0).getDate();
  for (let j = 1; j <= nb; j++) cellules.push(`${annee}-${String(mois + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`);
  while (cellules.length % 7) cellules.push(null);
  return cellules;
}
function aujourdhuiISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date());
}
// Instant (heure de Bruxelles) d'une heure « libre » tapée par le restaurateur : on part d'une
// estimation puis on corrige l'écart réellement appliqué par Intl (été/hiver).
function instantBruxelles(dateISO, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const [a, mo, j] = dateISO.split('-').map(Number);
  let d = new Date(Date.UTC(a, mo - 1, j, h, m));
  for (let i = 0; i < 2; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const hh = Number(parts.find((p) => p.type === 'hour').value) % 24; const mm = Number(parts.find((p) => p.type === 'minute').value);
    const ecart = (h * 60 + m) - (hh * 60 + mm);
    if (!ecart) break;
    d = new Date(d.getTime() + ecart * 60000);
  }
  return d.toISOString();
}

export default function ReservationSteps({ restaurantId, restaurant, mode = 'client', token, user, tables = [], dateInitiale, onDone, onClose }) {
  const resto = mode === 'resto';
  const { t, locale } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Brouillon (client seulement) : lu à l'initialisation des états, jamais dans un effet.
  const [brouillon] = useState(() => (resto ? {} : lireBrouillon(restaurantId)));
  const [etape, setEtape] = useState(() => Math.min(Math.max(0, Number(brouillon.etape) || 0), ETAPES.length - 1));
  const [couverts, setCouverts] = useState(Number(brouillon.couverts) || 2);
  const [mois, setMois] = useState(() => {
    const src = brouillon.date || dateInitiale || '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(src) ? new Date(`${src}T12:00:00`) : new Date();
    return { annee: d.getFullYear(), mois: d.getMonth() };
  });
  const [jours, setJours] = useState(null);
  const [date, setDate] = useState(brouillon.date || (resto && dateInitiale) || '');
  const [dispo, setDispo] = useState(null);
  const [creneau, setCreneau] = useState(brouillon.creneau || null);
  const [heureLibre, setHeureLibre] = useState('');
  const [duree, setDuree] = useState(120);
  const [note, setNote] = useState(brouillon.note || '');
  const [noteInterne, setNoteInterne] = useState('');
  const [source, setSource] = useState('phone');
  const [nom, setNom] = useState(brouillon.nom || '');
  const [telephone, setTelephone] = useState(brouillon.telephone || '');
  const [email, setEmail] = useState('');
  const [tableId, setTableId] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  useEffect(() => {
    if (resto) return;
    if (resultat) { sessionStorage.removeItem(CLE_BROUILLON(restaurantId)); return; }
    try { sessionStorage.setItem(CLE_BROUILLON(restaurantId), JSON.stringify({ couverts, date, creneau, note, nom, telephone, etape })); } catch { /* sans stockage, pas de brouillon */ }
  }, [resto, restaurantId, couverts, date, creneau, note, nom, telephone, etape, resultat]);

  useEffect(() => {
    if (resto || !user) return;
    setNom((v) => v || user.name || '');
    setTelephone((v) => v || user.phone || '');
  }, [resto, user]);

  // Le restaurateur n'est pas limité par la taille de groupe en ligne : on interroge « une table
  // quelconque » (1 couvert) pour voir ce qui est libre, l'attribution finale se fait à la création.
  const couvertsRequete = resto ? 1 : couverts;

  useEffect(() => {
    let annule = false;
    setJours(null);
    const de = `${mois.annee}-${String(mois.mois + 1).padStart(2, '0')}-01`;
    const a = `${mois.annee}-${String(mois.mois + 1).padStart(2, '0')}-${String(new Date(mois.annee, mois.mois + 1, 0).getDate()).padStart(2, '0')}`;
    api(`/restaurants/${restaurantId}/availability-days?from=${de}&to=${a}&partySize=${couvertsRequete}&duration=${resto ? duree : ''}`)
      .then((d) => { if (!annule) setJours(d); })
      .catch((e) => { if (!annule) { setJours({ jours: [] }); toast(e.message); } });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, mois.annee, mois.mois, couvertsRequete, resto ? duree : 0]);

  useEffect(() => {
    if (!date) { setDispo(null); return undefined; }
    let annule = false;
    setDispo(null);
    api(`/restaurants/${restaurantId}/availability?date=${date}&partySize=${couvertsRequete}&duration=${resto ? duree : ''}`)
      .then((d) => {
        if (annule) return;
        setDispo(d);
        setCreneau((c) => (c && (c.libre || d.creneaux?.some((x) => x.debut === c.debut && (resto || x.disponible))) ? c : null));
      })
      .catch((e) => { if (!annule) { setDispo({ creneaux: [] }); toast(e.message); } });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, date, couvertsRequete, resto ? duree : 0]);

  const etatParJour = useMemo(() => Object.fromEntries((jours?.jours || []).map((j) => [j.date, j.etat])), [jours]);
  const maxCouverts = resto ? 30 : (jours?.maxCouverts || restaurant?.reservationMaxParty || 12);
  const regles = jours?.regles;
  const cle = ETAPES[etape];
  const aujourdhui = aujourdhuiISO();

  const dateLisible = (iso, options) => {
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j, 12).toLocaleDateString(locale, options || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const heureLisible = (debutISO) => new Date(debutISO).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  const acompte = resto ? 0 : (creneau?.acompte ?? dispo?.acompte?.montant ?? 0);

  // Jour cliquable : client → seulement « ouvert » ; restaurateur → tout jour à venir où le restaurant
  // n'est pas fermé (complet compris : il pourra forcer une table).
  function jourSelectionnable(iso, etat) {
    if (!resto) return etat === 'ouvert';
    return iso >= aujourdhui && !['ferme', 'fermeture', 'chargement'].includes(etat);
  }
  function creneauSelectionnable(c) { return resto ? true : c.disponible; }

  function suivant() { setEtape((e) => Math.min(e + 1, ETAPES.length - 1)); window.scrollTo(0, 0); }
  function precedent() { setEtape((e) => Math.max(e - 1, 0)); window.scrollTo(0, 0); }
  function allerA(i) { if (i < etape) { setEtape(i); window.scrollTo(0, 0); } }
  function seConnecter() { navigate('/login?audience=client', { state: { from: location.pathname } }); }
  function choisirHeureLibre(hhmm) {
    setHeureLibre(hhmm);
    if (/^\d{2}:\d{2}$/.test(hhmm) && date) setCreneau({ heure: hhmm, debut: instantBruxelles(date, hhmm), disponible: true, libre: true });
  }

  async function confirmer() {
    if (!creneau || !nom.trim()) return;
    setEnvoi(true);
    try {
      if (resto) {
        const r = await api(`/restaurants/${restaurantId}/reservations`, {
          method: 'POST', token,
          body: {
            reservationName: nom.trim(), clientPhone: telephone.trim(), clientEmail: email.trim(), partySize: couverts,
            startAt: creneau.debut, durationMinutes: duree, tableId: tableId || null, internalNote: noteInterne.trim(), note: note.trim(), source
          }
        });
        toast(t('resa.toastAdded'));
        onDone?.(r);
        return;
      }
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId, items: [], orderType: 'dine_in', scheduledFor: creneau.debut,
          partySize: couverts, reservationName: nom.trim(), reservationNote: note.trim(), reservationPhone: telephone.trim(), useBalance: false
        }
      });
      if (order.reservationDepositStatus === 'pending' && order.reservationDepositAmount > 0) {
        const pay = await api(`/payments/deposit-checkout/${order.id}`, { method: 'POST', token });
        if (!pay.simulated) { window.location.href = pay.checkoutUrl; return; }
        setResultat({ ...order, status: 'preparation', reservationDepositStatus: 'paid' });
      } else {
        setResultat(order);
      }
      onDone?.(order);
    } catch (e) {
      toast(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  const confirmationAuto = regles?.confirmationAuto ?? restaurant?.reservationAutoConfirm !== false;

  if (resultat) {
    const enAttente = resultat.status === 'nouveau' && !confirmationAuto;
    return (
      <div className="resa-wizard">
        <div className="card resa-wizard-done">
          <div className="resa-wizard-done-icon">{enAttente ? '⏳' : '🎉'}</div>
          <h2 style={{ margin: '0 0 6px' }}>{enAttente ? t('resaWizard.doneTitlePending') : t('resaWizard.doneTitle')}</h2>
          <p className="small" style={{ margin: '0 0 14px' }}>{enAttente ? t('resaWizard.donePendingHelp') : t('resaWizard.doneHelp')}</p>
          <div className="resa-wizard-recap">
            <div><span>🏪</span><b>{restaurant?.name}</b></div>
            <div><span>📅</span><b>{creneau ? new Date(creneau.debut).toLocaleString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }) : ''}</b></div>
            <div><span>👥</span><b>{t('resaWizard.guestsCount', { n: couverts })}</b> · {nom}</div>
            {resultat.deliveryCode && !enAttente && <div><span>🔑</span>{t('resaWizard.codeLabel')} <b>{resultat.deliveryCode}</b></div>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" onClick={() => navigate('/orders')}>{t('resaWizard.seeMyReservations')}</button>
            <button type="button" className="btn-outline" onClick={() => navigate(`/restaurants/${restaurantId}`)}>{t('resaWizard.backToRestaurant')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`resa-wizard${resto ? ' resa-wizard-resto' : ''}`}>
      <div className="resa-wizard-head">
        <button type="button" className="resa-wizard-close" aria-label={t('resaWizard.close')} onClick={() => (onClose ? onClose() : navigate(`/restaurants/${restaurantId}`))}>✕</button>
        <div className="resa-wizard-resto-id">
          {restaurant?.logoImageUrl && <img src={restaurant.logoImageUrl} alt="" />}
          <div>
            <b>{resto ? t('resaWizard.manualTitle') : restaurant?.name}</b>
            <span className="small">{resto ? t('resaWizard.manualIntro') : (restaurant?.address || restaurant?.commune)}</span>
          </div>
        </div>
      </div>

      <ol className="resa-stepper" aria-label={t('resaWizard.stepsAria')}>
        {ETAPES.map((k, i) => (
          <li key={k} className={i === etape ? 'active' : i < etape ? 'done' : ''}>
            <button type="button" disabled={i >= etape} onClick={() => allerA(i)} aria-current={i === etape ? 'step' : undefined} title={t(`resaWizard.step_${k}`)}>
              <span aria-hidden="true">{ICONES[k]}</span>
            </button>
            {i < ETAPES.length - 1 && <i />}
          </li>
        ))}
      </ol>

      <h2 className="resa-wizard-title">{t(`resaWizard.step_${cle}`)}</h2>

      {cle === 'guests' && (
        <div className="resa-wizard-body">
          {!resto && (regles?.messageAccueil || restaurant?.reservationWelcomeMessage) && (
            <p className="resa-wizard-welcome">💬 {regles?.messageAccueil || restaurant.reservationWelcomeMessage}</p>
          )}
          <p className="small" style={{ margin: '0 0 10px' }}>{t('resaWizard.guestsHelp')}</p>
          <div className="resa-guests">
            {Array.from({ length: Math.min(Math.max(maxCouverts, 1), 30) }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={n === couverts ? 'active' : ''} onClick={() => { setCouverts(n); setCreneau(null); }}>{n}</button>
            ))}
          </div>
          {resto && (
            <div className="field" style={{ marginTop: 12, maxWidth: 220 }}>
              <label htmlFor="resa-couverts-libre">{t('resaWizard.largerGroupInput')}</label>
              <input id="resa-couverts-libre" type="number" min={1} max={200} value={couverts} onChange={(e) => setCouverts(Math.min(200, Math.max(1, Number(e.target.value) || 1)))} />
            </div>
          )}
          {!resto && jours?.maxCouverts && <p className="small" style={{ margin: '10px 0 0' }}>{t('resaWizard.largerGroups', { max: jours.maxCouverts })}</p>}
          <div className="resa-wizard-nav">
            <span />
            <button type="button" className="btn-teal" onClick={suivant}>{t('resaWizard.next')} →</button>
          </div>
        </div>
      )}

      {cle === 'when' && (
        <div className="resa-wizard-body">
          <div className="resa-cal">
            <div className="resa-cal-head">
              <button type="button" aria-label={t('resaWizard.prevMonth')} onClick={() => setMois((m) => (m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { ...m, mois: m.mois - 1 }))} disabled={moisISO(new Date(mois.annee, mois.mois, 1)) <= moisISO(new Date())}>‹</button>
              <b>{new Date(mois.annee, mois.mois, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</b>
              <button type="button" aria-label={t('resaWizard.nextMonth')} onClick={() => setMois((m) => (m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { ...m, mois: m.mois + 1 }))}>›</button>
            </div>
            <div className="resa-cal-days">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <span key={d}>{new Date(2024, 0, d).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}</span>)}
            </div>
            <div className="resa-cal-grid">
              {joursDuMois(mois.annee, mois.mois).map((iso, i) => {
                if (!iso) return <span key={`v${i}`} />;
                const etat = jours ? (etatParJour[iso] || 'passe') : 'chargement';
                const ok = jourSelectionnable(iso, etat);
                // Pour le restaurateur, un jour « trop loin » ou « jour même » reste un jour normal.
                const classeEtat = ok ? (etat === 'complet' ? 'ok complet-force' : 'ok') : etat;
                return (
                  <button
                    key={iso} type="button"
                    className={`resa-cal-day ${classeEtat} ${iso === date ? 'selected' : ''} ${iso === aujourdhui ? 'today' : ''}`}
                    disabled={!ok}
                    title={etat === 'ouvert' || etat === 'chargement' ? '' : t(`resaWizard.day_${etat}`)}
                    onClick={() => { setDate(iso); setCreneau(null); setHeureLibre(''); }}
                  >
                    {Number(iso.slice(8))}
                  </button>
                );
              })}
            </div>
            <div className="resa-cal-legend small">
              <span><i className="ok" /> {t('resaWizard.legendOpen')}</span>
              <span><i className="complet" /> {t('resaWizard.legendFull')}</span>
              <span><i className="ferme" /> {t('resaWizard.legendClosed')}</span>
            </div>
            {regles && !resto && (
              <p className="small" style={{ margin: '8px 0 0' }}>
                {t('resaWizard.horizonInfo', { days: regles.horizonJours })}
                {!regles.jourMeme ? ` ${t('resaWizard.noSameDay')}` : ''}
              </p>
            )}
            {resto && <p className="small" style={{ margin: '8px 0 0' }}>{t('resaWizard.restoRulesInfo')}</p>}
          </div>

          {date && (
            <div className="resa-slots-wrap">
              <div className="resa-slots-date">{dateLisible(date)}</div>
              {resto && (
                <div className="field" style={{ maxWidth: 240 }}>
                  <label htmlFor="resa-duree">{t('resa.duration')}</label>
                  <select id="resa-duree" value={duree} onChange={(e) => { setDuree(Number(e.target.value)); }}>
                    {DUREES.map((m) => <option key={m} value={m}>{m % 60 ? t('resa.durationHM', { h: Math.floor(m / 60), m: m % 60 }) : t('resa.durationH', { h: m / 60 })}</option>)}
                  </select>
                </div>
              )}
              {!dispo && <p className="small">{t('resaWizard.loadingSlots')}</p>}
              {dispo && dispo.creneaux?.length === 0 && (
                <p className="small">{t(`resaWizard.reason_${dispo.raison || 'ferme'}`, { max: dispo.maxCouverts || '' })}</p>
              )}
              {dispo && dispo.creneaux?.length > 0 && (
                <>
                  <div className="resa-slots">
                    {dispo.creneaux.map((c) => (
                      <button
                        key={c.debut} type="button" disabled={!creneauSelectionnable(c)}
                        className={`resa-slot ${creneau?.debut === c.debut ? 'selected' : ''} ${!c.disponible && resto ? (c.raison === 'complet' ? 'force' : 'hors-regles') : ''}`}
                        title={c.disponible ? '' : t(`resaWizard.slot_${c.raison || 'complet'}`)}
                        onClick={() => { setCreneau(c); setHeureLibre(''); }}
                      >
                        {c.heure}{resto && c.raison === 'complet' ? ' ⚠️' : ''}
                      </button>
                    ))}
                  </div>
                  {!resto && !dispo.creneaux.some((c) => c.disponible) && <p className="small" style={{ margin: '8px 0 0' }}>{t('resaWizard.noSlotLeft')}</p>}
                  {resto && dispo.creneaux.some((c) => c.raison === 'complet') && <p className="small" style={{ margin: '8px 0 0' }}>{t('resaWizard.fullSlotResto')}</p>}
                </>
              )}
              {resto && (
                <div className="field" style={{ marginTop: 12, maxWidth: 240 }}>
                  <label htmlFor="resa-heure-libre">{t('resaWizard.otherTime')}</label>
                  <input id="resa-heure-libre" type="time" value={heureLibre} onChange={(e) => choisirHeureLibre(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent}>← {t('resaWizard.editGuests')}</button>
            <button type="button" className="btn-teal" disabled={!creneau} onClick={suivant}>{t('resaWizard.next')} →</button>
          </div>
        </div>
      )}

      {cle === 'prefs' && (
        <div className="resa-wizard-body">
          {resto && (
            <div className="field">
              <label>{t('resa.receivedVia')}</label>
              <div className="resa-choices">
                {[['phone', '📞', t('resa.phone')], ['walk_in', '🚶', t('resa.walkIn')], ['restaurant', '✉️', t('resa.otherSource')]].map(([v, ico, lib]) => (
                  <button key={v} type="button" className={source === v ? 'active' : ''} onClick={() => setSource(v)}>{ico} {lib}</button>
                ))}
              </div>
            </div>
          )}
          <div className="field">
            <label htmlFor="resa-note">{resto ? t('resaWizard.clientRequestLabel') : t('resaWizard.commentLabel')}</label>
            <textarea id="resa-note" rows={resto ? 3 : 4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('resaWizard.commentPlaceholder')} />
            <div className="small" style={{ textAlign: 'right' }}>{500 - note.length}</div>
          </div>
          {resto ? (
            <div className="field">
              <label htmlFor="resa-note-interne">{t('resa.internalNoteShort')}</label>
              <input id="resa-note-interne" value={noteInterne} maxLength={1000} onChange={(e) => setNoteInterne(e.target.value)} placeholder={t('resa.phInternalNoteShort')} />
              <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.internalNoteHelp')}</p>
            </div>
          ) : (
            <p className="small" style={{ margin: 0 }}>{t('resaWizard.commentHelp')}</p>
          )}
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-teal" onClick={suivant}>{note.trim() || noteInterne.trim() ? t('resaWizard.next') : t('resaWizard.skip')} →</button>
          </div>
        </div>
      )}

      {cle === 'contact' && (
        <div className="resa-wizard-body">
          {!resto && !user ? (
            <div className="resa-wizard-login">
              <p style={{ margin: '0 0 6px' }}><b>{t('resaWizard.loginTitle')}</b></p>
              <p className="small" style={{ margin: '0 0 12px' }}>{t('resaWizard.loginHelp')}</p>
              <button type="button" className="btn-teal btn-block" onClick={seConnecter}>{t('resaWizard.loginButton')}</button>
              <p className="small" style={{ margin: '10px 0 0' }}>{t('resaWizard.loginIndividuals')}</p>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="resa-nom">{t('resaWizard.nameLabel')}</label>
                <input id="resa-nom" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} placeholder={resto ? t('resa.phName') : t('resaWizard.namePlaceholder')} autoFocus={resto} />
              </div>
              <div className="field">
                <label htmlFor="resa-tel">{resto ? t('resaWizard.phoneOptional') : t('resaWizard.phoneLabel')}</label>
                <input id="resa-tel" type="tel" value={telephone} maxLength={30} onChange={(e) => setTelephone(e.target.value)} placeholder="+32 4xx xx xx xx" />
                {!resto && <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.phoneHelp')}</p>}
              </div>
              <div className="field">
                <label htmlFor="resa-email">{resto ? t('resa.emailOptional') : t('resaWizard.emailLabel')}</label>
                {resto
                  ? <input id="resa-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
                  : <input id="resa-email" value={user.email} readOnly />}
                <p className="small" style={{ margin: '4px 0 0' }}>{resto ? t('resaWizard.emailHelpResto') : t('resaWizard.emailHelp')}</p>
              </div>
            </>
          )}
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-teal" disabled={(!resto && (!user || !telephone.trim())) || !nom.trim()} onClick={suivant}>{t('resaWizard.next')} →</button>
          </div>
        </div>
      )}

      {cle === 'confirm' && creneau && (
        <div className="resa-wizard-body">
          <div className="resa-wizard-recap">
            <div><span>🏪</span><b>{restaurant?.name}</b>{!resto && restaurant?.address ? <span className="small"> · {restaurant.address}</span> : null}</div>
            <div><span>📅</span><b>{dateLisible(date)}</b></div>
            <div><span>🕐</span><b>{heureLisible(creneau.debut)}</b> <span className="small">· {t('resaWizard.durationInfo', { min: resto ? duree : (dispo?.duree || 120) })}</span></div>
            <div><span>👥</span><b>{t('resaWizard.guestsCount', { n: couverts })}</b></div>
            <div><span>👤</span>{nom}{telephone ? ` · ${telephone}` : ''}{resto && email ? ` · ${email}` : ''}</div>
            {note.trim() && <div><span>💬</span>{note.trim()}</div>}
            {resto && noteInterne.trim() && <div><span>📝</span>{noteInterne.trim()}</div>}
            {resto && <div><span>📥</span>{source === 'phone' ? t('resa.phone') : source === 'walk_in' ? t('resa.walkIn') : t('resa.otherSource')}</div>}
          </div>
          {resto && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="resa-table">{t('resa.table')}</label>
              <select id="resa-table" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">{t('resa.automaticSmallest')}</option>
                {tables.map((tb) => <option key={tb.id} value={tb.id}>{tb.name} ({t('resa.seatsShort', { n: tb.seats })}{tb.zone ? `, ${tb.zone}` : ''})</option>)}
              </select>
              {creneau.raison === 'complet' && <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.fullSlotResto')}</p>}
            </div>
          )}
          {acompte > 0 && (
            <div className="resa-wizard-deposit">
              <b>💳 {t('resaWizard.depositTitle', { amount: acompte.toFixed(2) })}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.depositHelp')}</p>
              {(dispo?.acompte?.note || restaurant?.reservationDepositNote) && <p className="small" style={{ margin: '4px 0 0' }}>{dispo?.acompte?.note || restaurant.reservationDepositNote}</p>}
            </div>
          )}
          {!resto && (
            <p className="small" style={{ margin: '10px 0 0' }}>
              {confirmationAuto ? t('resaWizard.autoConfirmInfo') : t('resaWizard.manualConfirmInfo')}
              {' '}{t('resaWizard.cancelInfo', { hours: regles?.annulationHeures ?? restaurant?.reservationCancelHours ?? 24 })}
            </p>
          )}
          {resto && <p className="small" style={{ margin: '10px 0 0' }}>{email.trim() ? t('resaWizard.restoConfirmWithEmail') : t('resaWizard.restoConfirmNoEmail')}</p>}
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-gold" disabled={envoi} onClick={confirmer}>
              {envoi ? t('resaWizard.sending') : resto ? t('resa.addToAgenda') : acompte > 0 ? t('resaWizard.confirmWithDeposit', { amount: acompte.toFixed(2) }) : t('resaWizard.confirm')}
            </button>
          </div>
        </div>
      )}
      {cle === 'confirm' && !creneau && (
        <div className="resa-wizard-body">
          <p className="small">{t('resaWizard.slotLost')}</p>
          <div className="resa-wizard-nav"><span /><button type="button" className="btn-teal" onClick={() => setEtape(1)}>{t('resaWizard.chooseSlot')}</button></div>
        </div>
      )}
    </div>
  );
}
