import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { useLanguage, getLocale } from '../context/LanguageContext';
import '../floor-plan.css';

// Plan de salle interactif du restaurateur.
//
// Deux usages. MODIFIER : dessiner sa salle — chaque table est un rectangle (ou un rond) que l'on
// déplace au doigt ou à la souris dans le plan de sa zone (intérieur, terrasse, bar, salon privé),
// et que l'on décrit dans le volet latéral (numéro, places, forme, accolable, bornes de groupe…).
// Les positions ne partent au serveur que sur « Enregistrer le plan » (POST /tables/bulk-layout, une
// transaction), le reste de la fiche sur « Enregistrer la table » (PATCH /tables/:id).
// OCCUPATION : à une date et une heure, chaque table prend la couleur de son état
// (GET /tables/occupancy) et un appui montre la réservation en cours ; passé une réservation sans
// table (`assigner`), un appui sur une table libre la lui attribue.
//
// Coordonnées : posX/posY en % de la largeur/hauteur du plan de la zone, width en % de la largeur,
// height en % de la hauteur. Le plan fait 1,6 fois sa hauteur en largeur (PLAN_RATIO) : une table
// carrée a donc height = width × 1,6 pour paraître carrée. Alignement sur une grille de 2 %.

export const AREAS = ['inside', 'outside', 'bar', 'private'];
export const AREA_ICONS = { inside: '🏠', outside: '🌤️', bar: '🍸', private: '🔒' };
export const PLAN_RATIO = 1.6;
const SNAP = 2;
const AREA_CLASSES = { inside: '', outside: ' fp-terrasse', bar: ' fp-bar', private: ' fp-prive' };

export function areaLabel(t, area) {
  return t(`floorPlan.area_${AREAS.includes(area) ? area : 'inside'}`);
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function snap(v) { return Math.round(v / SNAP) * SNAP; }
function hauteurPour(shape, width) {
  return clamp(Math.round(shape === 'rect' ? width * PLAN_RATIO / 2 : width * PLAN_RATIO), 4, 40);
}
function isoDuJour(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}
function heureArrondie(d) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const [h, m] = parts.split(':').map(Number);
  const total = Math.round((h * 60 + m) / 15) * 15;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function heureLocale(iso) {
  return new Intl.DateTimeFormat(getLocale(), { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

// Première case libre du plan d'une zone pour un rectangle donné (même règle que le serveur).
function placeLibre(tables, area, largeur, hauteur) {
  const posees = tables.filter((t) => t.area === area && t.posX !== null && t.posX !== undefined);
  const recouvre = (x, y) => posees.some((t) => x < t.posX + t.width + 2 && x + largeur + 2 > t.posX && y < t.posY + t.height + 2 && y + hauteur + 2 > t.posY);
  for (let y = 4; y + hauteur <= 96; y += SNAP) {
    for (let x = 4; x + largeur <= 96; x += SNAP) {
      if (!recouvre(x, y)) return { posX: x, posY: y };
    }
  }
  return { posX: 4, posY: 4 };
}

// tables / setTables : la liste chargée par la page (mapTable). assigner : { reservation, onChoisir }
// quand on vient de l'agenda placer une réservation sans table. modeInitial : 'edit' | 'live'.
export default function FloorPlan({ restoId, token, toast, tables, setTables, restaurant, assigner = null, modeInitial = 'edit', dateInitiale = null, heureInitiale = null }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(assigner ? 'live' : modeInitial);
  const [modifs, setModifs] = useState({});
  const [selection, setSelection] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [zonesOuvertes, setZonesOuvertes] = useState([]);
  const [date, setDate] = useState(dateInitiale || isoDuJour(new Date()));
  const [heure, setHeure] = useState(heureInitiale || heureArrondie(new Date()));
  const [occupation, setOccupation] = useState(null);
  const [occChargement, setOccChargement] = useState(false);
  const [occErreur, setOccErreur] = useState('');
  const [enregistrement, setEnregistrement] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [glisse, setGlisse] = useState(null);
  const dragRef = useRef(null);
  const acompteActif = !!restaurant?.reservationDepositEnabled;

  // Les tables telles qu'affichées : la liste du serveur, plus les déplacements pas encore enregistrés.
  const affichees = useMemo(() => (tables || []).map((tb) => ({ ...tb, ...(modifs[tb.id] || {}) })), [tables, modifs]);
  const modifie = Object.keys(modifs).length > 0;

  // Une table jamais placée (créée avant le plan) reçoit une case libre, à enregistrer avec le plan.
  useEffect(() => {
    if (!tables) return;
    const nonPlacees = tables.filter((tb) => (tb.posX === null || tb.posX === undefined) && !modifs[tb.id]);
    if (!nonPlacees.length) return;
    setModifs((m) => {
      const suite = { ...m };
      const courant = tables.map((tb) => ({ ...tb, ...(suite[tb.id] || {}) }));
      for (const tb of nonPlacees) {
        const height = tb.height || hauteurPour(tb.shape, tb.width || 10);
        const place = placeLibre(courant, tb.area, tb.width || 10, height);
        suite[tb.id] = { ...suite[tb.id], ...place, height };
        const i = courant.findIndex((x) => x.id === tb.id);
        courant[i] = { ...courant[i], ...place, height };
      }
      return suite;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables]);

  // Occupation à l'instant choisi (mode direct).
  useEffect(() => {
    if (mode !== 'live' || !restoId) return undefined;
    let annule = false;
    setOccChargement(true); setOccErreur('');
    api(`/restaurants/${restoId}/tables/occupancy?date=${date}&time=${encodeURIComponent(heure)}`, { token })
      .then((d) => { if (!annule) setOccupation(Object.fromEntries(d.tables.map((x) => [x.id, x]))); })
      .catch((e) => { if (!annule) { setOccupation(null); setOccErreur(e.message); } })
      .finally(() => { if (!annule) setOccChargement(false); });
    return () => { annule = true; };
  }, [mode, restoId, date, heure, token, tables]);

  const zonesVisibles = useMemo(() => AREAS.filter((a) => a === 'inside' || a === 'outside' || zonesOuvertes.includes(a) || affichees.some((tb) => tb.area === a)), [affichees, zonesOuvertes]);
  const choisie = affichees.find((tb) => tb.id === selection) || null;

  function poser(id, champs) {
    setModifs((m) => ({ ...m, [id]: { ...(m[id] || {}), ...champs } }));
  }

  // ---- Glisser-déposer (pointer events : souris, doigt et stylet confondus) -------------------
  function debutGlisse(e, tb) {
    if (mode !== 'edit' || e.button > 0) return;
    const plan = e.currentTarget.parentElement;
    const rect = plan.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.posX || 0, origY: tb.posY || 0, w: tb.width || 10, h: tb.height || 10, rect, bouge: false };
  }
  function mouvement(e) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.bouge && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    if (!d.bouge) { d.bouge = true; setGlisse(d.id); }
    const dx = ((e.clientX - d.startX) / d.rect.width) * 100;
    const dy = ((e.clientY - d.startY) / d.rect.height) * 100;
    poser(d.id, { posX: clamp(snap(d.origX + dx), 0, 100 - d.w), posY: clamp(snap(d.origY + dy), 0, 100 - d.h) });
  }
  function finGlisse() {
    const d = dragRef.current;
    dragRef.current = null;
    setGlisse(null);
    if (d && !d.bouge) setSelection((s) => (s === d.id ? null : d.id));
  }
  function appui(tb) {
    if (mode === 'live' && assigner) {
      const etat = occupation?.[tb.id]?.status;
      if (etat !== 'free') { toast(t('floorPlan.toastNotFree')); return; }
      assigner.onChoisir(tb);
      return;
    }
    setSelection((s) => (s === tb.id ? null : tb.id));
  }
  function clavier(e, tb) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); appui(tb); return; }
    if (mode !== 'edit') return;
    const pas = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] }[e.key];
    if (!pas) return;
    e.preventDefault();
    poser(tb.id, { posX: clamp((tb.posX || 0) + pas[0], 0, 100 - (tb.width || 10)), posY: clamp((tb.posY || 0) + pas[1], 0, 100 - (tb.height || 10)) });
  }

  // ---- Appels serveur ---------------------------------------------------------------------------
  async function enregistrerPlan() {
    if (!modifie) return;
    setEnregistrement(true);
    try {
      const liste = Object.entries(modifs).map(([id, m]) => ({ id, ...m }));
      const maj = await api(`/restaurants/${restoId}/tables/bulk-layout`, { method: 'POST', token, body: { tables: liste } });
      setTables(maj); setModifs({});
      toast(t('floorPlan.toastPlanSaved'));
    } catch (e) { toast(e.message); } finally { setEnregistrement(false); }
  }
  async function ajouterTable(area) {
    setEnCours('ajout');
    try {
      const numero = affichees.reduce((m, tb) => Math.max(m, tb.number || 0), 0) + 1;
      const width = 10; const height = hauteurPour('square', width);
      const place = placeLibre(affichees, area, width, height);
      const tb = await api(`/restaurants/${restoId}/tables`, {
        method: 'POST', token,
        body: { name: t('floorPlan.defaultName', { n: numero }), seats: 2, area, shape: 'square', number: numero, width, height, ...place }
      });
      setTables((l) => [...(l || []), tb]);
      setSelection(tb.id);
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  async function dupliquer(tb) {
    setEnCours('dup');
    try {
      const place = placeLibre(affichees, tb.area, tb.width || 10, tb.height || 10);
      const copie = await api(`/restaurants/${restoId}/tables`, {
        method: 'POST', token,
        body: {
          name: tb.name, seats: tb.seats, area: tb.area, shape: tb.shape, joinable: tb.joinable, minParty: tb.minParty, maxParty: tb.maxParty,
          depositAmount: tb.depositAmount, notes: tb.notes, width: tb.width, height: tb.height, rotation: tb.rotation, ...place
        }
      });
      setTables((l) => [...(l || []), copie]);
      setSelection(copie.id);
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  async function supprimer(tb) {
    if (!window.confirm(t('floorPlan.confirmDelete', { name: tb.name }))) return;
    setEnCours('suppr');
    try {
      const r = await api(`/restaurants/${restoId}/tables/${tb.id}`, { method: 'DELETE', token });
      if (r.desactivee) { setTables((l) => l.map((x) => (x.id === tb.id ? r.table : x))); toast(t('floorPlan.toastDisabled')); }
      else { setTables((l) => l.filter((x) => x.id !== tb.id)); setSelection(null); toast(t('floorPlan.toastDeleted')); }
      setModifs((m) => { const s = { ...m }; delete s[tb.id]; return s; });
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  async function modifierTable(id, champs) {
    setEnCours('patch');
    try {
      const maj = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'PATCH', token, body: champs });
      setTables((l) => l.map((x) => (x.id === id ? maj : x)));
      toast(t('floorPlan.toastTableSaved'));
      return true;
    } catch (e) { toast(e.message); return false; } finally { setEnCours(null); }
  }
  async function numeroter() {
    if (!window.confirm(t('floorPlan.confirmAutoNumber'))) return;
    setEnCours('num');
    try {
      const maj = await api(`/restaurants/${restoId}/tables/auto-number`, { method: 'POST', token });
      setTables(maj);
      toast(t('floorPlan.toastNumbered'));
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }

  if (tables === null) return <p className="small">{t('floorPlan.loading')}</p>;

  const zonesAjoutables = AREAS.filter((a) => !zonesVisibles.includes(a));
  return (
    <div className={`fp${mode === 'live' ? ' fp-direct' : ''}${assigner ? ' fp-assigner' : ''}`} style={{ '--fp-zoom': zoom / 100 }}>
      <div className="fp-barre">
        {!assigner && (
          <div className="resa-bascule" role="group" aria-label={t('floorPlan.ariaMode')}>
            <button type="button" className={mode === 'edit' ? 'actif' : ''} onClick={() => { setMode('edit'); setSelection(null); }}>{t('floorPlan.modeEdit')}</button>
            <button type="button" className={mode === 'live' ? 'actif' : ''} onClick={() => { setMode('live'); setSelection(null); }}>{t('floorPlan.modeLive')}</button>
          </div>
        )}
        {mode === 'live' && (
          <>
            <input type="date" value={date} aria-label={t('floorPlan.ariaDate')} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <input type="time" step="900" value={heure} aria-label={t('floorPlan.ariaTime')} onChange={(e) => e.target.value && setHeure(e.target.value)} />
            <button type="button" className="btn-ghost" style={{ padding: '5px 8px', fontSize: 12 }} onClick={() => { setDate(isoDuJour(new Date())); setHeure(heureArrondie(new Date())); }}>{t('floorPlan.now')}</button>
          </>
        )}
        <span className="fp-espace" />
        <label className="fp-zoom">
          🔍
          <input type="range" min="60" max="180" step="10" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={t('floorPlan.ariaZoom')} />
          {zoom}%
        </label>
        {mode === 'edit' && (
          <>
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={!!enCours} onClick={numeroter}>{t('floorPlan.autoNumber')}</button>
            <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!modifie || enregistrement} onClick={enregistrerPlan}>
              {enregistrement ? '…' : t('floorPlan.savePlan')}{modifie && !enregistrement && <span className="fp-modifie" aria-label={t('floorPlan.unsaved')} />}
            </button>
          </>
        )}
      </div>

      {mode === 'edit' && modifie && <p className="small" style={{ margin: '0 0 8px', color: 'var(--orange)' }}>{t('floorPlan.unsavedHint')}</p>}
      {mode === 'live' && assigner && (
        <p className="small" style={{ margin: '0 0 8px', padding: '8px 10px', background: 'var(--cream-dim)', borderRadius: 9 }}>
          {t('floorPlan.assignHint', { name: assigner.reservation.reservationName, n: assigner.reservation.partySize })}
        </p>
      )}
      {mode === 'live' && occErreur && <p className="small" style={{ color: 'var(--red)' }}>{occErreur}</p>}

      <div className="fp-legende" aria-hidden="true">
        {mode === 'live' ? (
          <>
            <span><i className="libre" />{t('floorPlan.legendFree')}</span>
            <span><i className="reservee" />{t('floorPlan.legendReserved')}</span>
            <span><i className="occupee" />{t('floorPlan.legendOccupied')}</span>
            <span><i className="inactive" />{t('floorPlan.legendInactive')}</span>
            {occChargement && <span>{t('floorPlan.loading')}</span>}
          </>
        ) : (
          <>
            <span><i style={{ borderColor: 'var(--iris)', borderWidth: 2 }} />{t('floorPlan.legendTable')}</span>
            <span><i className="accolable" />{t('floorPlan.legendJoinable')}</span>
            <span><i className="inactive" />{t('floorPlan.legendInactive')}</span>
            <span>{t('floorPlan.legendDragHint')}</span>
          </>
        )}
      </div>

      <div className="fp-corps">
        <div>
          {zonesVisibles.map((area) => {
            const dansZone = affichees.filter((tb) => tb.area === area);
            return (
              <section className="fp-zone" key={area} aria-label={areaLabel(t, area)}>
                <div className="fp-zone-tete">
                  <b>{AREA_ICONS[area]} {areaLabel(t, area)}</b>
                  <span className="small">{t('floorPlan.zoneCount', { n: dansZone.filter((tb) => tb.active).length, seats: dansZone.filter((tb) => tb.active).reduce((a, tb) => a + (tb.seats || 0), 0) })}</span>
                  {mode === 'edit' && <button type="button" className="btn-outline" disabled={!!enCours} onClick={() => ajouterTable(area)}>{t('floorPlan.addTable')}</button>}
                </div>
                <div className="fp-defiler">
                  <div className={`fp-plan${AREA_CLASSES[area]}`}>
                    {dansZone.length === 0 && <div className="fp-vide">{mode === 'edit' ? t('floorPlan.emptyZoneEdit') : t('floorPlan.emptyZone')}</div>}
                    {dansZone.map((tb) => {
                      const etat = mode === 'live' ? (occupation?.[tb.id]?.status || (tb.active ? 'free' : 'blocked')) : null;
                      const classes = ['fp-table', `fp-${tb.shape || 'square'}`];
                      if (etat) classes.push(`fp-etat-${etat}`);
                      if (!tb.active) classes.push('fp-inactive');
                      if (tb.joinable && mode === 'edit') classes.push('fp-accolable');
                      if (selection === tb.id) classes.push('fp-sel');
                      if (modifs[tb.id]) classes.push('fp-dirty');
                      if (glisse === tb.id) classes.push('fp-glisse');
                      return (
                        <div key={tb.id} className={classes.join(' ')} role="button" tabIndex={0}
                          aria-label={t('floorPlan.ariaTable', { n: tb.number ?? '–', name: tb.name, seats: tb.seats })}
                          aria-pressed={selection === tb.id}
                          style={{ left: `${tb.posX || 0}%`, top: `${tb.posY || 0}%`, width: `${tb.width || 10}%`, height: `${tb.height || 10}%`, transform: `rotate(${tb.rotation || 0}deg)` }}
                          onPointerDown={(e) => (mode === 'edit' ? debutGlisse(e, tb) : null)}
                          onPointerMove={mode === 'edit' ? mouvement : undefined}
                          onPointerUp={mode === 'edit' ? finGlisse : undefined}
                          onPointerCancel={mode === 'edit' ? finGlisse : undefined}
                          onClick={mode === 'live' ? () => appui(tb) : undefined}
                          onKeyDown={(e) => clavier(e, tb)}>
                          <b>{tb.number ?? '–'}</b>
                          <span>{tb.name}</span>
                          <small>{tb.seats} 👤</small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
          {mode === 'edit' && zonesAjoutables.length > 0 && (
            <div className="fp-ajout-zone">
              {zonesAjoutables.map((a) => (
                <button type="button" key={a} className="btn-ghost" onClick={() => setZonesOuvertes((z) => [...z, a])}>{t('floorPlan.addZone', { zone: `${AREA_ICONS[a]} ${areaLabel(t, a)}` })}</button>
              ))}
            </div>
          )}
        </div>

        {choisie && mode === 'edit' && (
          <FicheTable key={choisie.id} tb={choisie} acompteActif={acompteActif} enCours={enCours}
            onFermer={() => setSelection(null)}
            onPlan={(champs) => poser(choisie.id, champs)}
            onModifier={(champs) => modifierTable(choisie.id, champs)}
            onDupliquer={() => dupliquer(choisie)}
            onSupprimer={() => supprimer(choisie)} />
        )}
        {choisie && mode === 'live' && (
          <FicheOccupation tb={choisie} etat={occupation?.[choisie.id] || null} onFermer={() => setSelection(null)} />
        )}
      </div>
    </div>
  );
}

// Volet latéral en mode modification : la fiche de la table choisie.
function FicheTable({ tb, acompteActif, enCours, onFermer, onPlan, onModifier, onDupliquer, onSupprimer }) {
  const { t } = useLanguage();
  const [f, setF] = useState({
    number: tb.number ?? '', name: tb.name, seats: tb.seats, area: tb.area, shape: tb.shape, joinable: !!tb.joinable,
    minParty: tb.minParty ?? '', maxParty: tb.maxParty ?? '', depositAmount: tb.depositAmount ?? '', notes: tb.notes || '', active: tb.active
  });
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const change = f.number !== (tb.number ?? '') || f.name !== tb.name || Number(f.seats) !== tb.seats || f.area !== tb.area || f.shape !== tb.shape
    || f.joinable !== !!tb.joinable || String(f.minParty) !== String(tb.minParty ?? '') || String(f.maxParty) !== String(tb.maxParty ?? '')
    || String(f.depositAmount) !== String(tb.depositAmount ?? '') || f.notes !== (tb.notes || '') || f.active !== tb.active;

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.name.trim()) { return; }
    const body = {
      number: f.number === '' ? null : Number(f.number), name: f.name.trim(), seats: Number(f.seats), area: f.area, shape: f.shape,
      joinable: f.joinable, minParty: f.minParty === '' ? null : Number(f.minParty), maxParty: f.maxParty === '' ? null : Number(f.maxParty),
      notes: f.notes, active: f.active
    };
    if (acompteActif) body.depositAmount = f.depositAmount === '' ? null : Number(f.depositAmount);
    // Changer de forme ajuste la hauteur sur le plan (une ronde ou une carrée se dessinent carrées).
    if (f.shape !== tb.shape) onPlan({ height: hauteurPour(f.shape, tb.width || 10) });
    await onModifier(body);
  }

  return (
    <form className="fp-lateral" onSubmit={enregistrer}>
      <h4>
        {t('floorPlan.tableTitle', { n: tb.number ?? '–' })}
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={onFermer} aria-label={t('floorPlan.close')}>✕</button>
      </h4>
      <div className="fp-champs">
        <div>
          <label htmlFor="fp-num">{t('floorPlan.fNumber')}</label>
          <input id="fp-num" type="number" min="1" max="999" value={f.number} onChange={champ('number')} />
        </div>
        <div>
          <label htmlFor="fp-places">{t('floorPlan.fSeats')}</label>
          <input id="fp-places" type="number" min="1" max="30" value={f.seats} onChange={champ('seats')} required />
        </div>
        <div className="fp-large">
          <label htmlFor="fp-nom">{t('floorPlan.fName')}</label>
          <input id="fp-nom" value={f.name} onChange={champ('name')} required maxLength={60} />
        </div>
        <div>
          <label htmlFor="fp-zone">{t('floorPlan.fArea')}</label>
          <select id="fp-zone" value={f.area} onChange={champ('area')}>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_ICONS[a]} {areaLabel(t, a)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fp-forme">{t('floorPlan.fShape')}</label>
          <select id="fp-forme" value={f.shape} onChange={champ('shape')}>
            <option value="square">{t('floorPlan.shapeSquare')}</option>
            <option value="round">{t('floorPlan.shapeRound')}</option>
            <option value="rect">{t('floorPlan.shapeRect')}</option>
          </select>
        </div>
        <div>
          <label htmlFor="fp-min">{t('floorPlan.fMinParty')}</label>
          <input id="fp-min" type="number" min="1" max="30" value={f.minParty} placeholder="–" onChange={champ('minParty')} />
        </div>
        <div>
          <label htmlFor="fp-max">{t('floorPlan.fMaxParty')}</label>
          <input id="fp-max" type="number" min="1" max="30" value={f.maxParty} placeholder="–" onChange={champ('maxParty')} />
        </div>
        {acompteActif && (
          <div className="fp-large">
            <label htmlFor="fp-acompte">{t('floorPlan.fDeposit')}</label>
            <input id="fp-acompte" type="number" min="0" max="500" step="0.5" value={f.depositAmount} placeholder={t('floorPlan.phDepositRule')} onChange={champ('depositAmount')} />
          </div>
        )}
        <div className="fp-large">
          <label className="fp-case"><input type="checkbox" checked={f.joinable} onChange={champ('joinable')} /><span>{t('floorPlan.fJoinable')}</span></label>
          <p className="small" style={{ margin: '2px 0 0 24px' }}>{t('floorPlan.joinableHelp')}</p>
        </div>
        <div className="fp-large">
          <label className="fp-case"><input type="checkbox" checked={f.active} onChange={champ('active')} /><span>{t('floorPlan.fActive')}</span></label>
        </div>
        <div className="fp-large">
          <label htmlFor="fp-notes">{t('floorPlan.fNotes')}</label>
          <textarea id="fp-notes" rows={2} maxLength={500} value={f.notes} placeholder={t('floorPlan.phNotes')} onChange={champ('notes')} />
        </div>
      </div>
      <div className="fp-actions">
        <button type="submit" className="btn-teal" disabled={!change || enCours === 'patch'}>{enCours === 'patch' ? '…' : t('floorPlan.saveTable')}</button>
      </div>

      <div className="fp-sous-titre">{t('floorPlan.onPlan')}</div>
      <div className="fp-champs">
        <div className="fp-large">
          <label htmlFor="fp-taille">{t('floorPlan.fSize', { w: tb.width || 10 })}</label>
          <input id="fp-taille" type="range" min="4" max="40" step="2" value={tb.width || 10} style={{ padding: 0 }}
            onChange={(e) => { const w = Number(e.target.value); onPlan({ width: w, height: tb.shape === 'rect' ? tb.height : hauteurPour(tb.shape, w) }); }} />
        </div>
        {tb.shape === 'rect' && (
          <div className="fp-large">
            <label htmlFor="fp-hauteur">{t('floorPlan.fHeight', { h: tb.height || 10 })}</label>
            <input id="fp-hauteur" type="range" min="4" max="40" step="2" value={tb.height || 10} style={{ padding: 0 }} onChange={(e) => onPlan({ height: Number(e.target.value) })} />
          </div>
        )}
      </div>
      <div className="fp-actions">
        <button type="button" className="btn-outline" onClick={() => onPlan({ rotation: ((tb.rotation || 0) + 90) % 360 })}>{t('floorPlan.rotate')}</button>
        <button type="button" className="btn-outline" disabled={!!enCours} onClick={onDupliquer}>{enCours === 'dup' ? '…' : t('floorPlan.duplicate')}</button>
        <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} disabled={!!enCours} onClick={onSupprimer}>{enCours === 'suppr' ? '…' : t('floorPlan.delete')}</button>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('floorPlan.planFieldsHint')}</p>
    </form>
  );
}

// Volet latéral en mode occupation : l'état de la table et la réservation en cours / suivante.
function FicheOccupation({ tb, etat, onFermer }) {
  const { t } = useLanguage();
  const statut = etat?.status || (tb.active ? 'free' : 'blocked');
  const resa = (r, titre) => (
    <div className="fp-resa">
      <span className="small">{titre}</span>
      <b>{r.name || '—'} · {t('floorPlan.nPeople', { n: r.partySize })}</b>
      <span>{heureLocale(r.from)} → {heureLocale(r.to)}</span>
      {r.tableIds && r.tableIds.length > 1 && <span className="small"> · {t('floorPlan.combined')}</span>}
      {r.zonePreference && <span className="small"> · {t('floorPlan.wanted', { zone: areaLabel(t, r.zonePreference) })}</span>}
    </div>
  );
  return (
    <div className="fp-lateral">
      <h4>
        {t('floorPlan.tableTitle', { n: tb.number ?? '–' })} · {tb.name}
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={onFermer} aria-label={t('floorPlan.close')}>✕</button>
      </h4>
      <p className="small" style={{ margin: 0 }}>
        <span className={`fp-etat-pastille ${statut}`} />{t(`floorPlan.status_${statut}`)} · {t('floorPlan.seatsIn', { n: tb.seats, zone: areaLabel(t, tb.area) })}
      </p>
      {etat?.reservation && resa(etat.reservation, t('floorPlan.currentResa'))}
      {etat?.next && resa(etat.next, t('floorPlan.nextResa'))}
      {!etat?.reservation && !etat?.next && statut !== 'blocked' && <p className="small" style={{ margin: '8px 0 0' }}>{t('floorPlan.noResaLater')}</p>}
      {tb.notes && <p className="small" style={{ margin: '8px 0 0' }}>📝 {tb.notes}</p>}
    </div>
  );
}
