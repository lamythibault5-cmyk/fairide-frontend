import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { SkeletonCards } from '../../components/Skeleton';
import usePageMeta from '../../hooks/usePageMeta';

// Parcours de réservation d'une table, en cinq étapes courtes (convives → date et heure → préférences
// → coordonnées → confirmation), accessible sans compte jusqu'aux coordonnées : un visiteur voit les
// disponibilités avant qu'on lui demande de se connecter. Le brouillon survit à l'aller-retour vers la
// connexion (sessionStorage). Les disponibilités (jours puis créneaux) sont recalculées par le serveur
// à chaque affichage : un réglage changé par le restaurateur (horizon, préavis, fermeture, table
// désactivée) est visible immédiatement.
//
// Une réservation est une commande `dine_in` sans article (voir Checkout.jsx pour la variante avec
// commande de plats) ; l'acompte éventuel se paie via Stripe juste après la création.

const ETAPES = ['guests', 'when', 'prefs', 'contact', 'confirm'];
const ICONES = { guests: '👥', when: '📅', prefs: '✏️', contact: '👤', confirm: '✅' };
const CLE_BROUILLON = (id) => `fairide_resa_draft_${id}`;
// Lu une seule fois, à l'initialisation des états : le restaurer dans un effet écraserait la première
// sauvegarde (et, en mode strict de React, les effets doublés se marchaient dessus).
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

export default function ReservationWizard() {
  const { id } = useParams();
  const { t, locale } = useLanguage();
  const { user, token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [restaurant, setRestaurant] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [brouillon] = useState(() => lireBrouillon(id));
  const [etape, setEtape] = useState(() => Math.min(Math.max(0, Number(brouillon.etape) || 0), ETAPES.length - 1));
  const [couverts, setCouverts] = useState(Number(brouillon.couverts) || 2);
  const [mois, setMois] = useState(() => {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(brouillon.date || '') ? new Date(`${brouillon.date}T12:00:00`) : new Date();
    return { annee: d.getFullYear(), mois: d.getMonth() };
  });
  const [jours, setJours] = useState(null); // réponse availability-days du mois affiché
  const [date, setDate] = useState(brouillon.date || '');
  const [dispo, setDispo] = useState(null); // réponse availability du jour choisi
  const [creneau, setCreneau] = useState(brouillon.creneau || null);
  const [note, setNote] = useState(brouillon.note || '');
  const [nom, setNom] = useState(brouillon.nom || '');
  const [telephone, setTelephone] = useState(brouillon.telephone || '');
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);

  usePageMeta({ title: restaurant ? t('resaWizard.pageTitle', { name: restaurant.name }) : t('resaWizard.title') });

  // Brouillon sauvegardé à chaque changement (survit à l'aller-retour vers la connexion), effacé une
  // fois la réservation créée.
  useEffect(() => {
    if (resultat) { sessionStorage.removeItem(CLE_BROUILLON(id)); return; }
    try { sessionStorage.setItem(CLE_BROUILLON(id), JSON.stringify({ couverts, date, creneau, note, nom, telephone, etape })); } catch { /* sans stockage, pas de brouillon */ }
  }, [id, couverts, date, creneau, note, nom, telephone, etape, resultat]);

  useEffect(() => {
    api(`/restaurants/${id}`).then(setRestaurant).catch(() => setIntrouvable(true));
  }, [id]);

  // Coordonnées préremplies depuis le compte, sans écraser une saisie en cours.
  useEffect(() => {
    if (!user) return;
    setNom((v) => v || user.name || '');
    setTelephone((v) => v || user.phone || '');
  }, [user]);

  // Jours réservables du mois affiché, pour le nombre de convives choisi.
  useEffect(() => {
    if (!restaurant?.offersDineIn) return undefined;
    let annule = false;
    setJours(null);
    const de = `${mois.annee}-${String(mois.mois + 1).padStart(2, '0')}-01`;
    const a = `${mois.annee}-${String(mois.mois + 1).padStart(2, '0')}-${String(new Date(mois.annee, mois.mois + 1, 0).getDate()).padStart(2, '0')}`;
    api(`/restaurants/${id}/availability-days?from=${de}&to=${a}&partySize=${couverts}`)
      .then((d) => { if (!annule) setJours(d); })
      .catch((e) => { if (!annule) { setJours({ jours: [] }); toast(e.message); } });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, restaurant?.offersDineIn, mois.annee, mois.mois, couverts]);

  // Créneaux du jour choisi.
  useEffect(() => {
    if (!date) { setDispo(null); return undefined; }
    let annule = false;
    setDispo(null);
    api(`/restaurants/${id}/availability?date=${date}&partySize=${couverts}`)
      .then((d) => {
        if (annule) return;
        setDispo(d);
        setCreneau((c) => (c && d.creneaux?.some((x) => x.debut === c.debut && x.disponible) ? c : null));
      })
      .catch((e) => { if (!annule) { setDispo({ creneaux: [] }); toast(e.message); } });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date, couverts]);

  const etatParJour = useMemo(() => Object.fromEntries((jours?.jours || []).map((j) => [j.date, j.etat])), [jours]);
  const maxCouverts = jours?.maxCouverts || restaurant?.reservationMaxParty || 12;
  const regles = jours?.regles;

  if (introuvable) return <div className="empty">{t('resaWizard.notFound')}</div>;
  if (!restaurant) return <SkeletonCards count={2} />;
  if (!restaurant.offersDineIn) {
    return (
      <div className="card">
        <p style={{ margin: 0 }}>{t('resaWizard.noReservations', { name: restaurant.name })}</p>
        <button type="button" className="btn-outline" style={{ marginTop: 12 }} onClick={() => navigate(`/restaurants/${id}`)}>{t('resaWizard.backToRestaurant')}</button>
      </div>
    );
  }

  const cle = ETAPES[etape];
  const dateLisible = (iso, options) => {
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j, 12).toLocaleDateString(locale, options || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };
  const heureLisible = (debutISO) => new Date(debutISO).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  const acompte = creneau?.acompte ?? dispo?.acompte?.montant ?? 0;

  function suivant() { setEtape((e) => Math.min(e + 1, ETAPES.length - 1)); window.scrollTo(0, 0); }
  function precedent() { setEtape((e) => Math.max(e - 1, 0)); window.scrollTo(0, 0); }
  function allerA(i) { if (i < etape) { setEtape(i); window.scrollTo(0, 0); } }

  function seConnecter() {
    navigate('/login?audience=client', { state: { from: location.pathname } });
  }

  async function confirmer() {
    if (!creneau || !nom.trim()) return;
    setEnvoi(true);
    try {
      const order = await api('/orders', {
        method: 'POST', token,
        body: {
          restaurantId: id, items: [], orderType: 'dine_in', scheduledFor: creneau.debut,
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
    } catch (e) {
      toast(e.message);
    } finally {
      setEnvoi(false);
    }
  }

  if (resultat) {
    const enAttente = resultat.status === 'nouveau' && !(regles?.confirmationAuto ?? restaurant.reservationAutoConfirm !== false);
    return (
      <div className="resa-wizard">
        <div className="card resa-wizard-done">
          <div className="resa-wizard-done-icon">{enAttente ? '⏳' : '🎉'}</div>
          <h2 style={{ margin: '0 0 6px' }}>{enAttente ? t('resaWizard.doneTitlePending') : t('resaWizard.doneTitle')}</h2>
          <p className="small" style={{ margin: '0 0 14px' }}>{enAttente ? t('resaWizard.donePendingHelp') : t('resaWizard.doneHelp')}</p>
          <div className="resa-wizard-recap">
            <div><span>🏪</span><b>{restaurant.name}</b></div>
            <div><span>📅</span><b>{creneau ? new Date(creneau.debut).toLocaleString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }) : ''}</b></div>
            <div><span>👥</span><b>{t('resaWizard.guestsCount', { n: couverts })}</b> · {nom}</div>
            {resultat.deliveryCode && !enAttente && <div><span>🔑</span>{t('resaWizard.codeLabel')} <b>{resultat.deliveryCode}</b></div>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn-teal" onClick={() => navigate('/orders')}>{t('resaWizard.seeMyReservations')}</button>
            <button type="button" className="btn-outline" onClick={() => navigate(`/restaurants/${id}`)}>{t('resaWizard.backToRestaurant')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resa-wizard">
      <div className="resa-wizard-head">
        <button type="button" className="resa-wizard-close" aria-label={t('resaWizard.close')} onClick={() => navigate(`/restaurants/${id}`)}>✕</button>
        <div className="resa-wizard-resto">
          {restaurant.logoImageUrl && <img src={restaurant.logoImageUrl} alt="" />}
          <div>
            <b>{restaurant.name}</b>
            <span className="small">{restaurant.address || restaurant.commune}</span>
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
          {(regles?.messageAccueil || restaurant.reservationWelcomeMessage) && (
            <p className="resa-wizard-welcome">💬 {regles?.messageAccueil || restaurant.reservationWelcomeMessage}</p>
          )}
          <p className="small" style={{ margin: '0 0 10px' }}>{t('resaWizard.guestsHelp')}</p>
          <div className="resa-guests">
            {Array.from({ length: Math.min(Math.max(maxCouverts, 1), 30) }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={n === couverts ? 'active' : ''} onClick={() => { setCouverts(n); setCreneau(null); }}>{n}</button>
            ))}
          </div>
          {jours?.maxCouverts && <p className="small" style={{ margin: '10px 0 0' }}>{t('resaWizard.largerGroups', { max: jours.maxCouverts })}</p>}
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
                const ok = etat === 'ouvert';
                return (
                  <button
                    key={iso} type="button"
                    className={`resa-cal-day ${ok ? 'ok' : etat} ${iso === date ? 'selected' : ''} ${iso === aujourdhuiISO() ? 'today' : ''}`}
                    disabled={!ok}
                    title={ok ? '' : t(`resaWizard.day_${etat}`)}
                    onClick={() => { setDate(iso); setCreneau(null); }}
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
            {regles && (
              <p className="small" style={{ margin: '8px 0 0' }}>
                {t('resaWizard.horizonInfo', { days: regles.horizonJours })}
                {!regles.jourMeme ? ` ${t('resaWizard.noSameDay')}` : ''}
              </p>
            )}
          </div>

          {date && (
            <div className="resa-slots-wrap">
              <div className="resa-slots-date">{dateLisible(date)}</div>
              {!dispo && <p className="small">{t('resaWizard.loadingSlots')}</p>}
              {dispo && dispo.creneaux?.length === 0 && (
                <p className="small">{t(`resaWizard.reason_${dispo.raison || 'ferme'}`, { max: dispo.maxCouverts || '' })}</p>
              )}
              {dispo && dispo.creneaux?.length > 0 && (
                <>
                  <div className="resa-slots">
                    {dispo.creneaux.map((c) => (
                      <button
                        key={c.debut} type="button" disabled={!c.disponible}
                        className={`resa-slot ${creneau?.debut === c.debut ? 'selected' : ''}`}
                        title={c.disponible ? '' : t(`resaWizard.slot_${c.raison || 'complet'}`)}
                        onClick={() => setCreneau(c)}
                      >
                        {c.heure}
                      </button>
                    ))}
                  </div>
                  {!dispo.creneaux.some((c) => c.disponible) && <p className="small" style={{ margin: '8px 0 0' }}>{t('resaWizard.noSlotLeft')}</p>}
                </>
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
          <div className="field">
            <label htmlFor="resa-note">{t('resaWizard.commentLabel')}</label>
            <textarea id="resa-note" rows={4} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('resaWizard.commentPlaceholder')} />
            <div className="small" style={{ textAlign: 'right' }}>{500 - note.length}</div>
          </div>
          <p className="small" style={{ margin: 0 }}>{t('resaWizard.commentHelp')}</p>
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-teal" onClick={suivant}>{note.trim() ? t('resaWizard.next') : t('resaWizard.skip')} →</button>
          </div>
        </div>
      )}

      {cle === 'contact' && (
        <div className="resa-wizard-body">
          {!user ? (
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
                <input id="resa-nom" value={nom} maxLength={80} onChange={(e) => setNom(e.target.value)} placeholder={t('resaWizard.namePlaceholder')} />
              </div>
              <div className="field">
                <label htmlFor="resa-tel">{t('resaWizard.phoneLabel')}</label>
                <input id="resa-tel" type="tel" value={telephone} maxLength={30} onChange={(e) => setTelephone(e.target.value)} placeholder="+32 4xx xx xx xx" />
                <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.phoneHelp')}</p>
              </div>
              <div className="field">
                <label>{t('resaWizard.emailLabel')}</label>
                <input value={user.email} readOnly />
                <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.emailHelp')}</p>
              </div>
            </>
          )}
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-teal" disabled={!user || !nom.trim() || !telephone.trim()} onClick={suivant}>{t('resaWizard.next')} →</button>
          </div>
        </div>
      )}

      {cle === 'confirm' && creneau && (
        <div className="resa-wizard-body">
          <div className="resa-wizard-recap">
            <div><span>🏪</span><b>{restaurant.name}</b>{restaurant.address ? <span className="small"> · {restaurant.address}</span> : null}</div>
            <div><span>📅</span><b>{dateLisible(date)}</b></div>
            <div><span>🕐</span><b>{heureLisible(creneau.debut)}</b> <span className="small">· {t('resaWizard.durationInfo', { min: dispo?.duree || 120 })}</span></div>
            <div><span>👥</span><b>{t('resaWizard.guestsCount', { n: couverts })}</b></div>
            <div><span>👤</span>{nom} · {telephone}</div>
            {note.trim() && <div><span>💬</span>{note.trim()}</div>}
          </div>
          {acompte > 0 && (
            <div className="resa-wizard-deposit">
              <b>💳 {t('resaWizard.depositTitle', { amount: acompte.toFixed(2) })}</b>
              <p className="small" style={{ margin: '4px 0 0' }}>{t('resaWizard.depositHelp')}</p>
              {(dispo?.acompte?.note || restaurant.reservationDepositNote) && <p className="small" style={{ margin: '4px 0 0' }}>{dispo?.acompte?.note || restaurant.reservationDepositNote}</p>}
            </div>
          )}
          <p className="small" style={{ margin: '10px 0 0' }}>
            {(regles?.confirmationAuto ?? restaurant.reservationAutoConfirm !== false) ? t('resaWizard.autoConfirmInfo') : t('resaWizard.manualConfirmInfo')}
            {' '}{t('resaWizard.cancelInfo', { hours: regles?.annulationHeures ?? restaurant.reservationCancelHours ?? 24 })}
          </p>
          <div className="resa-wizard-nav">
            <button type="button" className="btn-outline" onClick={precedent} aria-label={t('resaWizard.back')}>←</button>
            <button type="button" className="btn-gold" disabled={envoi} onClick={confirmer}>
              {envoi ? t('resaWizard.sending') : acompte > 0 ? t('resaWizard.confirmWithDeposit', { amount: acompte.toFixed(2) }) : t('resaWizard.confirm')}
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
