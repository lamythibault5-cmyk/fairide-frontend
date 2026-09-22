import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, apiUpload } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import CrmMap, { distanceM } from '../../components/CrmMap';

import '../../crm.css';

// Page « Sales » des commerciaux : la personne à qui l'admin a donné l'accès (Admin › Sales) enregistre ici les
// commerces qu'elle démarche, et où ils en sont — étape, visites, appels, notes datées, avis du restaurateur,
// prochaine action — et suit sa rémunération (20 € inscription, 40 € premier mois payé, 50 € fidélité à 7 mois) et
// l'équipe (les autres commerciaux par leur PRÉNOM seulement, avec leurs inscrits et leurs gains). Un compte client
// sans cet accès n'a pas cette page (le serveur répond 403 NOT_SALES_AGENT, et Mon compte n'affiche pas le lien).
// Serveur : routes/adminSales.js (/sales/…).

const STAGES = ['a_contacter', 'contacte', 'interesse', 'rdv', 'inscrit', 'carte_en_ligne', 'actif', 'plus_tard', 'refuse'];
const KINDS = ['visite', 'appel', 'message', 'note'];
const STAGE_ICONES = { a_contacter: '📋', contacte: '📞', interesse: '💡', rdv: '📅', inscrit: '✍️', carte_en_ligne: '🍽️', actif: '✅', plus_tard: '⏳', refuse: '✖️' };
const KIND_ICONES = { visite: '🚶', appel: '📞', message: '💬', note: '📝', etape: '🔀' };

const vide = { name: '', address: '', commune: '', phone: '', contactName: '', email: '', cuisine: '', stage: 'a_contacter', notes: '', firstNote: '' };
// Position du téléphone (bouton « je suis devant le commerce »). Promesse → { lat, lng } ou erreur.
function maPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('geo')); return; }
    navigator.geolocation.getCurrentPosition((pos) => resolve({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }), () => reject(new Error('geo')), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  });
}
// <input type="datetime-local"> attend l'heure locale sans fuseau.
const versLocal = (ms) => { if (!ms) return ''; const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const maintenantLocal = () => versLocal(Date.now());

export default function SalesPage() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const locale = getLocale();
  const [etat, setEtat] = useState(null); // { agent, stats } ; agent: false = accès non donné par l'admin
  const [prospects, setProspects] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState(null); // id du prospect ouvert
  const [creation, setCreation] = useState(false);
  const [photo, setPhoto] = useState(false); // volet « Photo du commerce » (reconnaissance)
  // Vue : mes commerces, les zones (à faire, à moi, prises par d'autres — fondateur, 21/09 : « pas besoin des noms des
  // commerces des autres, plutôt les zones »), ou ce qu'il me reste à faire (prochaines actions du jour et en retard).
  const [vue, setVue] = useState('mine');
  // Carte : zones proposées (avec compteurs), commerces des autres commerciaux, zone choisie, carte repliée ou non.
  const [zones, setZones] = useState([]);
  const [autres, setAutres] = useState([]);
  const [zoneActive, setZoneActive] = useState(null);
  // Équipe (prénoms, inscrits, gains) et mes primes.
  const [equipe, setEquipe] = useState([]);
  const [primes, setPrimes] = useState(null);
  const [carteVisible, setCarteVisible] = useState(() => { try { return localStorage.getItem('crm_carte') !== 'off'; } catch { return true; } });
  const basculerCarte = () => setCarteVisible((v) => { try { localStorage.setItem('crm_carte', v ? 'off' : 'on'); } catch { /* sans stockage */ } return !v; });

  const charger = useCallback(() => {
    api('/sales/me', { token }).then(setEtat).catch((e) => toast(e.message, 'erreur'));
    const params = new URLSearchParams(); if (filtre) params.set('stage', filtre); if (recherche.trim()) params.set('q', recherche.trim());
    api(`/sales/prospects?${params.toString()}`, { token }).then((r) => setProspects(r.prospects)).catch((e) => { if (e.code === 'NOT_SALES_AGENT') setEtat({ agent: false }); else toast(e.message, 'erreur'); });
    api('/sales/zones', { token }).then(setZones).catch(() => {});
    api('/sales/map', { token }).then(setAutres).catch(() => {}); // points gris des autres, sans nom de commerce
    api('/sales/team', { token }).then(setEquipe).catch(() => {});
    api('/sales/commissions', { token }).then((r) => setPrimes(r.commissions)).catch(() => {});
  }, [token, filtre, recherche, toast]);
  useEffect(() => { charger(); }, [charger]);
  // Zone choisie : la liste ne montre que les commerces dans son rayon (ceux sans position restent visibles, on ne sait pas où ils sont).
  const zone = zones.find((z) => z.key === zoneActive) || null;
  const prospectsAffiches = useMemo(() => {
    if (!prospects || !zone) return prospects;
    return prospects.filter((p) => p.lat === null || p.lat === undefined || distanceM(zone.lat, zone.lng, p.lat, p.lng) <= zone.radius);
  }, [prospects, zone]);
  const sansPosition = (prospects || []).filter((p) => p.lat === null || p.lat === undefined).length;
  // À faire : prochaine action dépassée ou prévue aujourd'hui, hors commerces actifs ou refusés. En retard d'abord.
  const finJournee = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }, []);
  const aFaire = useMemo(() => (prospects || []).filter((p) => p.nextActionAt && p.nextActionAt <= finJournee && !['actif', 'refuse'].includes(p.stage)).sort((a, b) => a.nextActionAt - b.nextActionAt), [prospects, finJournee]);
  // Zones : je prends / je laisse (une zone = un commercial ; le serveur refuse une zone déjà prise, avec le prénom).
  const [zoneBusy, setZoneBusy] = useState(false);
  async function prendreZone(key) {
    setZoneBusy(true);
    try { await api(`/sales/zones/${key}/claim`, { method: 'POST', token }); toast(t('sales.toastZoneTaken')); charger(); } catch (e) { toast(e.message, 'erreur'); } finally { setZoneBusy(false); }
  }
  async function laisserZone(key) {
    setZoneBusy(true);
    try { await api(`/sales/zones/${key}/claim`, { method: 'DELETE', token }); toast(t('sales.toastZoneLeft')); charger(); } catch (e) { toast(e.message, 'erreur'); } finally { setZoneBusy(false); }
  }
  // Export CSV de mes commerces (Excel/Numbers l'ouvrent tel quel ; BOM pour les accents).
  function exporterCsv() {
    const col = ['name', 'commune', 'address', 'contactName', 'phone', 'email', 'cuisine', 'stage', 'rating', 'nextActionAt', 'lastEventAt', 'feedback', 'notes'];
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lignes = [col.join(';'), ...(prospects || []).map((p) => col.map((c) => cell(c === 'stage' ? t(`sales.stage_${p[c]}`) : /At$/.test(c) && p[c] ? new Date(p[c]).toLocaleString(locale) : p[c])).join(';'))];
    const blob = new Blob(['\ufeff' + lignes.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fairide-sales-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  const fmtDate = (ms) => new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtJour = (ms) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const euros = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const stageLabel = (s) => `${STAGE_ICONES[s] || ''} ${t(`sales.stage_${s}`)}`;

  if (etat && !etat.agent) {
    return (
      <div>
        <h1 className="section-title" style={{ marginTop: 0 }}>{t('sales.title')}</h1>
        <div className="card"><p className="small" style={{ margin: 0 }}>{t('sales.notAgent')}</p></div>
      </div>
    );
  }

  return (
    <div className="crm-page">
      <div className="crm-entete">
        <div>
          <h1 className="section-title" style={{ margin: 0 }}>{t('sales.title')}</h1>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.intro')}</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-ghost" style={{ fontSize: 13 }} onClick={exporterCsv} disabled={!prospects?.length}>⬇️ {t('sales.exportCsv')}</button>
          <button type="button" className="btn-gold" onClick={() => setPhoto(true)}>📷 {t('sales.photoButton')}</button>
          <button type="button" className="btn-outline" onClick={() => setCreation(true)}>+ {t('sales.addProspect')}</button>
        </div>
      </div>

      {/* Aujourd'hui : ce qui presse, tout en haut — en retard d'abord, puis ce qui est prévu ce jour. */}
      {aFaire.length > 0 && (
        <div className="card crm-aujourdhui">
          <b>⏰ {t('sales.todayTitle', { n: aFaire.length })}</b>
          <ul className="crm-aujourdhui-liste">
            {aFaire.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button type="button" className="crm-aujourdhui-item" onClick={() => setOuvert(p.id)}>
                  <span className={p.nextActionAt < Date.now() ? 'crm-retard-texte' : ''}>{p.nextActionAt < Date.now() ? t('sales.todoOverdue') : t('sales.todoToday')} · {fmtDate(p.nextActionAt)}</span>
                  <b>{p.name}</b>{p.commune ? <span className="small"> · {p.commune}</span> : null}
                  <span className={`crm-badge crm-badge-${p.stage}`}>{stageLabel(p.stage)}</span>
                </button>
              </li>
            ))}
          </ul>
          {aFaire.length > 6 && <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: '4px 0' }} onClick={() => setVue('todo')}>{t('sales.todoMore', { n: aFaire.length - 6 })}</button>}
        </div>
      )}

      {/* Carte : mes commerces, ceux des autres, et les zones où aller. Repliable (mémorisé) pour garder la liste sous la main. */}
      <div className="card crm-carte-carte">
        <div className="crm-carte-tete">
          <div>
            <b>{t('sales.mapTitle')}</b>
            <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.mapIntro')}</p>
          </div>
          <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }} onClick={basculerCarte}>{carteVisible ? t('sales.mapHide') : t('sales.mapShow')}</button>
        </div>
        {carteVisible && (
          <>
            <CrmMap prospects={prospects || []} autres={autres} zones={zones} zoneActive={zoneActive} ouvert={ouvert} stageIcones={STAGE_ICONES} onOpen={setOuvert} onZone={setZoneActive} />
            {sansPosition > 0 && <p className="small" style={{ margin: '8px 0 0' }}>{t('sales.noPosition', { n: sansPosition })}</p>}
            <div className="crm-zones">
              <b className="crm-bloc-titre" style={{ marginTop: 10 }}>{t('sales.zonesTitle')}</b>
              <p className="small" style={{ margin: '0 0 8px' }}>{t('sales.zonesIntro')}</p>
              <div className="role-pick crm-filtres">
                <button type="button" className={`chip${zoneActive === null ? ' active' : ''}`} onClick={() => setZoneActive(null)}>{t('sales.zoneAll')}</button>
                {zones.map((z) => (
                  <button type="button" key={z.key} className={`chip crm-zone-chip${zoneActive === z.key ? ' active' : ''}`} onClick={() => setZoneActive(zoneActive === z.key ? null : z.key)} title={`${z.commune} · ${t(`sales.zoneTag_${z.tag}`)}`}>
                    🎯 {z.name}{z.status !== 'todo' ? <span className={`crm-zone-qui${z.claimedByMe ? ' crm-zone-moi' : ''}`}>{z.claimedByMe ? t('sales.teamMe') : t('sales.zoneTakenShort')}</span> : null}{z.mine ? <span className="crm-zone-n">{z.mine}</span> : null}{z.others ? <span className="crm-zone-n crm-zone-n-autres">{z.others}</span> : null}
                  </button>
                ))}
              </div>
              {zone && <p className="small" style={{ margin: '8px 0 0' }}>🎯 <b>{zone.name}</b> · {zone.commune} · {t(`sales.zoneTag_${zone.tag}`)} · {t('sales.zoneMine', { n: zone.mine })} · {t('sales.zoneOthers', { n: zone.others })}</p>}
            </div>
          </>
        )}
      </div>

      {etat?.stats && (
        <div className="stat-grid crm-stats">
          <div className="stat-card"><div className="num">{etat.stats.total}</div><div className="label">{t('sales.statTotal')}</div></div>
          <div className="stat-card"><div className="num">{(etat.stats.byStage.inscrit || 0) + (etat.stats.byStage.carte_en_ligne || 0) + (etat.stats.byStage.actif || 0)}</div><div className="label">{t('sales.statSigned')}</div></div>
          <div className="stat-card highlight"><div className="num">{etat.stats.byStage.actif || 0}</div><div className="label">{t('sales.statActive')}</div></div>
          <div className={`stat-card${etat.stats.overdue > 0 ? ' crm-retard' : ''}`}><div className="num">{etat.stats.overdue}</div><div className="label">{t('sales.statOverdue')}</div></div>
          <div className="stat-card"><div className="num">{etat.stats.addedThisWeek ?? 0}</div><div className="label">{t('sales.weekAdded')}</div></div>
          <div className="stat-card"><div className="num">{etat.stats.eventsThisWeek ?? 0}</div><div className="label">{t('sales.weekActions')}</div></div>
        </div>
      )}

      {/* Démarchage : le flyer à toujours avoir sur soi, le pitch, les techniques, la posture Fairide, et quoi faire quand c'est non. */}
      <GuideCard t={t} />

      {/* Rémunération (barème + mes primes) et l'équipe (prénoms, inscrits, gains) : ce qui motive. */}
      <RemunerationCard etat={etat} primes={primes} t={t} euros={euros} fmtDate={fmtJour} />
      <EquipeCard equipe={equipe} t={t} euros={euros} />

      {/* Trois vues : mes commerces, ceux des autres (pour ne pas frapper deux fois à la même porte), à faire. */}
      <div className="role-pick crm-segments" role="tablist" aria-label={t('sales.title')}>
        <button type="button" role="tab" aria-selected={vue === 'mine'} className={`chip${vue === 'mine' ? ' active' : ''}`} onClick={() => setVue('mine')}>{t('sales.viewMine')}{prospects ? ` · ${prospects.length}` : ''}</button>
        <button type="button" role="tab" aria-selected={vue === 'zones'} className={`chip${vue === 'zones' ? ' active' : ''}`} onClick={() => setVue('zones')}>{t('sales.viewZones')}{zones.length ? ` · ${zones.filter((z) => z.status === 'todo').length} ${t('sales.viewZonesTodo')}` : ''}</button>
        <button type="button" role="tab" aria-selected={vue === 'todo'} className={`chip${vue === 'todo' ? ' active' : ''}${aFaire.length ? ' crm-segment-alerte' : ''}`} onClick={() => setVue('todo')}>{t('sales.viewTodo')}{aFaire.length ? ` · ${aFaire.length}` : ''}</button>
      </div>
      {vue === 'zones' && <ZonesView zones={zones} t={t} busy={zoneBusy} onFocus={(k) => { setZoneActive(k); setCarteVisible(true); document.querySelector('.crm-carte-carte')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }} onClaim={prendreZone} onRelease={laisserZone} />}

      {vue !== 'zones' && (
      <div className="admin-control-panel">
        <div className="field" style={{ margin: 0, flex: '1 1 200px' }}>
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('sales.searchPlaceholder')} aria-label={t('sales.searchPlaceholder')} />
        </div>
        <div className="role-pick crm-filtres" role="group" aria-label={t('sales.filterStage')}>
          <button type="button" className={`chip${filtre === '' ? ' active' : ''}`} onClick={() => setFiltre('')}>{t('sales.allStages')}</button>
          {STAGES.map((s) => <button key={s} type="button" className={`chip${filtre === s ? ' active' : ''}`} onClick={() => setFiltre(s)}>{stageLabel(s)}{etat?.stats?.byStage?.[s] ? ` · ${etat.stats.byStage[s]}` : ''}</button>)}
        </div>
      </div>
      )}

      {vue !== 'zones' && prospects === null && <div className="small">{t('common.loading')}</div>}
      {vue === 'mine' && prospectsAffiches && prospectsAffiches.length === 0 && (
        <div className="card"><p className="small" style={{ margin: 0 }}>{filtre || recherche || zone ? t('sales.noneFiltered') : t('sales.noneYet')}</p></div>
      )}
      {vue === 'todo' && aFaire.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{t('sales.todayEmpty')}</p></div>}
      <div className="crm-liste">
        {(vue === 'todo' ? aFaire : vue === 'mine' ? (prospectsAffiches || []) : []).map((p) => (
          <button type="button" key={p.id} className={`card crm-carte crm-etape-${p.stage}${p.photoUrl ? ' crm-carte-photo' : ''}`} onClick={() => setOuvert(p.id)}>
            {p.photoUrl && <img className="crm-vignette" src={p.photoUrl} alt="" loading="lazy" />}
            <div className="crm-carte-tete">
              <b>{p.name}</b>
              <span className={`crm-badge crm-badge-${p.stage}`}>{stageLabel(p.stage)}</span>
            </div>
            <div className="small crm-carte-ligne">
              {p.commune && <span>📍 {p.commune}</span>}
              {p.contactName && <span>👤 {p.contactName}</span>}
              {p.rating && <span>{'★'.repeat(p.rating)}{'☆'.repeat(5 - p.rating)}</span>}
            </div>
            <div className="small crm-carte-ligne">
              {p.lastEventAt && <span>{t('sales.lastActivity', { date: fmtDate(p.lastEventAt) })}</span>}
              {p.nextActionAt && <span className={p.nextActionAt < Date.now() && !['actif', 'refuse'].includes(p.stage) ? 'crm-retard-texte' : ''}>⏰ {t('sales.nextAction', { date: fmtDate(p.nextActionAt) })}</span>}
              {p.restaurantName && <span>🏪 {t('sales.linkedTo', { name: p.restaurantName })}</span>}
            </div>
          </button>
        ))}
      </div>

      {photo && <PhotoProspect token={token} t={t} toast={toast} zones={zones} onClose={() => setPhoto(false)} onSaved={(p) => { setPhoto(false); charger(); setOuvert(p.id); }} />}
      {creation && <ProspectForm token={token} t={t} toast={toast} onClose={() => setCreation(false)} onSaved={(p) => { setCreation(false); charger(); setOuvert(p.id); }} />}
      {ouvert && <ProspectDetail id={ouvert} token={token} t={t} toast={toast} locale={locale} stageLabel={stageLabel} onClose={() => { setOuvert(null); charger(); }} onDeleted={() => { setOuvert(null); charger(); }} />}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- photo
// « Photo du commerce » (fondateur, 2026-09-22) : le commercial prend la devanture en photo ; le serveur lit la position
// de la photo (sinon celle du téléphone), propose les commerces OpenStreetMap autour, l'adresse et la zone ; le
// commercial choisit le bon, corrige si besoin, et valide → fiche créée « contacté », photo gardée. Plus rien à taper.
function PhotoProspect({ token, t, toast, zones, onClose, onSaved }) {
  const inputRef = useRef(null);
  const [fichier, setFichier] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [etape, setEtape] = useState('choisir'); // choisir | analyse | verifier
  const [reco, setReco] = useState(null);
  const [choix, setChoix] = useState(null); // index du candidat, ou 'autre'
  const [f, setF] = useState({ name: '', address: '', commune: '', cuisine: '', stage: 'contacte', firstNote: '' });
  const [envoi, setEnvoi] = useState(false);
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu); }, [apercu]);

  async function analyser(fich) {
    setFichier(fich); setApercu(URL.createObjectURL(fich)); setEtape('analyse');
    // Position du téléphone en parallèle : utile si la photo n'a pas de GPS (WhatsApp, capture d'écran…).
    let pos = null; try { pos = await maPosition(); } catch { /* sans position */ }
    try {
      const r = await apiUpload('/sales/photo', { file: fich, token, fieldName: 'photo', fields: pos ? { lat: pos.lat, lng: pos.lng } : undefined });
      setReco(r);
      const premier = r.candidates?.[0];
      setChoix(premier ? 0 : 'autre');
      setF((s) => ({ ...s, name: premier?.name || '', address: r.address || '', commune: r.commune || r.zone?.commune || '', cuisine: premier?.cuisine || '' }));
      setEtape('verifier');
    } catch (e) { toast(e.message); setEtape('choisir'); }
  }
  function choisir(i) {
    setChoix(i);
    if (i === 'autre') { setF((s) => ({ ...s, name: '', cuisine: '' })); return; }
    const c = reco.candidates[i]; setF((s) => ({ ...s, name: c.name, cuisine: c.cuisine || s.cuisine }));
  }
  async function valider(e) {
    e.preventDefault();
    if (!f.name.trim()) { toast(t('sales.errName')); return; }
    setEnvoi(true);
    try {
      const c = choix !== 'autre' && reco?.candidates?.[choix];
      const position = c && c.lat !== null && c.lat !== undefined ? { lat: c.lat, lng: c.lng } : reco?.position ? { lat: reco.position.lat, lng: reco.position.lng } : {};
      const p = await api('/sales/prospects', { method: 'POST', token, body: { ...f, ...position, photoUrl: reco?.photoUrl || undefined } });
      toast(t('sales.photoSaved')); onSaved(p);
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }
  const zone = reco?.zone; const zoneEtat = zone && zones.find((z) => z.key === zone.key);
  return createPortal(
    <div className="modal-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label={t('sales.photoTitle')} onClick={onClose}>
      <form className="modal-box drawer-box crm-form" onClick={(e) => e.stopPropagation()} onSubmit={valider} noValidate>
        <h3 className="modal-titre">📷 {t('sales.photoTitle')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t('sales.photoIntro')}</p>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => { const x = e.target.files?.[0]; if (x) analyser(x); e.target.value = ''; }} />
        {etape === 'choisir' && (
          <div className="crm-photo-choix">
            <button type="button" className="btn-gold" onClick={() => inputRef.current?.click()}>📷 {t('sales.photoTake')}</button>
            <p className="small" style={{ margin: '8px 0 0' }}>{t('sales.photoHint')}</p>
          </div>
        )}
        {etape === 'analyse' && (
          <div className="crm-photo-analyse">
            {apercu && <img src={apercu} alt="" className="crm-photo-apercu" />}
            <p className="small">⏳ {t('sales.photoAnalysing')}</p>
          </div>
        )}
        {etape === 'verifier' && reco && (
          <>
            <div className="crm-photo-entete">
              {apercu && <img src={apercu} alt="" className="crm-photo-apercu" />}
              <div className="small">
                <p style={{ margin: 0 }}>📍 {reco.position ? (reco.position.source === 'photo' ? t('sales.photoPosPhoto') : t('sales.photoPosDevice')) : t('sales.photoPosNone')}</p>
                {zone && <p style={{ margin: '4px 0 0' }}>🎯 {t('sales.photoZone', { zone: zone.name, commune: zone.commune })}{zoneEtat?.status === 'taken' ? ` · ${t('sales.zoneTakenOther')}` : zoneEtat?.status === 'mine' ? ` · ${t('sales.zoneMineGroup')}` : ''}</p>}
                {(reco.address || reco.commune) && <p style={{ margin: '4px 0 0' }}>🏠 {[reco.address, reco.postalCode, reco.commune].filter(Boolean).join(', ')}</p>}
                <button type="button" className="btn-ghost" style={{ padding: '2px 0', fontSize: 12 }} onClick={() => inputRef.current?.click()}>{t('sales.photoRetake')}</button>
              </div>
            </div>
            {reco.already?.length > 0 && (
              <div className="crm-doublons" role="status">
                {reco.already.map((d) => <p key={d.id}>⚠️ {d.mine ? t('sales.photoAlreadyMine', { name: d.name, stage: t(`sales.stage_${d.stage}`) }) : t('sales.photoAlreadyOther', { name: d.name })}</p>)}
              </div>
            )}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.photoWhich')}</b>
              {reco.candidates.length === 0 && <p className="small" style={{ margin: '0 0 6px' }}>{reco.position ? t('sales.photoNoCandidate') : t('sales.photoNoPosition')}</p>}
              <div className="crm-photo-candidats" role="radiogroup" aria-label={t('sales.photoWhich')}>
                {reco.candidates.map((c, i) => (
                  <button type="button" key={i} role="radio" aria-checked={choix === i} className={`crm-photo-candidat${choix === i ? ' actif' : ''}`} onClick={() => choisir(i)}>
                    <b>{c.name}</b><span className="small">{[c.cuisine, c.type, c.distanceM !== null && c.distanceM !== undefined ? t('sales.photoDistance', { m: c.distanceM }) : null].filter(Boolean).join(' · ')}</span>
                  </button>
                ))}
                <button type="button" role="radio" aria-checked={choix === 'autre'} className={`crm-photo-candidat${choix === 'autre' ? ' actif' : ''}`} onClick={() => choisir('autre')}><b>{t('sales.photoOther')}</b></button>
              </div>
            </div>
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.photoCheck')}</b>
              <div className="field"><label htmlFor="ph-nom">{t('sales.fName')} *</label><input id="ph-nom" value={f.name} onChange={champ('name')} /></div>
              <div className="row" style={{ gap: 8 }}>
                <div className="field" style={{ flex: 2 }}><label htmlFor="ph-adresse">{t('sales.fAddress')}</label><input id="ph-adresse" value={f.address} onChange={champ('address')} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ph-commune">{t('sales.fCommune')}</label><input id="ph-commune" value={f.commune} onChange={champ('commune')} /></div>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ph-cuisine">{t('sales.fCuisine')}</label><input id="ph-cuisine" value={f.cuisine} onChange={champ('cuisine')} /></div>
                <div className="field" style={{ flex: 1 }}><label htmlFor="ph-etape">{t('sales.fStage')}</label>
                  <select id="ph-etape" value={f.stage} onChange={champ('stage')}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_ICONES[s]} {t(`sales.stage_${s}`)}</option>)}</select>
                </div>
              </div>
              <div className="field"><label htmlFor="ph-note">{t('sales.fFirstNote')}</label><textarea id="ph-note" rows={2} value={f.firstNote} onChange={champ('firstNote')} placeholder={t('sales.fFirstNotePh')} /></div>
            </div>
          </>
        )}
        <div className="modal-pied crm-pied">
          {etape === 'verifier' && <button type="submit" className="btn-teal" disabled={envoi || !fichier}>{envoi ? '…' : t('sales.photoValidate')}</button>}
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------------------------------- création
function ProspectForm({ token, t, toast, onClose, onSaved }) {
  const [f, setF] = useState(vide);
  // Doublons : dès trois lettres, on cherche le nom dans ma liste, chez les autres commerciaux et parmi les commerces
  // inscrits sur Fairide. On prévient, on ne bloque pas — deux « Chez Momo » peuvent exister dans deux communes.
  const [doublons, setDoublons] = useState(null);
  useEffect(() => {
    const nom = f.name.trim();
    if (nom.length < 3) { setDoublons(null); return undefined; }
    const id = setTimeout(() => { api(`/sales/lookup?q=${encodeURIComponent(nom)}`, { token }).then(setDoublons).catch(() => setDoublons(null)); }, 350);
    return () => clearTimeout(id);
  }, [f.name, token]);
  const aDesDoublons = doublons && (doublons.mine.length || doublons.others.length || doublons.restaurants.length);
  const [envoi, setEnvoi] = useState(false);
  const [position, setPosition] = useState(null); // { lat, lng } posé avec « je suis devant »
  const [geoEnCours, setGeoEnCours] = useState(false);
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function prendrePosition() {
    setGeoEnCours(true);
    try { setPosition(await maPosition()); toast(t('sales.positionSet')); } catch { toast(t('sales.positionError'), 'erreur'); } finally { setGeoEnCours(false); }
  }
  async function enregistrer(e) {
    e.preventDefault();
    if (!f.name.trim()) { toast(t('sales.errName'), 'erreur'); return; }
    setEnvoi(true);
    try { onSaved(await api('/sales/prospects', { method: 'POST', token, body: position ? { ...f, ...position } : f })); toast(t('sales.toastCreated')); } catch (err) { toast(err.message, 'erreur'); } finally { setEnvoi(false); }
  }
  // Portail : la page connectée anime son contenu (page-fade), ce qui crée un contexte d'empilement — rendu dans
  // la page, le volet passait SOUS la barre de navigation du bas. Même remède que ConfirmDialog.
  return createPortal(
    <div className="modal-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label={t('sales.addProspect')} onClick={onClose}>
      <form className="modal-box drawer-box crm-form" onClick={(e) => e.stopPropagation()} onSubmit={enregistrer} noValidate>
        <h3 className="modal-titre">{t('sales.addProspect')}</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>{t('sales.formHint')}</p>
        <div className="field"><label htmlFor="crm-nom">{t('sales.fName')} *</label><input id="crm-nom" value={f.name} onChange={champ('name')} autoFocus /></div>
        {aDesDoublons ? (
          <div className="crm-doublons" role="status">
            {doublons.mine.map((d) => <p key={`m${d.id}`}>⚠️ {t('sales.dupMine', { name: d.name, stage: t(`sales.stage_${d.stage}`) })}</p>)}
            {doublons.others.map((d) => <p key={`o${d.id}`}>🧑‍💼 {t('sales.dupOthers', { name: d.name, stage: t(`sales.stage_${d.stage}`) })}</p>)}
            {doublons.restaurants.map((d) => <p key={`r${d.id}`}>🏪 {t('sales.dupRestaurant', { name: d.name, commune: d.commune || '' })}</p>)}
          </div>
        ) : null}
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 2 }}><label htmlFor="crm-adresse">{t('sales.fAddress')}</label><input id="crm-adresse" value={f.address} onChange={champ('address')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-commune">{t('sales.fCommune')}</label><input id="crm-commune" value={f.commune} onChange={champ('commune')} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-contact">{t('sales.fContact')}</label><input id="crm-contact" value={f.contactName} onChange={champ('contactName')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-tel">{t('sales.fPhone')}</label><input id="crm-tel" type="tel" value={f.phone} onChange={champ('phone')} /></div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-email">{t('sales.fEmail')}</label><input id="crm-email" type="email" value={f.email} onChange={champ('email')} /></div>
          <div className="field" style={{ flex: 1 }}><label htmlFor="crm-cuisine">{t('sales.fCuisine')}</label><input id="crm-cuisine" value={f.cuisine} onChange={champ('cuisine')} /></div>
        </div>
        <div className="field"><label htmlFor="crm-etape">{t('sales.fStage')}</label>
          <select id="crm-etape" value={f.stage} onChange={champ('stage')}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_ICONES[s]} {t(`sales.stage_${s}`)}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="crm-note1">{t('sales.fFirstNote')}</label><textarea id="crm-note1" rows={3} value={f.firstNote} onChange={champ('firstNote')} placeholder={t('sales.fFirstNotePh')} /></div>
        {/* Position : devant le commerce, un appui suffit ; sinon l'adresse est géocodée par le serveur. */}
        <div className="crm-position">
          <button type="button" className="btn-outline" style={{ fontSize: 13 }} disabled={geoEnCours} onClick={prendrePosition}>{geoEnCours ? '…' : `📍 ${t('sales.useMyPosition')}`}</button>
          <span className="small">{position ? t('sales.positionOk') : t('sales.positionHint')}</span>
        </div>
        <div className="modal-pied crm-pied">
          <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('common.save')}</button>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------------------------------- fiche
function ProspectDetail({ id, token, t, toast, locale, stageLabel, onClose, onDeleted }) {
  const [p, setP] = useState(null);
  const [edition, setEdition] = useState(null);
  const [ev, setEv] = useState({ kind: 'visite', at: maintenantLocal(), stage: '', note: '' });
  const [envoi, setEnvoi] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [lien, setLien] = useState({ q: '', resultats: [] });
  const charger = useCallback(() => api(`/sales/prospects/${id}`, { token }).then(setP).catch((e) => toast(e.message, 'erreur')), [id, token, toast]);
  useEffect(() => { charger(); }, [charger]);
  const fmt = (ms) => new Date(ms).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  async function patch(body, message) {
    setEnvoi(true);
    try { const r = await api(`/sales/prospects/${id}`, { method: 'PATCH', token, body }); setP((s) => ({ ...s, ...r })); if (message) toast(message); await charger(); } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(false); }
  }
  async function ajouterEvenement(e) {
    e.preventDefault();
    if (!ev.note.trim() && ev.kind === 'note') { toast(t('sales.errNote'), 'erreur'); return; }
    setEnvoi(true);
    try {
      await api(`/sales/prospects/${id}/events`, { method: 'POST', token, body: { kind: ev.kind, at: new Date(ev.at).toISOString(), stage: ev.stage || null, note: ev.note } });
      setEv({ kind: 'visite', at: maintenantLocal(), stage: '', note: '' }); toast(t('sales.toastEvent')); await charger();
    } catch (err) { toast(err.message, 'erreur'); } finally { setEnvoi(false); }
  }
  async function supprimerEvenement(eid) {
    try { await api(`/sales/prospects/${id}/events/${eid}`, { method: 'DELETE', token }); await charger(); } catch (e) { toast(e.message, 'erreur'); }
  }
  async function chercherResto(q) {
    setLien((s) => ({ ...s, q }));
    if (q.trim().length < 2) { setLien((s) => ({ ...s, resultats: [] })); return; }
    try { setLien((s) => ({ ...s, resultats: [] })); const r = await api(`/sales/restaurant-lookup?q=${encodeURIComponent(q.trim())}`, { token }); setLien((s) => (s.q === q ? { ...s, resultats: r } : s)); } catch { /* recherche silencieuse */ }
  }

  const evenements = useMemo(() => p?.events || [], [p]);
  async function poserPosition() {
    try { await patch(await maPosition(), t('sales.positionSet')); } catch (e) { if (e?.message === 'geo') toast(t('sales.positionError'), 'erreur'); }
  }
  return createPortal(
    <div className="modal-overlay drawer-overlay" role="dialog" aria-modal="true" aria-label={p?.name || ''} onClick={onClose}>
      <div className="modal-box drawer-box crm-fiche" onClick={(e) => e.stopPropagation()}>
        {!p ? <div className="small">{t('common.loading')}</div> : (
          <>
            {p.photoUrl && <a href={p.photoUrl} target="_blank" rel="noreferrer"><img className="crm-fiche-photo" src={p.photoUrl} alt={p.name} /></a>}
            <div className="crm-fiche-tete">
              <div>
                <h3 className="modal-titre" style={{ margin: 0 }}>{p.name}</h3>
                <p className="small" style={{ margin: '2px 0 0' }}>{[p.address, p.commune].filter(Boolean).join(', ')}{p.cuisine ? ` · ${p.cuisine}` : ''}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={onClose} aria-label={t('common.close')}>✕</button>
            </div>

            {/* Étape : un chip par étape, un appui la change (le serveur trace l'événement). */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.fStage')}</b>
              <div className="role-pick crm-etapes">
                {STAGES.map((s) => <button key={s} type="button" disabled={envoi} className={`chip${p.stage === s ? ' active' : ''}`} onClick={() => p.stage !== s && patch({ stage: s }, t('sales.toastStage'))}>{stageLabel(s)}</button>)}
              </div>
            </div>

            <div className="crm-bloc crm-deux-colonnes">
              <div>
                <b className="crm-bloc-titre">{t('sales.contactTitle')}</b>
                <p className="small" style={{ margin: 0 }}>
                  {p.contactName && <>👤 {p.contactName}<br /></>}
                  {p.phone && <>📞 <a href={`tel:${p.phone}`}>{p.phone}</a><br /></>}
                  {p.email && <>✉️ <a href={`mailto:${p.email}`}>{p.email}</a><br /></>}
                  {(p.address || p.lat !== null) && <>🧭 <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.lat !== null && p.lat !== undefined ? `${p.lat},${p.lng}` : `${p.address} ${p.commune || ''} Bruxelles`)}`} target="_blank" rel="noopener noreferrer">{t('sales.route')}</a></>}
                  {!p.contactName && !p.phone && !p.email && <i>{t('sales.noContact')}</i>}
                </p>
                <button type="button" className="btn-ghost" style={{ padding: '4px 0', fontSize: 13 }} onClick={() => setEdition({ name: p.name, address: p.address, commune: p.commune, phone: p.phone, contactName: p.contactName, email: p.email, cuisine: p.cuisine, notes: p.notes })}>✏️ {t('sales.editInfo')}</button>
                <br />
                <button type="button" className="btn-ghost" style={{ padding: '4px 0', fontSize: 13 }} disabled={envoi} onClick={poserPosition}>📍 {p.lat !== null && p.lat !== undefined ? t('sales.positionFix') : t('sales.useMyPosition')}</button>
                <span className="small"> · {p.lat !== null && p.lat !== undefined ? t('sales.positionOnMap') : t('sales.positionMissing')}</span>
              </div>
              <div>
                <b className="crm-bloc-titre">{t('sales.nextActionTitle')}</b>
                <input type="datetime-local" value={versLocal(p.nextActionAt)} disabled={envoi} onChange={(e) => patch({ nextActionAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                {p.nextActionAt && <button type="button" className="btn-ghost" style={{ padding: '4px 0', fontSize: 13 }} onClick={() => patch({ nextActionAt: null })}>{t('sales.clearNextAction')}</button>}
              </div>
            </div>

            {/* Avis du restaurateur : ce qu'il pense de Fairide, en étoiles et en une phrase. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.feedbackTitle')}</b>
              <div className="crm-etoiles" role="radiogroup" aria-label={t('sales.feedbackTitle')}>
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={p.rating === n} className={`crm-etoile${p.rating >= n ? ' pleine' : ''}`} disabled={envoi} onClick={() => patch({ rating: p.rating === n ? null : n })}>★</button>)}
                <span className="small">{p.rating ? t(`sales.rating_${p.rating}`) : t('sales.ratingNone')}</span>
              </div>
              <textarea rows={2} defaultValue={p.feedback} key={`fb-${p.updatedAt}`} placeholder={t('sales.feedbackPh')} onBlur={(e) => e.target.value !== p.feedback && patch({ feedback: e.target.value })} />
            </div>

            {/* Lier au commerce inscrit sur Fairide, pour voir s'il est validé et en ligne. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.linkTitle')}</b>
              {!p.restaurantId && <p className="small" style={{ margin: '0 0 6px' }}>💶 {t('sales.linkHint')}</p>}
              {p.restaurantId ? (
                <p className="small" style={{ margin: 0 }}>🏪 {p.restaurantName} · {t(`sales.restoStatus_${p.restaurantStatus || 'pending'}`)} <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => patch({ restaurantId: null })}>{t('sales.unlink')}</button></p>
              ) : (
                <div>
                  <input type="search" value={lien.q} onChange={(e) => chercherResto(e.target.value)} placeholder={t('sales.linkPlaceholder')} />
                  {lien.resultats.length > 0 && (
                    <div className="crm-resultats">
                      {lien.resultats.map((r) => <button key={r.id} type="button" className="btn-ghost" onClick={() => { patch({ restaurantId: r.id }, t('sales.toastLinked')); setLien({ q: '', resultats: [] }); }}>🏪 {r.name} · {r.commune} · {t(`sales.restoStatus_${r.adminStatus}`)}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Historique : chaque visite, appel, message ou note, daté à la minute ; un changement d'étape aussi. */}
            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.historyTitle')}</b>
              <form className="crm-ajout" onSubmit={ajouterEvenement}>
                <div className="role-pick" role="group" aria-label={t('sales.eventKind')}>
                  {KINDS.map((k) => <button key={k} type="button" className={`chip${ev.kind === k ? ' active' : ''}`} onClick={() => setEv((s) => ({ ...s, kind: k }))}>{KIND_ICONES[k]} {t(`sales.kind_${k}`)}</button>)}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <input type="datetime-local" value={ev.at} onChange={(e) => setEv((s) => ({ ...s, at: e.target.value }))} required style={{ flex: 1 }} />
                  <select value={ev.stage} onChange={(e) => setEv((s) => ({ ...s, stage: e.target.value }))} style={{ flex: 1 }} aria-label={t('sales.eventStage')}>
                    <option value="">{t('sales.eventStageKeep')}</option>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_ICONES[s]} {t(`sales.stage_${s}`)}</option>)}
                  </select>
                </div>
                <textarea rows={2} value={ev.note} onChange={(e) => setEv((s) => ({ ...s, note: e.target.value }))} placeholder={t('sales.eventNotePh')} />
                <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('sales.addEvent')}</button>
              </form>
              {evenements.length === 0 ? <p className="small" style={{ margin: '8px 0 0' }}>{t('sales.noEvents')}</p> : (
                <ol className="crm-historique">
                  {evenements.map((e) => (
                    <li key={e.id}>
                      <span className="crm-hist-ico" aria-hidden="true">{KIND_ICONES[e.kind]}</span>
                      <div>
                        <div className="small"><b>{t(`sales.kind_${e.kind}`)}</b>{e.stage ? ` → ${stageLabel(e.stage)}` : ''} · {fmt(e.at)}</div>
                        {e.note && <div className="crm-hist-note">{e.note}</div>}
                      </div>
                      <button type="button" className="btn-ghost crm-hist-suppr" aria-label={t('sales.deleteEvent')} onClick={() => setConfirm({ title: t('sales.confirmDeleteEvent'), run: () => supprimerEvenement(e.id) })}>✕</button>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="crm-bloc">
              <b className="crm-bloc-titre">{t('sales.notesTitle')}</b>
              <textarea rows={3} defaultValue={p.notes} key={`notes-${p.updatedAt}`} placeholder={t('sales.notesPh')} onBlur={(e) => e.target.value !== p.notes && patch({ notes: e.target.value })} />
            </div>

            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="small">{t('sales.createdOn', { date: fmt(p.createdAt) })}</span>
              <button type="button" className="btn-danger-ghost" onClick={() => setConfirm({ title: t('sales.confirmDelete', { name: p.name }), danger: true, run: async () => { try { await api(`/sales/prospects/${id}`, { method: 'DELETE', token }); toast(t('sales.toastDeleted')); onDeleted(); } catch (e) { toast(e.message, 'erreur'); } } })}>{t('sales.deleteProspect')}</button>
            </div>
          </>
        )}
        {edition && (
          <form className="crm-edition" noValidate onSubmit={async (e) => { e.preventDefault(); await patch(edition, t('sales.toastSaved')); setEdition(null); }}>
            <h4 style={{ margin: '0 0 8px' }}>{t('sales.editInfo')}</h4>
            {[['name', 'fName'], ['address', 'fAddress'], ['commune', 'fCommune'], ['contactName', 'fContact'], ['phone', 'fPhone'], ['email', 'fEmail'], ['cuisine', 'fCuisine']].map(([k, cle]) => (
              <div className="field" key={k}><label htmlFor={`crm-ed-${k}`}>{t(`sales.${cle}`)}</label><input id={`crm-ed-${k}`} value={edition[k] || ''} onChange={(e) => setEdition((s) => ({ ...s, [k]: e.target.value }))} /></div>
            ))}
            <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-ghost" onClick={() => setEdition(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn-teal" disabled={envoi}>{t('common.save')}</button>
            </div>
          </form>
        )}
        <ConfirmDialog open={!!confirm} title={confirm?.title} danger={confirm?.danger} onCancel={() => setConfirm(null)} onConfirm={async () => { const c = confirm; setConfirm(null); await c.run(); }} />
      </div>
    </div>,
    document.body
  );
}

// ----------------------------------------------------------------------------------------------- démarchage
// Le guide du commercial (fondateur, 2026-09-21) : le flyer Fairide qu'il doit toujours avoir avec lui et laisser au
// restaurateur, le pitch, les techniques de vente, et la règle d'or — on représente Fairide : si c'est non, on reste
// pro, on laisse le flyer, on souhaite une bonne journée et on repasse la semaine d'après. Repliable (mémorisé).
const FLYER_URL = '/docs/flyer-fairide.pdf';
function GuideCard({ t }) {
  const [ouvert, setOuvert] = useState(() => { try { return localStorage.getItem('sales_guide') !== 'off'; } catch { return true; } });
  const basculer = () => setOuvert((v) => { try { localStorage.setItem('sales_guide', v ? 'off' : 'on'); } catch { /* sans stockage */ } return !v; });
  const liste = (cle, n) => Array.from({ length: n }, (_, i) => <li key={i}>{t(`sales.${cle}${i + 1}`)}</li>);
  return (
    <div className="card crm-guide">
      <div className="crm-carte-tete">
        <div>
          <b>🗣️ {t('sales.guideTitle')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.guideIntro')}</p>
        </div>
        <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }} onClick={basculer}>{ouvert ? t('sales.guideHide') : t('sales.guideShow')}</button>
      </div>
      <div className="crm-flyer">
        <div>
          <b>📄 {t('sales.flyerTitle')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.flyerText')}</p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <a className="btn-gold" href={FLYER_URL} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{t('sales.flyerOpen')}</a>
          <a className="btn-outline" href={FLYER_URL} download="flyer-fairide.pdf" style={{ textDecoration: 'none' }}>⬇️ {t('sales.flyerDownload')}</a>
        </div>
      </div>
      {ouvert && (
        <div className="crm-guide-corps">
          <div className="crm-guide-bloc crm-guide-regle">
            <b>⭐ {t('sales.guideRepTitle')}</b>
            <p className="small" style={{ margin: '4px 0 0' }}>{t('sales.guideRepText')}</p>
          </div>
          <div className="crm-guide-bloc">
            <b>🎒 {t('sales.guideBeforeTitle')}</b>
            <ul className="small">{liste('guideBefore', 4)}</ul>
          </div>
          <div className="crm-guide-bloc">
            <b>⏱️ {t('sales.guidePitchTitle')}</b>
            <p className="small crm-guide-pitch">{t('sales.guidePitchText')}</p>
            <ul className="small">{liste('guidePitch', 4)}</ul>
          </div>
          <div className="crm-guide-bloc">
            <b>🤝 {t('sales.guideTechTitle')}</b>
            <ul className="small">{liste('guideTech', 6)}</ul>
          </div>
          <div className="crm-guide-bloc crm-guide-non">
            <b>🙂 {t('sales.guideNoTitle')}</b>
            <ul className="small">{liste('guideNo', 5)}</ul>
          </div>
          <div className="crm-guide-bloc">
            <b>✅ {t('sales.guideYesTitle')}</b>
            <ul className="small">{liste('guideYes', 4)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- zones
// Les zones à démarcher, réparties entre commerciaux : les miennes, celles à faire (personne dessus, les moins
// démarchées d'abord), celles prises par d'autres — sans dire par qui (fondateur, 22/09). Un clic sur le nom cadre la carte.
function ZonesView({ zones, t, busy, onFocus, onClaim, onRelease }) {
  const mine = zones.filter((z) => z.status === 'mine');
  const todo = zones.filter((z) => z.status === 'todo').sort((a, b) => (a.mine + a.others) - (b.mine + b.others));
  const taken = zones.filter((z) => z.status === 'taken');
  const ligne = (z, action) => (
    <li key={z.key} className={`crm-zone-ligne crm-zone-${z.status}`}>
      <button type="button" className="crm-zone-nom" onClick={() => onFocus(z.key)}>🎯 <b>{z.name}</b><span className="small"> · {z.commune} · {t(`sales.zoneTag_${z.tag}`)}</span></button>
      <span className="small crm-zone-info">{t('sales.zoneCanvassed', { n: z.mine + z.others })}{z.status === 'taken' ? ` · 🧑‍💼 ${t('sales.zoneTakenOther')}` : ''}</span>
      {action}
    </li>
  );
  return (
    <div className="crm-zones-vue">
      <p className="small" style={{ margin: '0 0 10px' }}>{t('sales.zonesViewIntro')}</p>
      <b className="crm-bloc-titre">🙋 {t('sales.zoneMineGroup')} · {mine.length}</b>
      {mine.length === 0 ? <p className="small" style={{ margin: '4px 0 12px' }}>{t('sales.zoneMineEmpty')}</p> : <ul className="crm-zone-liste">{mine.map((z) => ligne(z, <button type="button" className="btn-ghost" style={{ fontSize: 13 }} disabled={busy} onClick={() => onRelease(z.key)}>{t('sales.zoneLeave')}</button>))}</ul>}
      <b className="crm-bloc-titre">📍 {t('sales.zoneTodoGroup')} · {todo.length}</b>
      {todo.length === 0 ? <p className="small" style={{ margin: '4px 0 12px' }}>{t('sales.zoneTodoEmpty')}</p> : <ul className="crm-zone-liste">{todo.map((z) => ligne(z, <button type="button" className="btn-teal" style={{ fontSize: 13, padding: '6px 12px' }} disabled={busy} onClick={() => onClaim(z.key)}>{t('sales.zoneTake')}</button>))}</ul>}
      <b className="crm-bloc-titre">🧑‍💼 {t('sales.zoneTakenGroup')} · {taken.length}</b>
      {taken.length === 0 ? <p className="small" style={{ margin: '4px 0 0' }}>{t('sales.zoneTakenEmpty')}</p> : <ul className="crm-zone-liste">{taken.map((z) => ligne(z, null))}</ul>}
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- équipe
// Les commerciaux, par leur PRÉNOM seulement (le serveur n'envoie rien d'autre) : inscrits et gains — pas les
// commerces démarchés (fondateur, 22/09). Pour voir que d'autres bossent et que ça rapporte — et se situer.
function EquipeCard({ equipe, t, euros }) {
  if (!equipe.length) return null;
  const total = equipe.reduce((s, x) => s + (x.earned || 0), 0);
  const inscrits = equipe.reduce((s, x) => s + (x.signed || 0), 0);
  return (
    <div className="card crm-equipe">
      <b>🏆 {t('sales.teamTitle')}</b>
      <p className="small" style={{ margin: '2px 0 8px' }}>{t('sales.teamIntro', { n: equipe.length, signed: inscrits, total: euros(total) })}</p>
      <ol className="crm-equipe-liste">
        {equipe.map((x, i) => (
          <li key={`${x.firstName}-${i}`} className={x.me ? 'crm-equipe-moi' : ''}>
            <span className="crm-equipe-rang" aria-hidden="true">{i + 1}</span>
            <span className="crm-equipe-nom">🧑‍💼 <b>{x.firstName}</b>{x.me ? <span className="small"> · {t('sales.teamMe')}</span> : null}<br /><span className="small">{t('sales.teamLine', { signed: x.signed })}</span></span>
            <span className="crm-equipe-gain"><b>{euros(x.earned)}</b>{x.upcoming ? <><br /><span className="small">+ {euros(x.upcoming)} {t('sales.teamUpcoming')}</span></> : null}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ----------------------------------------------------------------------------------------------- rémunération
// Le barème (20 € à l'inscription, 40 € au premier mois payé, 50 € sept mois plus tard s'il est toujours abonné) et
// mes primes, commerce par commerce. Les primes sont créées par le serveur (lien au commerce inscrit, abonnement).
function RemunerationCard({ etat, primes, t, euros, fmtDate }) {
  const [ouvert, setOuvert] = useState(false);
  const rules = etat?.rules || { signup: 20, first_month: 40, retention: 50, retentionMonths: 7 };
  const g = etat?.earnings || { earned: 0, paid: 0, scheduled: 0, total: 0 };
  const quand = (c) => {
    if (c.status === 'scheduled' && c.dueAt) return t('sales.payDue', { date: fmtDate(c.dueAt) });
    if (c.status === 'paid' && c.paidAt) return t('sales.payPaidOn', { date: fmtDate(c.paidAt) });
    if (c.earnedAt) return t('sales.payEarnedOn', { date: fmtDate(c.earnedAt) });
    return '';
  };
  return (
    <div className="card crm-remu">
      <div className="crm-carte-tete">
        <div>
          <b>💶 {t('sales.payTitle')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('sales.payIntro')}</p>
        </div>
        <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 13 }} onClick={() => setOuvert((v) => !v)}>{ouvert ? t('sales.payHide') : t('sales.payShow')}</button>
      </div>
      <div className="crm-bareme">
        <div><b>{euros(rules.signup)}</b><span className="small">{t('sales.ruleSignup')}</span></div>
        <div><b>{euros(rules.first_month)}</b><span className="small">{t('sales.ruleFirstMonth')}</span></div>
        <div><b>{euros(rules.retention)}</b><span className="small">{t('sales.ruleRetention', { months: rules.retentionMonths })}</span></div>
      </div>
      <div className="stat-grid crm-stats" style={{ marginTop: 10, marginBottom: 0 }}>
        <div className="stat-card highlight"><div className="num">{euros(g.total)}</div><div className="label">{t('sales.payTotal')}</div></div>
        <div className="stat-card"><div className="num">{euros(g.earned)}</div><div className="label">{t('sales.payEarned')}</div></div>
        <div className="stat-card"><div className="num">{euros(g.paid)}</div><div className="label">{t('sales.payPaid')}</div></div>
        <div className="stat-card"><div className="num">{euros(g.scheduled)}</div><div className="label">{t('sales.payScheduled')}</div></div>
      </div>
      {ouvert && (primes === null ? <div className="small" style={{ marginTop: 10 }}>{t('common.loading')}</div> : primes.length === 0 ? <p className="small" style={{ margin: '10px 0 0' }}>{t('sales.payEmpty')}</p> : (
        <ul className="crm-primes">
          {primes.map((c) => (
            <li key={c.id}>
              <span><b>{c.restaurantName || c.prospectName || '—'}</b><br /><span className="small">{t(`sales.commission_${c.kind}`)}{quand(c) ? ` · ${quand(c)}` : ''}</span></span>
              <span className={`crm-prime crm-prime-${c.status}`}>{euros(c.amount)} · {t(`sales.payStatus_${c.status}`)}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export { STAGES as SALES_STAGES, STAGE_ICONES as SALES_STAGE_ICONES };
