import { useEffect, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from '../ConfirmDialog';
import { AREA_ICONS, areaLabel } from '../FloorPlan';
import { useLanguage } from '../../context/LanguageContext';
import ReservationMessageDialog from './ReservationMessageDialog';
import { ACOMPTE_LABEL, SOURCES, dateCourte, estClose, etatResa, euros, heureInput, heureLocale, isoDuJour, nomTable } from './resaUtils';

// Une ligne du cahier de réservation : l'essentiel replié (heure, nom, couverts, table, état), et
// déplié tout ce que la salle fait avec — changer l'état en un appui (confirmer, installer, terminer,
// absent…), écrire au client, déplacer, annoter, tenir la fiche client (allergie, habitué). Chaque
// action irréversible passe par ConfirmDialog.

const ETIQUETTES = ['habitue', 'allergie', 'vip', 'anniversaire', 'enfants', 'terrasse'];
const TAGS_ALERTE = ['allergie'];

export default function ReservationRow({ r, tables, ouverte, onToggle, token, toast, restoId, restaurant, onMaj, onRecharger, onPlacer }) {
  const { t } = useLanguage();
  const tablesResa = (r.tableIds && r.tableIds.length ? r.tableIds : (r.tableId ? [r.tableId] : [])).map((id) => tables.find((tb) => tb.id === id)).filter(Boolean);
  const [enCours, setEnCours] = useState(null);
  const [noteInterne, setNoteInterne] = useState(r.internalNote || '');
  const [message, setMessage] = useState('');
  const [garderAcompte, setGarderAcompte] = useState(false);
  const [deplacement, setDeplacement] = useState(false);
  const [heure, setHeure] = useState(heureInput(r.startAt));
  const [jour, setJour] = useState(isoDuJour(new Date(r.startAt)));
  const [duree, setDuree] = useState(r.durationMinutes);
  const [couverts, setCouverts] = useState(r.partySize);
  const [contact, setContact] = useState({ nom: r.reservationName || '', tel: r.clientPhone || '', email: r.clientEmail || '' });
  const [confirmation, setConfirmation] = useState(null);
  const [messagerie, setMessagerie] = useState(false);
  const [fiche, setFiche] = useState({ note: r.guestNote || '', tags: r.guestTags || [] });
  const [tagLibre, setTagLibre] = useState('');
  const [historique, setHistorique] = useState(null);
  useEffect(() => { setNoteInterne(r.internalNote || ''); }, [r.internalNote]);
  useEffect(() => { setFiche({ note: r.guestNote || '', tags: r.guestTags || [] }); }, [r.guestNote, r.guestTags]);
  useEffect(() => { setContact({ nom: r.reservationName || '', tel: r.clientPhone || '', email: r.clientEmail || '' }); }, [r.reservationName, r.clientPhone, r.clientEmail]);

  // Historique du client (venues, absences) chargé à l'ouverture de la ligne, une fois.
  useEffect(() => {
    if (!ouverte || historique !== null) return undefined;
    let annule = false;
    api(`/restaurants/${restoId}/reservations/${r.id}/history`, { token })
      .then((h) => { if (!annule) setHistorique(h); })
      .catch(() => { if (!annule) setHistorique({ key: null, visits: 0, noShows: 0, cancellations: 0, previous: [] }); });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte]);

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
  const demander = (cle, executer, options = {}) => setConfirmation({ cle, executer, ...options });

  async function enregistrerFiche() {
    const key = r.guestKey || contact.tel || contact.email;
    if (!key) { toast(t('resa.guestNoKey')); return; }
    setEnCours('fiche');
    try {
      const g = await api(`/restaurants/${restoId}/guests`, { method: 'PUT', token, body: { key, name: r.reservationName, note: fiche.note, tags: fiche.tags } });
      onMaj({ id: r.id, guestNote: g.note, guestTags: g.tags, guestKey: g.key });
      toast(t('resa.guestSaved'));
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  const basculerTag = (tag) => setFiche((f) => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter((x) => x !== tag) : [...f.tags, tag] }));
  const ajouterTagLibre = () => { const v = tagLibre.trim().toLowerCase().slice(0, 30); if (v && !fiche.tags.includes(v)) setFiche((f) => ({ ...f, tags: [...f.tags, v] })); setTagLibre(''); };
  const ficheModifiee = fiche.note !== (r.guestNote || '') || fiche.tags.join('|') !== (r.guestTags || []).join('|');
  const contactModifie = contact.nom !== (r.reservationName || '') || contact.tel !== (r.clientPhone || '') || contact.email !== (r.clientEmail || '');

  const etat = etatResa(r);
  const aVenir = !estClose(r);
  const acompteDetenu = r.depositAmount > 0 && r.depositStatus === 'paid';
  const alerte = (r.guestTags || []).some((x) => TAGS_ALERTE.includes(x));

  return (
    <div className={`resa-ligne${ouverte ? ' ouverte' : ''}`}>
      <button type="button" className="resa-ligne-tete" onClick={onToggle} aria-expanded={ouverte}>
        <div className="resa-ligne-heure">
          <b>{heureLocale(r.startAt)}</b>
          <span className="small">{heureLocale(r.startAt + r.durationMinutes * 60000)}</span>
        </div>
        <div className="resa-ligne-corps">
          <b>
            {r.reservationName}
            {(r.guestTags || []).length > 0 && (
              <span className="resa-tags">{(r.guestTags || []).slice(0, 3).map((x) => <span key={x} className={`resa-tag${TAGS_ALERTE.includes(x) ? ' alerte' : ''}`}>{ETIQUETTES.includes(x) ? t(`resa.tag_${x}`) : x}</span>)}</span>
            )}
          </b>
          <span className="small">
            {t('resa.nPeople', { n: r.partySize })}
            {tablesResa.length ? ` · ${tablesResa.map((tb) => `${nomTable(tb)} ${AREA_ICONS[tb.area] || ''}`).join(' + ')}` : t('resa.noTableAssigned')}
            {r.itemCount > 0 ? t('resa.dishesOrdered', { n: r.itemCount }) : ''}
            {r.depositAmount > 0 ? ` · 💳 ${euros(r.depositAmount)} ${ACOMPTE_LABEL[r.depositStatus] ? t(`resa.${ACOMPTE_LABEL[r.depositStatus]}`) : ''}` : ''}
            {r.note ? ' · 💬' : ''}{r.internalNote || r.guestNote ? ' · 📝' : ''}{r.messageCount > 0 ? ` · ✉️${r.messageCount}` : ''}{alerte ? ' · ⚠️' : ''}
          </span>
        </div>
        <span className={`resa-etat resa-etat-${etat}`}>{t(`resa.st_${etat}`)}</span>
      </button>

      {ouverte && (
        <div className="resa-detail">
          <div className="resa-detail-infos">
            <span className="pill">{t(`resa.${SOURCES[r.source] || 'srcClient'}`)}</span>
            {r.clientPhone && <a className="pill" href={`tel:${r.clientPhone}`}>📞 {r.clientPhone}</a>}
            {r.clientEmail && <a className="pill" href={`mailto:${r.clientEmail}`}>✉️ {r.clientEmail}</a>}
            {r.code && r.paid && <span className="pill">{t('resa.codeLabel', { code: r.code })}</span>}
            {r.zonePreference && <span className="pill">{t('resa.wantedZone', { zone: areaLabel(t, r.zonePreference) })}</span>}
            {r.reviewed && <span className="pill teal">{t('resa.reviewLeft')}</span>}
            {historique && (historique.visits > 0 || historique.noShows > 0 || historique.cancellations > 0) && (
              <span className="pill" title={t('resa.historyTitle')}>
                {t('resa.historyVisits', { n: historique.visits })}{historique.noShows > 0 ? ` · ${t('resa.historyNoShows', { n: historique.noShows })}` : ''}{historique.cancellations > 0 ? ` · ${t('resa.historyCancels', { n: historique.cancellations })}` : ''}
              </span>
            )}
            {historique && historique.visits === 0 && historique.noShows === 0 && historique.cancellations === 0 && r.source === 'client' && <span className="pill">{t('resa.firstVisit')}</span>}
          </div>
          {r.note && <p className="small resa-note-client">💬 <b>{t('resa.guestRequest')}</b> {r.note}</p>}
          {r.guestNote && <p className="small resa-note-client">📝 <b>{t('resa.guestCardNote')}</b> {r.guestNote}</p>}

          {/* Actions d'un appui, selon l'état. */}
          <div className="resa-rapides">
            {etat === 'a_confirmer' && (
              <>
                <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('accept', () => ordre('accept'))}>{enCours === 'accept' ? '…' : t('resa.confirm')}</button>
                <button type="button" className="btn-outline danger" disabled={!!enCours} onClick={() => demander('refuse', () => action('refuse', () => ordre('refuse')), { danger: true })}>{t('resa.refuse')}</button>
              </>
            )}
            {(etat === 'confirmee' || etat === 'table_prete') && (
              <>
                <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>{enCours === 'arrive' ? '…' : t('resa.btnSeated')}</button>
                {etat === 'confirmee' && <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => action('ready', () => ordre('ready'))}>{enCours === 'ready' ? '…' : t('resa.btnTableReady')}</button>}
                <button type="button" className="btn-outline danger" disabled={!!enCours} onClick={() => demander('no_show', () => action('no_show', () => ordre('arrival', { arrival: 'no_show' })), { danger: true, acompte: acompteDetenu })}>{t('resa.btnNoShow')}</button>
              </>
            )}
            {etat === 'installee' && (
              <>
                <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => action('termine', () => ordre('arrival', { arrival: 'termine' }))}>{enCours === 'termine' ? '…' : t('resa.btnFinish')}</button>
                <button type="button" className="btn-ghost" disabled={!!enCours} onClick={() => action('attendu', () => ordre('arrival', { arrival: 'attendu' }))}>{t('resa.undoCheckin')}</button>
              </>
            )}
            {etat === 'terminee' && r.arrival && (
              <button type="button" className="btn-ghost" disabled={!!enCours} onClick={() => action('attendu', () => ordre('arrival', { arrival: 'attendu' }))}>{t('resa.undoCheckin')}</button>
            )}
            {etat === 'terminee' && !r.arrival && (
              <>
                <button type="button" className="btn-outline ok" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'termine' }))}>{t('resa.wasPresent')}</button>
                <button type="button" className="btn-outline danger" disabled={!!enCours} onClick={() => demander('no_show', () => action('no_show', () => ordre('arrival', { arrival: 'no_show' })), { danger: true, acompte: acompteDetenu })}>{t('resa.absent')}</button>
              </>
            )}
            {etat === 'no_show' && (
              <button type="button" className="btn-outline ok" disabled={!!enCours} onClick={() => action('arrive', () => ordre('arrival', { arrival: 'arrive' }))}>{t('resa.btnFinallyHere')}</button>
            )}
            {(r.clientEmail || r.clientPhone || r.source === 'client') && etat !== 'refusee' && (
              <button type="button" className="btn-outline" onClick={() => setMessagerie(true)}>{t('resa.btnMessage')}</button>
            )}
            {aVenir && <button type="button" className="btn-ghost" onClick={() => setDeplacement((d) => !d)}>{t('resa.moveEdit')}</button>}
            {aVenir && !r.tableId && onPlacer && <button type="button" className="btn-outline" onClick={onPlacer}>{t('resa.placeOnPlan')}</button>}
          </div>

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
                    {tables.filter((tb) => tb.active).map((tb) => <option key={tb.id} value={tb.id}>{nomTable(tb)} ({t('resa.seatsShort', { n: tb.seats })}, {areaLabel(t, tb.area)})</option>)}
                  </select>
                </div>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
                <div style={{ flex: '1 1 140px' }}>
                  <label>{t('resa.name')}</label>
                  <input value={contact.nom} maxLength={80} onChange={(e) => setContact((c) => ({ ...c, nom: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label>{t('resa.phone')}</label>
                  <input type="tel" value={contact.tel} maxLength={30} onChange={(e) => setContact((c) => ({ ...c, tel: e.target.value }))} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label>{t('resa.emailOptional')}</label>
                  <input type="email" value={contact.email} maxLength={200} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
                </div>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn-teal" disabled={!!enCours || !contact.nom.trim()}
                  onClick={() => action('deplacer', () => champ({
                    startAt: new Date(`${jour}T${heure}:00`).toISOString(), durationMinutes: duree, partySize: Number(couverts),
                    ...(contactModifie ? { reservationName: contact.nom.trim(), clientPhone: contact.tel.trim(), clientEmail: contact.email.trim() } : {})
                  }))}>
                  {enCours === 'deplacer' ? '…' : t('resa.saveGuestNotified')}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setDeplacement(false)}>{t('resa.close')}</button>
              </div>
            </div>
          )}

          {/* Note interne : pour la salle, jamais montrée au client. */}
          <div style={{ marginTop: 10 }}>
            <label htmlFor={`note-${r.id}`}>{t('resa.internalNoteLabel')}</label>
            <textarea id={`note-${r.id}`} rows={2} value={noteInterne} placeholder={t('resa.phInternalNote')} onChange={(e) => setNoteInterne(e.target.value)} />
            {noteInterne !== (r.internalNote || '') && (
              <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 12px' }} disabled={!!enCours}
                onClick={() => action('note', () => champ({ internalNote: noteInterne }))}>{enCours === 'note' ? '…' : t('resa.saveNote')}</button>
            )}
          </div>

          {/* Fiche client : rattachée au téléphone ou à l'e-mail, elle revient sur chaque réservation. */}
          <div className="resa-fiche">
            <h4>
              {t('resa.guestCardTitle')}
              {historique && historique.previous.length > 0 && <span className="small" style={{ fontWeight: 400 }}>{t('resa.guestCardKnown', { n: historique.previous.length })}</span>}
            </h4>
            {historique === null && <p className="small" style={{ margin: 0 }}>{t('resa.loading')}</p>}
            {historique && historique.previous.length > 0 && (
              <div className="resa-historique">
                {historique.previous.slice(0, 5).map((p) => (
                  <span key={p.id} title={t(`resa.st_${etatResa({ status: p.status, arrival: p.arrival })}`)}>
                    {dateCourte(p.startAt)} · {p.partySize}p {p.arrival === 'no_show' ? '❌' : p.arrival === 'arrive' ? '✅' : p.status === 'annule' ? '🚫' : ''}
                  </span>
                ))}
              </div>
            )}
            <div className="resa-etiquettes">
              {ETIQUETTES.map((tag) => <button key={tag} type="button" className={fiche.tags.includes(tag) ? 'actif' : ''} onClick={() => basculerTag(tag)}>{t(`resa.tag_${tag}`)}</button>)}
              {fiche.tags.filter((x) => !ETIQUETTES.includes(x)).map((tag) => <button key={tag} type="button" className="actif" onClick={() => basculerTag(tag)}>{tag} ✕</button>)}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <input value={tagLibre} maxLength={30} placeholder={t('resa.tagCustomPh')} onChange={(e) => setTagLibre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajouterTagLibre(); } }} style={{ flex: 1 }} />
              <button type="button" className="btn-ghost" onClick={ajouterTagLibre} disabled={!tagLibre.trim()}>{t('resa.tagAdd')}</button>
            </div>
            <textarea rows={2} value={fiche.note} maxLength={1000} placeholder={t('resa.guestNotePh')} onChange={(e) => setFiche((f) => ({ ...f, note: e.target.value }))} style={{ marginTop: 6 }} />
            {ficheModifiee && (
              <button type="button" className="btn-outline" style={{ marginTop: 6, padding: '6px 12px' }} disabled={!!enCours} onClick={enregistrerFiche}>{enCours === 'fiche' ? '…' : t('resa.guestSave')}</button>
            )}
            {!r.guestKey && !r.clientPhone && !r.clientEmail && <p className="small" style={{ margin: '6px 0 0' }}>{t('resa.guestNoKey')}</p>}
          </div>

          {/* Acompte encore détenu par Fairide sur une réservation close : à trancher. */}
          {acompteDetenu && (etat === 'terminee' || etat === 'annulee' || etat === 'no_show') && (
            <div className="row" style={{ gap: 6, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="small">{t('resa.depositToDecide', { amount: euros(r.depositAmount) })}</span>
              <button type="button" className="btn-outline" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => demander('keep', () => action('keep', () => ordre('deposit', { action: 'keep' })))}>{t('resa.keepIt')}</button>
              <button type="button" className="btn-ghost" style={{ padding: '6px 12px' }} disabled={!!enCours} onClick={() => demander('refund', () => action('refund', () => ordre('deposit', { action: 'refund' })))}>{t('resa.refundIt')}</button>
            </div>
          )}

          {aVenir && etat !== 'a_confirmer' && (
            <details className="resa-annuler" style={{ marginTop: 10 }}>
              <summary className="small">{t('resa.cancelThis')}</summary>
              <input value={message} placeholder={t('resa.phCancelMessage')} onChange={(e) => setMessage(e.target.value)} style={{ marginTop: 6 }} />
              {acompteDetenu && (
                <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 6 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={garderAcompte} onChange={(e) => setGarderAcompte(e.target.checked)} />
                  <span className="small">{t('resa.keepDepositElseRefund', { amount: euros(r.depositAmount) })}</span>
                </label>
              )}
              <button type="button" className="btn-outline" style={{ marginTop: 6, color: 'var(--red)', borderColor: 'var(--red)' }} disabled={!!enCours}
                onClick={() => demander('annuler', () => action('annuler', () => ordre('cancel-reservation', { message, keepDeposit: garderAcompte })), { danger: true })}>
                {enCours === 'annuler' ? '…' : t('resa.confirmCancel')}
              </button>
            </details>
          )}
        </div>
      )}

      {confirmation && (
        <ConfirmDialog
          open
          danger={!!confirmation.danger}
          title={t(`resa.cfm_${confirmation.cle}_title`)}
          message={`${t(`resa.cfm_${confirmation.cle}_msg`, { name: r.reservationName, amount: euros(r.depositAmount) })}${confirmation.acompte ? ` ${t('resa.cfm_deposit_kept', { amount: euros(r.depositAmount) })}` : ''}`}
          confirmLabel={t(`resa.cfm_${confirmation.cle}_btn`)}
          loading={!!enCours}
          onCancel={() => setConfirmation(null)}
          onConfirm={async () => { const ex = confirmation.executer; setConfirmation(null); await ex(); }}
        />
      )}
      {messagerie && (
        <ReservationMessageDialog r={r} restoId={restoId} token={token} toast={toast} restaurant={restaurant}
          onClose={() => setMessagerie(false)} onSent={() => onMaj({ id: r.id, messageCount: (r.messageCount || 0) + 1 })} />
      )}
    </div>
  );
}
