import { useEffect, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from '../ConfirmDialog';
import { useLanguage } from '../../context/LanguageContext';
import { decalerJour, euros, isoDuJour, libelleJour } from './resaUtils';

// RÉGLAGES — ce que le client peut réserver en ligne, et à quelles conditions : horaires de
// réservation, pas des créneaux, capacité par créneau, préavis, horizon, groupe maximal, acompte,
// notifications du restaurateur (e-mail, SMS), blocages « complet » par service.

const JOURS = [
  { cle: 'mon', label: 'monday' }, { cle: 'tue', label: 'tuesday' }, { cle: 'wed', label: 'wednesday' },
  { cle: 'thu', label: 'thursday' }, { cle: 'fri', label: 'friday' }, { cle: 'sat', label: 'saturday' },
  { cle: 'sun', label: 'sunday' }
];

export default function ReservationSettings({ token, toast, restaurant, restoId, loadDashboard, tables }) {
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
  const [maxCouvertsCreneau, setMaxCouvertsCreneau] = useState('');
  const [maxResasCreneau, setMaxResasCreneau] = useState('');
  const [acompte, setAcompte] = useState(false);
  const [acompteMode, setAcompteMode] = useState('per_person');
  const [acompteMontant, setAcompteMontant] = useState(10);
  const [acompteSeuil, setAcompteSeuil] = useState(1);
  const [acompteNote, setAcompteNote] = useState('');
  const [accueil, setAccueil] = useState('');
  const [notifSms, setNotifSms] = useState(false);
  const [notifTel, setNotifTel] = useState('');
  const [smsDispo, setSmsDispo] = useState(null);
  const [enregistre, setEnregistre] = useState(false);

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
    setMaxCouvertsCreneau(restaurant.reservationMaxCoversPerSlot || '');
    setMaxResasCreneau(restaurant.reservationMaxBookingsPerSlot || '');
    setAcompte(!!restaurant.reservationDepositEnabled);
    setAcompteMode(restaurant.reservationDepositMode || 'per_person');
    setAcompteMontant(restaurant.reservationDepositAmount || 10);
    setAcompteSeuil(restaurant.reservationDepositMinParty || 1);
    setAcompteNote(restaurant.reservationDepositNote || '');
    setAccueil(restaurant.reservationWelcomeMessage || '');
    setNotifSms(!!restaurant.reservationNotifySms);
    setNotifTel(restaurant.reservationNotifyPhone || restaurant.phone || '');
  }, [restaurant]);

  useEffect(() => {
    api('/health').then((h) => setSmsDispo(!!h?.services?.sms)).catch(() => setSmsDispo(false));
  }, []);

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
          maxCoversPerSlot: maxCouvertsCreneau === '' ? null : Number(maxCouvertsCreneau),
          maxBookingsPerSlot: maxResasCreneau === '' ? null : Number(maxResasCreneau),
          depositEnabled: acompte, depositMode: acompteMode, depositAmount: Number(acompteMontant), depositMinParty: Number(acompteSeuil),
          depositNote: acompteNote, welcomeMessage: accueil,
          notifySms: notifSms, notifyPhone: notifTel
        }
      });
      loadDashboard?.(restoId);
      toast(t('resa.toastSettingsSaved'));
    } catch (err) { toast(err.message); } finally { setEnregistre(false); }
  }

  const tablesAvecAcompte = (tables || []).filter((tb) => tb.active && tb.depositAmount !== null);
  const sieges = (tables || []).filter((tb) => tb.active).reduce((a, tb) => a + Number(tb.seats || 0), 0);
  if (!restaurant) return <p className="small">{t('resa.loading')}</p>;

  return (
    <>
      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.whenTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t('resa.whenIntro')}</p>
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
                    <input type="time" value={p.open} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'open', e.target.value)} aria-label={t('resa.serviceStart')} />
                    <span className="small">→</span>
                    <input type="time" value={p.close} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'close', e.target.value)} aria-label={t('resa.serviceEnd')} />
                    <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => retirerPlage(j.cle, i)} aria-label={t('resa.removeService')}>🗑️</button>
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
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.capacityTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{t('resa.capacityIntro', { seats: sieges })}</p>
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-cap-couverts">{t('resa.capacityCovers')}</label>
            <input id="resa-cap-couverts" type="number" min="1" max="2000" value={maxCouvertsCreneau} placeholder={t('resa.capacityPh')} onChange={(e) => setMaxCouvertsCreneau(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-cap-resas">{t('resa.capacityBookings')}</label>
            <input id="resa-cap-resas" type="number" min="1" max="500" value={maxResasCreneau} placeholder={t('resa.capacityPh')} onChange={(e) => setMaxResasCreneau(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="resa-max">{t('resa.maxPartyOnline')}</label>
            <input id="resa-max" type="number" min="1" max="200" value={maxGroupe} placeholder={t('resa.phMaxParty')} onChange={(e) => setMaxGroupe(e.target.value)} />
          </div>
        </div>
        <p className="small" style={{ margin: '8px 0 0' }}>{t('resa.capacityHelp')}</p>
      </div>

      <Blocages restoId={restoId} token={token} toast={toast} />

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
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('resa.delaysHelp')}</p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer', marginTop: 12 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={confirmationAuto} onChange={(e) => setConfirmationAuto(e.target.checked)} />
          <span><b>{t('resa.autoConfirm')}</b><br /><span className="small">{t('resa.autoConfirmHelp')}</span></span>
        </label>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.notifTitle')}</h3>
        <p className="small" style={{ margin: '0 0 10px' }}>{t('resa.notifIntro')}</p>
        <label className="row resa-regle" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={notifSms} onChange={(e) => setNotifSms(e.target.checked)} />
          <span><b>{t('resa.notifSms')}</b><br /><span className="small">{smsDispo === false ? t('resa.notifSmsUnavailable') : t('resa.notifSmsHelp')}</span></span>
        </label>
        {notifSms && (
          <div className="field" style={{ marginTop: 10, maxWidth: 280 }}>
            <label htmlFor="resa-notif-tel">{t('resa.notifPhone')}</label>
            <input id="resa-notif-tel" type="tel" value={notifTel} maxLength={30} placeholder="+32 4xx xx xx xx" onChange={(e) => setNotifTel(e.target.value)} />
          </div>
        )}
        <p className="small" style={{ margin: '10px 0 0' }}>{t('resa.notifClientHelp')}</p>
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
        <div className="resa-doc" style={{ marginTop: 12 }}>
          <b>{t('resa.imprintTitle')}</b>
          <p style={{ margin: '4px 0 0' }}>{t('resa.imprintText')}</p>
          <ul>
            <li>{t('resa.imprintPoint1')}</li>
            <li>{t('resa.imprintPoint2')}</li>
            <li>{t('resa.imprintPoint3')}</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.welcomeTitle')}</h3>
        <p className="small" style={{ margin: '0 0 8px' }}>{t('resa.welcomeHelp')}</p>
        <textarea rows={2} maxLength={500} value={accueil} onChange={(e) => setAccueil(e.target.value)} placeholder={t('resa.phWelcome')} />
      </div>

      <div className="resa-enregistrer">
        <button className="btn-teal" disabled={enregistre} onClick={enregistrer}>{enregistre ? '…' : t('resa.saveSettings')}</button>
      </div>
    </>
  );
}

// « Complet ce soir » : blocages de service (toute la journée ou une plage), avec liste des blocages à
// venir. Différent des fermetures (le restaurant est ouvert, il ne prend juste plus de réservation).
function Blocages({ restoId, token, toast }) {
  const { t, locale } = useLanguage();
  const [blocs, setBlocs] = useState(null);
  const [erreur, setErreur] = useState('');
  const [f, setF] = useState({ date: isoDuJour(new Date()), mode: 'jour', debut: '18:00', fin: '23:00', raison: '' });
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState(null);

  function charger() {
    setErreur('');
    api(`/restaurants/${restoId}/reservation-blocks`, { token }).then(setBlocs).catch((e) => { setBlocs([]); setErreur(e.message); });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [restoId]);

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const b = await api(`/restaurants/${restoId}/reservation-blocks`, {
        method: 'POST', token,
        body: { date: f.date, startTime: f.mode === 'plage' ? f.debut : null, endTime: f.mode === 'plage' ? f.fin : null, reason: f.raison }
      });
      setBlocs((l) => [...(l || []), b].sort((x, y) => (x.date + (x.startTime || '')).localeCompare(y.date + (y.startTime || ''))));
      setF((s) => ({ ...s, raison: '' }));
      toast(t('resa.blockAdded'));
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }
  async function supprimer(id) {
    try {
      await api(`/restaurants/${restoId}/reservation-blocks/${id}`, { method: 'DELETE', token });
      setBlocs((l) => (l || []).filter((b) => b.id !== id));
      toast(t('resa.blockRemoved'));
    } catch (err) { toast(err.message); }
  }
  const raccourcis = [[t('resa.blockTonight'), () => setF((s) => ({ ...s, date: isoDuJour(new Date()), mode: 'plage', debut: '17:00', fin: '23:59' }))],
    [t('resa.blockToday'), () => setF((s) => ({ ...s, date: isoDuJour(new Date()), mode: 'jour' }))],
    [t('resa.blockTomorrow'), () => setF((s) => ({ ...s, date: decalerJour(isoDuJour(new Date()), 1), mode: 'jour' }))]];

  return (
    <div className="card">
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{t('resa.blocksTitle')}</h3>
      <p className="small" style={{ margin: '0 0 10px' }}>{t('resa.blocksIntro')}</p>
      <form onSubmit={ajouter}>
        <div className="pill-row" style={{ marginBottom: 8 }}>
          {raccourcis.map(([lib, fn]) => <button key={lib} type="button" className="pill" style={{ cursor: 'pointer', border: '1px solid var(--line)' }} onClick={fn}>{lib}</button>)}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 140px' }}>
            <label htmlFor="bloc-date">{t('resa.day')}</label>
            <input id="bloc-date" type="date" value={f.date} onChange={(e) => setF((s) => ({ ...s, date: e.target.value }))} required />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label htmlFor="bloc-mode">{t('resa.blockScope')}</label>
            <select id="bloc-mode" value={f.mode} onChange={(e) => setF((s) => ({ ...s, mode: e.target.value }))}>
              <option value="jour">{t('resa.blockWholeDay')}</option>
              <option value="plage">{t('resa.blockRange')}</option>
            </select>
          </div>
          {f.mode === 'plage' && (
            <>
              <div style={{ flex: '0 0 100px' }}>
                <label htmlFor="bloc-debut">{t('resa.serviceStart')}</label>
                <input id="bloc-debut" type="time" value={f.debut} onChange={(e) => setF((s) => ({ ...s, debut: e.target.value }))} required />
              </div>
              <div style={{ flex: '0 0 100px' }}>
                <label htmlFor="bloc-fin">{t('resa.serviceEnd')}</label>
                <input id="bloc-fin" type="time" value={f.fin} onChange={(e) => setF((s) => ({ ...s, fin: e.target.value }))} required />
              </div>
            </>
          )}
          <div style={{ flex: '2 1 160px' }}>
            <label htmlFor="bloc-raison">{t('resa.blockReason')}</label>
            <input id="bloc-raison" value={f.raison} maxLength={200} placeholder={t('resa.blockReasonPh')} onChange={(e) => setF((s) => ({ ...s, raison: e.target.value }))} />
          </div>
          <button type="submit" className="btn-outline" disabled={envoi}>{envoi ? '…' : t('resa.blockAdd')}</button>
        </div>
      </form>
      <div className="resa-blocs-liste">
        {blocs === null && <p className="small" style={{ margin: 0 }}>{t('resa.loading')}</p>}
        {erreur && <p className="small" style={{ color: 'var(--red)', margin: 0 }}>{erreur}</p>}
        {blocs && blocs.length === 0 && !erreur && <p className="small" style={{ margin: 0 }}>{t('resa.blocksNone')}</p>}
        {blocs && blocs.map((b) => (
          <div key={b.id} className="resa-bloc-ligne">
            <b>{libelleJour(b.date, true, locale)}</b>
            <span className="small">{b.startTime ? `${b.startTime} → ${b.endTime}` : t('resa.blockWholeDay')}{b.reason ? ` · ${b.reason}` : ''}</span>
            <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setASupprimer(b)}>{t('resa.blockRemove')}</button>
          </div>
        ))}
      </div>
      <ConfirmDialog open={!!aSupprimer} title={t('resa.blockRemoveTitle')} message={aSupprimer ? t('resa.blockRemoveMsg', { date: libelleJour(aSupprimer.date, true, locale) }) : ''}
        confirmLabel={t('resa.blockRemove')} onCancel={() => setASupprimer(null)} onConfirm={() => { const id = aSupprimer.id; setASupprimer(null); supprimer(id); }} />
    </div>
  );
}
