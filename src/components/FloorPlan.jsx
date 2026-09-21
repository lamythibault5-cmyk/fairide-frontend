import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import ConfirmDialog from './ConfirmDialog';
import { useLanguage, getLocale } from '../context/LanguageContext';
import PlanModeles from './PlanModeles';
import { AREAS, AREA_ICONS, areaLabel, TYPES_ELEMENT, ELEMENT_ICONES, ELEMENT_TAILLES_M, SALLE_CLASSES, styleSalle, ContenuElement } from './PlanApercu';
import '../floor-plan.css';

export { AREAS, AREA_ICONS, areaLabel };

// Plan de salle interactif du restaurateur.
//
// SALLES : le restaurateur crée autant de salles qu'il veut (« Salle du haut », « Terrasse côté rue »…), chacune avec
// un type (intérieur, terrasse, bar, salon privé — il fixe l'area de ses tables), des dimensions réelles en mètres et
// des éléments de décor non réservables (murs, fenêtres, entrée, comptoir, cuisine, WC…). Trois façons de commencer :
// un modèle prêt à l'emploi (PlanModeles) ou une salle vide. L'assistant qui lisait une PHOTO de la salle
// (PlanPhotoAssistant) est parti le 2026-09-21 avec les appels à l'API : l'équipe monte les plans sur demande.
//
// MODIFIER : tout se fait au doigt ou à la souris — glisser une table ou un élément, le toucher pour ouvrir sa fiche,
// tirer la poignée ↘ pour l'agrandir, tirer la poignée du coin de la salle pour agrandir la pièce (les tables gardent
// leur taille réelle). Positions, tailles, dimensions et éléments partent au serveur sur « Enregistrer le plan »
// (POST /tables/bulk-layout, une transaction) ; la fiche d'une table sur « Enregistrer la table » (PATCH /tables/:id) ;
// nom, type, création et suppression d'une salle tout de suite (/rooms).
// OCCUPATION : à une date et une heure, chaque table prend la couleur de son état (GET /tables/occupancy) et un appui
// montre la réservation en cours ; passé une réservation sans table (`assigner`), un appui sur une table libre la lui
// attribue.
//
// Coordonnées : posX/posY/width en % de la largeur de la salle, posY/height en % de sa profondeur. Une table carrée
// a donc height = width × (largeur / profondeur) pour paraître carrée.

export const PLAN_RATIO = 1.6;
const SNAP = 1;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function r2(v) { return Math.round(v * 100) / 100; }
function snap(v) { return Math.round(v / SNAP) * SNAP; }
function hauteurPour(shape, width, ratio = PLAN_RATIO) {
  return clamp(r2(shape === 'rect' ? width * ratio / 2 : width * ratio), 1, 80);
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
function metres(v) {
  return `${new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 1 }).format(v)} m`;
}
function nouvelId() { return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

// Première case libre d'une salle pour un rectangle donné, parmi ses tables et ses éléments.
function placeLibre(objets, largeur, hauteur) {
  const recouvre = (x, y) => objets.some((o) => x < o.x + o.w + 1 && x + largeur + 1 > o.x && y < o.y + o.h + 1 && y + hauteur + 1 > o.y);
  for (let y = 2; y + hauteur <= 98; y += SNAP) {
    for (let x = 2; x + largeur <= 98; x += SNAP) {
      if (!recouvre(x, y)) return { posX: x, posY: y };
    }
  }
  return { posX: 2, posY: 2 };
}

// tables / setTables : la liste chargée par la page (mapTable). assigner : { reservation, onChoisir }
// quand on vient de l'agenda placer une réservation sans table. modeInitial : 'edit' | 'live'.
export default function FloorPlan({ restoId, token, toast, tables, setTables, restaurant, assigner = null, modeInitial = 'edit', dateInitiale = null, heureInitiale = null }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState(assigner ? 'live' : modeInitial);
  const [modifs, setModifs] = useState({});
  const [salles, setSalles] = useState(null);
  const [modifsSalles, setModifsSalles] = useState({});
  const [selection, setSelection] = useState(null);
  const [selEl, setSelEl] = useState(null); // { roomId, id }
  const [zoom, setZoom] = useState(100);
  const [date, setDate] = useState(dateInitiale || isoDuJour(new Date()));
  const [heure, setHeure] = useState(heureInitiale || heureArrondie(new Date()));
  const [occupation, setOccupation] = useState(null);
  const [occChargement, setOccChargement] = useState(false);
  const [occErreur, setOccErreur] = useState('');
  const [occVersion, setOccVersion] = useState(0); // relance la lecture de l'occupation après une action rapide
  const [enregistrement, setEnregistrement] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [glisse, setGlisse] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [creation, setCreation] = useState(null); // { mode: 'modele', cible }
  const [nouvelleSalle, setNouvelleSalle] = useState(null); // { name, kind }
  const [renommage, setRenommage] = useState(null); // { id, name }
  const dragRef = useRef(null);
  const creationRef = useRef(null);
  const acompteActif = !!restaurant?.reservationDepositEnabled;

  // Salles du restaurant (une « Salle » est créée côté serveur s'il n'en a aucune).
  useEffect(() => {
    if (!restoId || !token) return undefined;
    let annule = false;
    api(`/restaurants/${restoId}/rooms`, { token })
      .then((l) => { if (!annule) setSalles(l); })
      .catch(() => { if (!annule) setSalles([]); });
    return () => { annule = true; };
  }, [restoId, token]);

  useEffect(() => {
    if (creation) creationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [creation]);

  // Salles affichées : celles du serveur plus les modifications locales (dimensions, éléments). Serveur injoignable :
  // une salle par zone utilisée, sans outils de salle.
  const sallesAff = useMemo(() => {
    const base = salles && salles.length ? salles : AREAS.filter((a) => a === 'inside' || (tables || []).some((tb) => tb.area === a))
      .map((a) => ({ id: `zone-${a}`, name: areaLabel(t, a), kind: a, widthM: 10, depthM: 6.25, elements: [], virtuelle: true }));
    return base.map((s) => ({ ...s, ...(modifsSalles[s.id] || {}) }));
  }, [salles, modifsSalles, tables, t]);
  const salleDe = (tb) => sallesAff.find((s) => s.id === tb.roomId) || sallesAff.find((s) => s.kind === tb.area) || sallesAff[0];

  // Les tables telles qu'affichées : la liste du serveur, plus les déplacements pas encore enregistrés. Une table
  // retirée d'une salle par un nouveau plan (désactivée, sans salle) n'est plus dessinée.
  const affichees = useMemo(() => (tables || [])
    .filter((tb) => tb.roomId || tb.active || !(salles && salles.length))
    .map((tb) => ({ ...tb, ...(modifs[tb.id] || {}) })), [tables, modifs, salles]);
  const modifie = Object.keys(modifs).length > 0 || Object.keys(modifsSalles).length > 0;
  const objetsDe = (salle, saufId = null) => [
    ...affichees.filter((tb) => tb.id !== saufId && salleDe(tb)?.id === salle.id && tb.posX !== null && tb.posX !== undefined)
      .map((tb) => ({ x: tb.posX, y: tb.posY, w: tb.width || 10, h: tb.height || 10 })),
    ...(salle.elements || []).filter((e) => e.id !== saufId)
  ];

  // Une table jamais placée (créée avant le plan) reçoit une case libre de sa salle, à enregistrer avec le plan.
  useEffect(() => {
    if (!tables || salles === null) return;
    const nonPlacees = affichees.filter((tb) => (tb.posX === null || tb.posX === undefined) && !modifs[tb.id]);
    if (!nonPlacees.length) return;
    setModifs((m) => {
      const suite = { ...m };
      const posees = [];
      for (const tb of nonPlacees) {
        const salle = salleDe(tb);
        const height = tb.height || hauteurPour(tb.shape, tb.width || 10, salle.widthM / salle.depthM);
        const place = placeLibre([...objetsDe(salle), ...posees.filter((p) => p.salle === salle.id)], tb.width || 10, height);
        suite[tb.id] = { ...suite[tb.id], ...place, height };
        posees.push({ salle: salle.id, x: place.posX, y: place.posY, w: tb.width || 10, h: height });
      }
      return suite;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, salles]);

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
  }, [mode, restoId, date, heure, token, tables, occVersion]);

  // Actions rapides du mode direct : table occupée par des clients sans réservation / libérée, et ouverture à la
  // réservation en ligne. Un appui, et le plan comme les créneaux proposés en ligne sont à jour.
  async function actionTable(tb, chemin, body) {
    try {
      const maj = await api(`/restaurants/${restoId}/tables/${tb.id}${chemin}`, { method: 'PATCH', token, body });
      setTables?.((liste) => (liste || []).map((x) => (x.id === maj.id ? { ...x, ...maj } : x)));
      setOccVersion((v) => v + 1);
      return maj;
    } catch (e) { toast(e.message, 'erreur'); return null; }
  }

  const choisie = affichees.find((tb) => tb.id === selection) || null;
  const salleElChoisi = selEl ? sallesAff.find((s) => s.id === selEl.roomId) : null;
  const elChoisi = salleElChoisi ? (salleElChoisi.elements || []).find((e) => e.id === selEl.id) || null : null;

  function poser(id, champs) {
    setModifs((m) => ({ ...m, [id]: { ...(m[id] || {}), ...champs } }));
  }
  function elementsCourants(m, roomId) {
    return m[roomId]?.elements ?? (salles || []).find((s) => s.id === roomId)?.elements ?? [];
  }
  function poserElements(roomId, fn) {
    setModifsSalles((m) => ({ ...m, [roomId]: { ...(m[roomId] || {}), elements: fn(elementsCourants(m, roomId)) } }));
  }
  function poserElement(roomId, id, champs) {
    poserElements(roomId, (els) => els.map((e) => (e.id === id ? { ...e, ...champs } : e)));
  }
  function deselectionner() { setSelection(null); setSelEl(null); }

  // ---- Glisser, redimensionner (pointer events : souris, doigt et stylet confondus) -----------------------
  // Les mouvements sont écoutés sur le plan : la capture du pointeur les y fait remonter depuis la table ou la poignée.
  function commencer(e, d) {
    if (mode !== 'edit' || e.button > 0) return;
    e.stopPropagation();
    const plan = e.currentTarget.closest('.fp-plan');
    if (!plan) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    dragRef.current = { ...d, startX: e.clientX, startY: e.clientY, rect: plan.getBoundingClientRect(), bouge: false };
  }
  function debutTable(e, tb) {
    const salle = salleDe(tb);
    commencer(e, { action: 'deplacer', type: 'table', id: tb.id, orig: { x: tb.posX || 0, y: tb.posY || 0, w: tb.width || 10, h: tb.height || 10 }, ratio: salle.widthM / salle.depthM });
  }
  function debutElement(e, salle, el) {
    commencer(e, { action: 'deplacer', type: 'element', id: el.id, roomId: salle.id, orig: { x: el.x, y: el.y, w: el.w, h: el.h } });
  }
  function debutRedimTable(e, tb) {
    const salle = salleDe(tb);
    commencer(e, { action: 'redim', type: 'table', id: tb.id, carre: tb.shape !== 'rect', rot: (tb.rotation || 0) % 180 === 90, ratio: salle.widthM / salle.depthM, orig: { x: tb.posX || 0, y: tb.posY || 0, w: tb.width || 10, h: tb.height || 10 } });
  }
  function debutRedimElement(e, salle, el) {
    commencer(e, { action: 'redim', type: 'element', id: el.id, roomId: salle.id, carre: el.type === 'plant' || el.type === 'column', rot: (el.rotation || 0) % 180 === 90, ratio: salle.widthM / salle.depthM, orig: { x: el.x, y: el.y, w: el.w, h: el.h } });
  }
  function instantaneSalle(salle) {
    return { id: salle.id, origW: salle.widthM, origD: salle.depthM, tables: affichees.filter((tb) => salleDe(tb)?.id === salle.id), elements: salle.elements || [] };
  }
  function debutSalle(e, salle) {
    commencer(e, { action: 'salle', ...instantaneSalle(salle) });
  }
  // Nouvelles dimensions : les % sont recalculés pour que tables et éléments gardent leur taille et leur place réelles.
  function redimensionnerSalle(snap0, W, D) {
    const fx = snap0.origW / W; const fy = snap0.origD / D;
    setModifs((m) => {
      const s = { ...m };
      for (const tb of snap0.tables) {
        const width = clamp(r2((tb.width || 10) * fx), 1, 80); const height = clamp(r2((tb.height || 10) * fy), 1, 80);
        s[tb.id] = { ...(s[tb.id] || {}), width, height, posX: clamp(r2((tb.posX || 0) * fx), 0, 100 - width), posY: clamp(r2((tb.posY || 0) * fy), 0, 100 - height) };
      }
      return s;
    });
    setModifsSalles((m) => ({
      ...m,
      [snap0.id]: {
        ...(m[snap0.id] || {}), widthM: W, depthM: D,
        elements: snap0.elements.map((el) => {
          const w = clamp(r2(el.w * fx), 0.5, 100); const h = clamp(r2(el.h * fy), 0.5, 100);
          return { ...el, w, h, x: clamp(r2(el.x * fx), 0, 100 - w), y: clamp(r2(el.y * fy), 0, 100 - h) };
        })
      }
    }));
  }
  function pasSalle(salle, dW, dD) {
    const W = clamp(salle.widthM + dW, 3, 60); const D = clamp(salle.depthM + dD, 2, 40);
    if (W === salle.widthM && D === salle.depthM) return;
    redimensionnerSalle(instantaneSalle(salle), W, D);
  }
  function mouvement(e) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.bouge && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    if (!d.bouge) { d.bouge = true; setGlisse(d.id); }
    const dxPx = e.clientX - d.startX; const dyPx = e.clientY - d.startY;
    if (d.action === 'deplacer') {
      const x = clamp(snap(d.orig.x + (dxPx / d.rect.width) * 100), 0, 100 - d.orig.w);
      const y = clamp(snap(d.orig.y + (dyPx / d.rect.height) * 100), 0, 100 - d.orig.h);
      if (d.type === 'table') poser(d.id, { posX: x, posY: y }); else poserElement(d.roomId, d.id, { x, y });
    } else if (d.action === 'redim') {
      const min = d.type === 'table' ? 1 : 0.5;
      const w = clamp(r2(d.orig.w + ((d.rot ? dyPx : dxPx) / d.rect.width) * 100), min, 100 - d.orig.x);
      const h = d.carre ? clamp(r2(w * d.ratio), min, 100 - d.orig.y) : clamp(r2(d.orig.h + ((d.rot ? dxPx : dyPx) / d.rect.height) * 100), min, 100 - d.orig.y);
      if (d.type === 'table') poser(d.id, { width: Math.min(w, 80), height: Math.min(h, 80) }); else poserElement(d.roomId, d.id, { w, h });
    } else if (d.action === 'salle') {
      const pxParM = d.rect.width / d.origW;
      const W = clamp(Math.round((d.origW + dxPx / pxParM) * 2) / 2, 3, 60);
      const D = clamp(Math.round((d.origD + dyPx / pxParM) * 2) / 2, 2, 40);
      if (W !== d.dernierW || D !== d.dernierD) { d.dernierW = W; d.dernierD = D; redimensionnerSalle(d, W, D); }
    }
  }
  function finGlisse() {
    const d = dragRef.current;
    dragRef.current = null;
    setGlisse(null);
    if (!d || d.bouge || d.action !== 'deplacer') return;
    if (d.type === 'table') { setSelEl(null); setSelection((s) => (s === d.id ? null : d.id)); }
    else { setSelection(null); setSelEl((s) => (s && s.id === d.id ? null : { roomId: d.roomId, id: d.id })); }
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
  const PAS_CLAVIER = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] };
  function clavier(e, tb) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); appui(tb); return; }
    if (mode !== 'edit') return;
    const pas = PAS_CLAVIER[e.key];
    if (!pas) return;
    e.preventDefault();
    poser(tb.id, { posX: clamp((tb.posX || 0) + pas[0], 0, 100 - (tb.width || 10)), posY: clamp((tb.posY || 0) + pas[1], 0, 100 - (tb.height || 10)) });
  }
  function clavierElement(e, salle, el) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelection(null); setSelEl({ roomId: salle.id, id: el.id }); return; }
    const pas = PAS_CLAVIER[e.key];
    if (!pas) return;
    e.preventDefault();
    poserElement(salle.id, el.id, { x: clamp(el.x + pas[0], 0, 100 - el.w), y: clamp(el.y + pas[1], 0, 100 - el.h) });
  }

  // ---- Appels serveur ---------------------------------------------------------------------------
  async function enregistrerPlan() {
    if (!modifie) return;
    setEnregistrement(true);
    try {
      const liste = Object.entries(modifs).map(([id, m]) => ({ id, ...m }));
      const rooms = Object.entries(modifsSalles).filter(([id]) => !id.startsWith('zone-')).map(([id, m]) => ({ id, ...m }));
      const r = await api(`/restaurants/${restoId}/tables/bulk-layout`, { method: 'POST', token, body: { tables: liste, rooms } });
      setTables(r.tables); setSalles(r.rooms); setModifs({}); setModifsSalles({});
      toast(t('floorPlan.toastPlanSaved'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnregistrement(false); }
  }
  async function ajouterTable(salle) {
    setEnCours('ajout');
    try {
      const numero = (tables || []).reduce((m, tb) => Math.max(m, tb.number || 0), 0) + 1;
      const width = clamp(r2(90 / salle.widthM), 1, 80); const height = hauteurPour('square', width, salle.widthM / salle.depthM);
      const place = placeLibre(objetsDe(salle), width, height);
      const tb = await api(`/restaurants/${restoId}/tables`, {
        method: 'POST', token,
        body: { name: t('floorPlan.defaultName', { n: numero }), seats: 2, area: salle.kind, ...(salle.virtuelle ? {} : { roomId: salle.id }), shape: 'square', number: numero, width, height, ...place }
      });
      setTables((l) => [...(l || []), tb]);
      setSelEl(null); setSelection(tb.id);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  async function dupliquer(tb) {
    setEnCours('dup');
    try {
      const salle = salleDe(tb);
      const place = placeLibre(objetsDe(salle), tb.width || 10, tb.height || 10);
      const copie = await api(`/restaurants/${restoId}/tables`, {
        method: 'POST', token,
        body: {
          name: tb.name, seats: tb.seats, area: salle.kind, ...(salle.virtuelle ? {} : { roomId: salle.id }), shape: tb.shape, joinable: tb.joinable, minParty: tb.minParty, maxParty: tb.maxParty,
          depositAmount: tb.depositAmount, notes: tb.notes, width: tb.width, height: tb.height, rotation: tb.rotation, ...place
        }
      });
      setTables((l) => [...(l || []), copie]);
      setSelection(copie.id);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  // Confirmations via ConfirmDialog et non window.confirm : les dialogues natifs sont supprimés ou
  // muets dans une PWA installée et dans les webviews — le contexte d'usage d'une tablette de salle.
  async function supprimer(tb) {
    if (!confirmation || confirmation.type !== 'suppr' || confirmation.id !== tb.id) { setConfirmation({ type: 'suppr', id: tb.id, tb }); return; }
    setConfirmation(null);
    setEnCours('suppr');
    try {
      const r = await api(`/restaurants/${restoId}/tables/${tb.id}`, { method: 'DELETE', token });
      if (r.desactivee) { setTables((l) => l.map((x) => (x.id === tb.id ? r.table : x))); toast(t('floorPlan.toastDisabled')); }
      else { setTables((l) => l.filter((x) => x.id !== tb.id)); setSelection(null); toast(t('floorPlan.toastDeleted')); }
      setModifs((m) => { const s = { ...m }; delete s[tb.id]; return s; });
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  async function modifierTable(tb, champs) {
    setEnCours('patch');
    const ancienne = salleDe(tb);
    try {
      const maj = await api(`/restaurants/${restoId}/tables/${tb.id}`, { method: 'PATCH', token, body: champs });
      setTables((l) => l.map((x) => (x.id === tb.id ? maj : x)));
      // Changement de salle : même taille réelle, première place libre de la nouvelle salle (à enregistrer avec le plan).
      const cible = champs.roomId ? sallesAff.find((s) => s.id === champs.roomId) : champs.area && ancienne.virtuelle ? sallesAff.find((s) => s.kind === champs.area) : null;
      if (cible && cible.id !== ancienne.id) {
        const width = clamp(r2((tb.width || 10) * ancienne.widthM / cible.widthM), 1, 80);
        const height = clamp(r2((tb.height || 10) * ancienne.depthM / cible.depthM), 1, 80);
        poser(tb.id, { width, height, ...placeLibre(objetsDe(cible, tb.id), width, height) });
      }
      toast(t('floorPlan.toastTableSaved'));
      return true;
    } catch (e) { toast(e.message, 'erreur'); return false; } finally { setEnCours(null); }
  }
  async function numeroter() {
    if (!confirmation || confirmation.type !== 'num') { setConfirmation({ type: 'num' }); return; }
    setConfirmation(null);
    setEnCours('num');
    try {
      const maj = await api(`/restaurants/${restoId}/tables/auto-number`, { method: 'POST', token });
      setTables(maj);
      toast(t('floorPlan.toastNumbered'));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }

  // ---- Salles -----------------------------------------------------------------------------------------------
  async function creerSalle() {
    if (!nouvelleSalle) return;
    setEnCours('salle');
    try {
      const s = await api(`/restaurants/${restoId}/rooms`, { method: 'POST', token, body: { name: nouvelleSalle.name.trim() || t(`floorPlan.tplRoom_${nouvelleSalle.kind}`), kind: nouvelleSalle.kind } });
      setSalles((l) => [...(l || []), s]);
      setNouvelleSalle(null);
      toast(t('floorPlan.toastRoomCreated', { name: s.name }));
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  async function patcherSalle(salle, body) {
    try {
      const s = await api(`/restaurants/${restoId}/rooms/${salle.id}`, { method: 'PATCH', token, body });
      setSalles((l) => l.map((x) => (x.id === s.id ? s : x)));
      if (body.kind) setTables((l) => l.map((tb) => (tb.roomId === s.id ? { ...tb, area: s.kind } : tb)));
    } catch (e) { toast(e.message, 'erreur'); }
  }
  function renommerSalle() {
    const r = renommage;
    if (!r) return;
    setRenommage(null);
    const salle = (salles || []).find((s) => s.id === r.id);
    const name = r.name.trim();
    if (salle && name && name !== salle.name) patcherSalle(salle, { name });
  }
  async function supprimerSalle(salle) {
    const nb = (tables || []).filter((tb) => tb.roomId === salle.id).length;
    if (nb > 0) { toast(t('floorPlan.roomNotEmpty', { n: nb })); return; }
    if (!confirmation || confirmation.type !== 'salle' || confirmation.id !== salle.id) { setConfirmation({ type: 'salle', id: salle.id, salle }); return; }
    setConfirmation(null);
    setEnCours('salle');
    try {
      await api(`/restaurants/${restoId}/rooms/${salle.id}`, { method: 'DELETE', token });
      setSalles((l) => l.filter((x) => x.id !== salle.id));
      setModifsSalles((m) => { const s = { ...m }; delete s[salle.id]; return s; });
      if (selEl?.roomId === salle.id) setSelEl(null);
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(null); }
  }
  function ajouterElement(salle, type) {
    const [lm, pm] = ELEMENT_TAILLES_M[type];
    const w = clamp(r2((lm / salle.widthM) * 100), 0.5, 100); const h = clamp(r2((pm / salle.depthM) * 100), 0.5, 100);
    const place = placeLibre(objetsDe(salle), w, h);
    const el = { id: nouvelId(), type, x: place.posX, y: place.posY, w, h, rotation: 0, label: '' };
    poserElements(salle.id, (els) => [...els, el]);
    setSelection(null); setSelEl({ roomId: salle.id, id: el.id });
  }
  function dupliquerElement(salle, el) {
    const copie = { ...el, id: nouvelId(), ...(() => { const p = placeLibre(objetsDe(salle), el.w, el.h); return { x: p.posX, y: p.posY }; })() };
    poserElements(salle.id, (els) => [...els, copie]);
    setSelEl({ roomId: salle.id, id: copie.id });
  }
  function supprimerElement(salle, el) {
    poserElements(salle.id, (els) => els.filter((e) => e.id !== el.id));
    setSelEl(null);
  }
  function ouvrirCreation(type, cible = null) { setNouvelleSalle(null); deselectionner(); setCreation({ mode: type, cible }); }
  function surApplique(r) {
    const avant = new Map((salles || []).map((s) => [s.id, s]));
    const pareil = (a, b) => a && b && JSON.stringify([a.widthM, a.depthM, a.elements]) === JSON.stringify([b.widthM, b.depthM, b.elements]);
    setModifsSalles((m) => Object.fromEntries(Object.entries(m).filter(([id]) => pareil(avant.get(id), r.rooms.find((x) => x.id === id)))));
    setModifs((m) => Object.fromEntries(Object.entries(m).filter(([id]) => r.tables.some((tb) => tb.id === id && tb.roomId))));
    setSalles(r.rooms); setTables(r.tables);
  }

  if (tables === null || salles === null) return <p className="small">{t('floorPlan.loading')}</p>;

  const edit = mode === 'edit';
  const vraiesSalles = sallesAff.filter((s) => !s.virtuelle);
  const panneauCreation = creation && (
    <div ref={creationRef} className="fp-creation">
      <PlanModeles restoId={restoId} token={token} toast={toast} salles={vraiesSalles} tables={tables} cible={creation.cible}
        onFermer={() => setCreation(null)} onApplique={surApplique} />
    </div>
  );
  const carteCreation = edit && !assigner && !creation && (
    <div className="fp-creer">
      <p className="small" style={{ margin: '0 0 8px' }}>{affichees.length === 0 ? t('floorPlan.startHint') : t('floorPlan.addRoomHint')}</p>
      <div className="fp-creer-boutons">
        <button type="button" className="fp-creer-btn" onClick={() => ouvrirCreation('modele')}>
          <span aria-hidden="true">🧩</span><b>{t('floorPlan.createFromTemplate')}</b><small>{t('floorPlan.createFromTemplateSub')}</small>
        </button>
        <button type="button" className="fp-creer-btn" onClick={() => { deselectionner(); setNouvelleSalle({ name: '', kind: 'inside' }); }}>
          <span aria-hidden="true">➕</span><b>{t('floorPlan.createEmpty')}</b><small>{t('floorPlan.createEmptySub')}</small>
        </button>
      </div>
      {nouvelleSalle && (
        <form className="fp-nouvelle-salle" onSubmit={(e) => { e.preventDefault(); creerSalle(); }}>
          <label htmlFor="fp-nouvelle-nom">{t('floorPlan.aiRoomName')}</label>
          <input id="fp-nouvelle-nom" autoFocus value={nouvelleSalle.name} maxLength={40} placeholder={t('floorPlan.roomNamePh')}
            onChange={(e) => setNouvelleSalle((s) => ({ ...s, name: e.target.value }))} />
          <div className="fp-types">
            {AREAS.map((a) => (
              <button type="button" key={a} className={`chip${nouvelleSalle.kind === a ? ' active' : ''}`} onClick={() => setNouvelleSalle((s) => ({ ...s, kind: a }))}>{AREA_ICONS[a]} {areaLabel(t, a)}</button>
            ))}
          </div>
          <div className="fp-actions">
            <button type="submit" className="btn-teal" disabled={enCours === 'salle'}>{enCours === 'salle' ? '…' : t('floorPlan.createRoom')}</button>
            <button type="button" className="btn-ghost" onClick={() => setNouvelleSalle(null)}>{t('floorPlan.cancel')}</button>
          </div>
        </form>
      )}
    </div>
  );

  return (
    <div className={`fp${mode === 'live' ? ' fp-direct' : ''}${assigner ? ' fp-assigner' : ''}`} style={{ '--fp-zoom': zoom / 100 }}>
      <div className="fp-barre">
        {!assigner && (
          <div className="resa-bascule" role="group" aria-label={t('floorPlan.ariaMode')}>
            <button type="button" className={edit ? 'actif' : ''} onClick={() => { setMode('edit'); deselectionner(); }}>{t('floorPlan.modeEdit')}</button>
            <button type="button" className={mode === 'live' ? 'actif' : ''} onClick={() => { setMode('live'); deselectionner(); setCreation(null); }}>{t('floorPlan.modeLive')}</button>
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
        {edit && (
          <>
            <button type="button" className="btn-outline" style={{ padding: '6px 10px', fontSize: 12 }} disabled={!!enCours} onClick={numeroter}>{t('floorPlan.autoNumber')}</button>
            <button type="button" className="btn-teal" style={{ padding: '6px 12px', fontSize: 12 }} disabled={!modifie || enregistrement} onClick={enregistrerPlan}>
              {enregistrement ? '…' : t('floorPlan.savePlan')}{modifie && !enregistrement && <span className="fp-modifie" aria-label={t('floorPlan.unsaved')} />}
            </button>
          </>
        )}
      </div>

      {edit && modifie && <p className="small" style={{ margin: '0 0 8px', color: 'var(--orange)' }}>{t('floorPlan.unsavedHint')}</p>}
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

      <div className={`fp-corps${(choisie || (elChoisi && edit)) ? ' fp-avec-fiche' : ''}`}>
        <div>
          {panneauCreation}
          {affichees.length === 0 && carteCreation}
          {sallesAff.map((salle) => {
            const dansSalle = affichees.filter((tb) => salleDe(tb)?.id === salle.id);
            const actives = dansSalle.filter((tb) => tb.active);
            const outils = edit && !salle.virtuelle;
            return (
              <section className="fp-zone" key={salle.id} aria-label={salle.name}>
                <div className="fp-zone-tete">
                  {outils && renommage?.id === salle.id ? (
                    <form className="fp-renommer" onSubmit={(e) => { e.preventDefault(); renommerSalle(); }}>
                      <input autoFocus value={renommage.name} maxLength={40} aria-label={t('floorPlan.aiRoomName')}
                        onChange={(e) => setRenommage((r) => ({ ...r, name: e.target.value }))} onBlur={renommerSalle} />
                      <button type="submit" className="btn-teal" aria-label={t('floorPlan.renameRoom')}>✓</button>
                    </form>
                  ) : outils ? (
                    <button type="button" className="fp-salle-nom" title={t('floorPlan.renameRoom')} onClick={() => setRenommage({ id: salle.id, name: salle.name })}>
                      {AREA_ICONS[salle.kind]} {salle.name} <span aria-hidden="true">✏️</span>
                    </button>
                  ) : (
                    <b>{AREA_ICONS[salle.kind]} {salle.name}</b>
                  )}
                  <span className="small">{t('floorPlan.zoneCount', { n: actives.length, seats: actives.reduce((a, tb) => a + (tb.seats || 0), 0) })}</span>
                  {outils && (
                    <span className="fp-salle-actions">
                      <select value={salle.kind} aria-label={t('floorPlan.roomKind')} onChange={(e) => patcherSalle(salle, { kind: e.target.value })}>
                        {AREAS.map((a) => <option key={a} value={a}>{AREA_ICONS[a]} {areaLabel(t, a)}</option>)}
                      </select>
                      <button type="button" className="btn-ghost" title={t('floorPlan.tplForRoom')} aria-label={t('floorPlan.tplForRoom')} onClick={() => ouvrirCreation('modele', salle)}>🧩</button>
                      <button type="button" className="btn-ghost" title={t('floorPlan.deleteRoom')} aria-label={t('floorPlan.deleteRoom')} disabled={!!enCours} onClick={() => supprimerSalle(salle)}>🗑</button>
                    </span>
                  )}
                </div>
                {edit && (
                  <div className="fp-outils" role="toolbar" aria-label={t('floorPlan.addToRoom')}>
                    <button type="button" className="btn-teal" disabled={!!enCours} onClick={() => ajouterTable(salle)}>{t('floorPlan.addTable')}</button>
                    {outils && TYPES_ELEMENT.map((type) => (
                      <button type="button" key={type} className="fp-outil" onClick={() => ajouterElement(salle, type)}>
                        <span aria-hidden="true">{ELEMENT_ICONES[type]}</span> {t(`floorPlan.el_${type}`)}
                      </button>
                    ))}
                  </div>
                )}
                {outils && (
                  <div className="fp-dimensions">
                    <span aria-hidden="true">📐</span>
                    <span className="fp-pas">
                      <button type="button" aria-label={t('floorPlan.narrower')} onClick={() => pasSalle(salle, -0.5, 0)}>−</button>
                      <b title={t('floorPlan.roomWidth')}>{metres(salle.widthM)}</b>
                      <button type="button" aria-label={t('floorPlan.wider')} onClick={() => pasSalle(salle, 0.5, 0)}>+</button>
                    </span>
                    <span aria-hidden="true">×</span>
                    <span className="fp-pas">
                      <button type="button" aria-label={t('floorPlan.shallower')} onClick={() => pasSalle(salle, 0, -0.5)}>−</button>
                      <b title={t('floorPlan.roomDepth')}>{metres(salle.depthM)}</b>
                      <button type="button" aria-label={t('floorPlan.deeper')} onClick={() => pasSalle(salle, 0, 0.5)}>+</button>
                    </span>
                    <span className="small">{t('floorPlan.dimsHint')}</span>
                  </div>
                )}
                <div className="fp-defiler">
                  <div className={`fp-plan${SALLE_CLASSES[salle.kind] || ''}`} style={styleSalle(salle.widthM, salle.depthM)}
                    onPointerDown={edit ? (e) => { if (e.target === e.currentTarget) deselectionner(); } : undefined}
                    onPointerMove={edit ? mouvement : undefined}
                    onPointerUp={edit ? finGlisse : undefined}
                    onPointerCancel={edit ? finGlisse : undefined}>
                    {dansSalle.length === 0 && <div className="fp-vide">{edit ? t('floorPlan.emptyZoneEdit') : t('floorPlan.emptyZone')}</div>}
                    {(salle.elements || []).map((el) => {
                      const sel = edit && selEl?.id === el.id;
                      return (
                        <div key={el.id} className={`fp-el fp-el-${el.type}${sel ? ' fp-sel' : ''}${glisse === el.id ? ' fp-glisse' : ''}`}
                          role={edit ? 'button' : undefined} tabIndex={edit ? 0 : undefined}
                          aria-label={edit ? (el.label || t(`floorPlan.el_${el.type}`)) : undefined}
                          style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.w}%`, height: `${el.h}%`, transform: `rotate(${el.rotation || 0}deg)` }}
                          onPointerDown={edit ? (e) => debutElement(e, salle, el) : undefined}
                          onKeyDown={edit ? (e) => clavierElement(e, salle, el) : undefined}>
                          <ContenuElement el={el} t={t} />
                          {sel && <span className="fp-poignee" aria-hidden="true" onPointerDown={(e) => debutRedimElement(e, salle, el)} />}
                        </div>
                      );
                    })}
                    {dansSalle.map((tb) => {
                      const etat = mode === 'live' ? (occupation?.[tb.id]?.status || (tb.active ? 'free' : 'blocked')) : null;
                      const classes = ['fp-table', `fp-${tb.shape || 'square'}`];
                      if (etat) classes.push(`fp-etat-${etat}`);
                      if (!tb.active) classes.push('fp-inactive');
                      if (tb.joinable && edit) classes.push('fp-accolable');
                      if (selection === tb.id) classes.push('fp-sel');
                      if (modifs[tb.id]) classes.push('fp-dirty');
                      if (glisse === tb.id) classes.push('fp-glisse');
                      return (
                        <div key={tb.id} className={classes.join(' ')} role="button" tabIndex={0}
                          aria-label={t('floorPlan.ariaTable', { n: tb.number ?? '–', name: tb.name, seats: tb.seats })}
                          aria-pressed={selection === tb.id}
                          style={{ left: `${tb.posX || 0}%`, top: `${tb.posY || 0}%`, width: `${tb.width || 10}%`, height: `${tb.height || 10}%`, transform: `rotate(${tb.rotation || 0}deg)` }}
                          onPointerDown={edit ? (e) => debutTable(e, tb) : undefined}
                          onClick={mode === 'live' ? () => appui(tb) : undefined}
                          onKeyDown={(e) => clavier(e, tb)}>
                          <b>{tb.number ?? '–'}</b>
                          <span>{tb.name}</span>
                          <small>{tb.seats} 👤</small>
                          {tb.onlineBookable === false && <span className="fp-hors-ligne" title={t('floorPlan.notOnlineShort')} aria-label={t('floorPlan.notOnlineShort')}>📞</span>}
                          {edit && selection === tb.id && <span className="fp-poignee" aria-hidden="true" onPointerDown={(e) => debutRedimTable(e, tb)} />}
                        </div>
                      );
                    })}
                    {outils && <span className="fp-plan-poignee" title={t('floorPlan.resizeRoom')} aria-hidden="true" onPointerDown={(e) => debutSalle(e, salle)}>↘</span>}
                  </div>
                </div>
              </section>
            );
          })}
          {affichees.length > 0 && carteCreation}
        </div>

        {choisie && edit && (
          <FicheTable key={choisie.id} tb={choisie} salle={salleDe(choisie)} salles={sallesAff} acompteActif={acompteActif} enCours={enCours}
            onFermer={() => setSelection(null)}
            onPlan={(champs) => poser(choisie.id, champs)}
            onModifier={(champs) => modifierTable(choisie, champs)}
            onDupliquer={() => dupliquer(choisie)}
            onSupprimer={() => supprimer(choisie)} />
        )}
        {elChoisi && edit && !choisie && (
          <FicheElement key={elChoisi.id} el={elChoisi} salle={salleElChoisi}
            onFermer={() => setSelEl(null)}
            onPoser={(champs) => poserElement(salleElChoisi.id, elChoisi.id, champs)}
            onDupliquer={() => dupliquerElement(salleElChoisi, elChoisi)}
            onSupprimer={() => supprimerElement(salleElChoisi, elChoisi)} />
        )}
        {choisie && mode === 'live' && (
          <FicheOccupation tb={choisie} salle={salleDe(choisie)} etat={occupation?.[choisie.id] || null} onFermer={() => setSelection(null)}
            onOccuper={(minutes) => actionTable(choisie, '/walk-in', { occupied: true, minutes })}
            onLiberer={() => actionTable(choisie, '/walk-in', { occupied: false })}
            onEnLigne={(v) => actionTable(choisie, '', { onlineBookable: v })} />
        )}
      </div>
      <ConfirmDialog open={!!confirmation} danger={confirmation?.type !== 'num'}
        title={confirmation?.type === 'suppr' ? t('floorPlan.confirmDeleteTitle') : confirmation?.type === 'salle' ? t('floorPlan.confirmDeleteRoomTitle') : t('floorPlan.confirmAutoNumberTitle')}
        message={confirmation?.type === 'suppr' ? t('floorPlan.confirmDelete', { name: confirmation.tb?.name || '' }) : confirmation?.type === 'salle' ? t('floorPlan.confirmDeleteRoom', { name: confirmation.salle?.name || '' }) : t('floorPlan.confirmAutoNumber')}
        confirmLabel={confirmation?.type === 'suppr' ? t('floorPlan.delete') : confirmation?.type === 'salle' ? t('floorPlan.deleteRoom') : t('floorPlan.autoNumber')}
        loading={!!enCours}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => (confirmation?.type === 'suppr' ? supprimer(confirmation.tb) : confirmation?.type === 'salle' ? supprimerSalle(confirmation.salle) : numeroter())} />
    </div>
  );
}

function Pas({ valeur, min, max, onChange, id, label }) {
  return (
    <span className="fp-pas">
      <button type="button" aria-label={`${label} −`} onClick={() => onChange(Math.max(min, Number(valeur || 0) - 1))}>−</button>
      <input id={id} type="number" min={min} max={max} value={valeur} onChange={(e) => onChange(e.target.value)} />
      <button type="button" aria-label={`${label} +`} onClick={() => onChange(Math.min(max, Number(valeur || 0) + 1))}>+</button>
    </span>
  );
}

// Volet latéral (panneau du bas sur téléphone) en mode modification : la fiche de la table choisie.
function FicheTable({ tb, salle, salles, acompteActif, enCours, onFermer, onPlan, onModifier, onDupliquer, onSupprimer }) {
  const { t } = useLanguage();
  const [f, setF] = useState({
    number: tb.number ?? '', name: tb.name, seats: tb.seats, roomId: salle.id, shape: tb.shape, joinable: !!tb.joinable,
    minParty: tb.minParty ?? '', maxParty: tb.maxParty ?? '', depositAmount: tb.depositAmount ?? '', notes: tb.notes || '', active: tb.active,
    onlineBookable: tb.onlineBookable !== false
  });
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const change = f.number !== (tb.number ?? '') || f.name !== tb.name || Number(f.seats) !== tb.seats || f.roomId !== salle.id || f.shape !== tb.shape
    || f.joinable !== !!tb.joinable || String(f.minParty) !== String(tb.minParty ?? '') || String(f.maxParty) !== String(tb.maxParty ?? '')
    || String(f.depositAmount) !== String(tb.depositAmount ?? '') || f.notes !== (tb.notes || '') || f.active !== tb.active || f.onlineBookable !== (tb.onlineBookable !== false);
  const ratio = salle.widthM / salle.depthM;
  const largeurCm = Math.round((tb.width || 10) * salle.widthM);
  const profondeurCm = Math.round((tb.height || 10) * salle.depthM);

  async function enregistrer(e) {
    e.preventDefault();
    if (!f.name.trim()) { return; }
    const body = {
      number: f.number === '' ? null : Number(f.number), name: f.name.trim(), seats: Number(f.seats), shape: f.shape,
      joinable: f.joinable, minParty: f.minParty === '' ? null : Number(f.minParty), maxParty: f.maxParty === '' ? null : Number(f.maxParty),
      notes: f.notes, active: f.active, onlineBookable: f.onlineBookable
    };
    if (f.roomId !== salle.id) {
      const cible = salles.find((s) => s.id === f.roomId);
      if (cible?.virtuelle) body.area = cible.kind; else body.roomId = f.roomId;
    }
    if (acompteActif) body.depositAmount = f.depositAmount === '' ? null : Number(f.depositAmount);
    // Changer de forme ajuste la hauteur sur le plan (une ronde ou une carrée se dessinent carrées).
    if (f.shape !== tb.shape) onPlan({ height: hauteurPour(f.shape, tb.width || 10, ratio) });
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
          <Pas id="fp-places" label={t('floorPlan.fSeats')} valeur={f.seats} min={1} max={30} onChange={(v) => setF((s) => ({ ...s, seats: v }))} />
        </div>
        <div className="fp-large">
          <label htmlFor="fp-nom">{t('floorPlan.fName')}</label>
          <input id="fp-nom" value={f.name} onChange={champ('name')} required maxLength={60} />
        </div>
        <div>
          <label htmlFor="fp-salle">{t('floorPlan.fRoom')}</label>
          <select id="fp-salle" value={f.roomId} onChange={champ('roomId')}>
            {salles.map((s) => <option key={s.id} value={s.id}>{AREA_ICONS[s.kind]} {s.name}</option>)}
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
          <label className="fp-case"><input type="checkbox" checked={f.onlineBookable} disabled={!f.active} onChange={champ('onlineBookable')} /><span>🌐 {t('floorPlan.fOnlineBookable')}</span></label>
          <p className="small" style={{ margin: '2px 0 0 24px' }}>{t('floorPlan.onlineBookableHelp')}</p>
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
          <label htmlFor="fp-taille">{tb.shape === 'rect' ? t('floorPlan.fLengthCm', { cm: largeurCm }) : t('floorPlan.fSizeCm', { cm: largeurCm })}</label>
          <input id="fp-taille" type="range" min="40" max="500" step="10" value={clamp(largeurCm, 40, 500)} style={{ padding: 0 }}
            onChange={(e) => {
              const cm = Number(e.target.value);
              const width = clamp(r2(cm / salle.widthM), 1, 80);
              onPlan(tb.shape === 'rect' ? { width, posX: Math.min(tb.posX || 0, 100 - width) } : { width, height: clamp(r2(cm / salle.depthM), 1, 80), posX: Math.min(tb.posX || 0, 100 - width) });
            }} />
        </div>
        {tb.shape === 'rect' && (
          <div className="fp-large">
            <label htmlFor="fp-hauteur">{t('floorPlan.fDepthCm', { cm: profondeurCm })}</label>
            <input id="fp-hauteur" type="range" min="40" max="300" step="10" value={clamp(profondeurCm, 40, 300)} style={{ padding: 0 }}
              onChange={(e) => { const height = clamp(r2(Number(e.target.value) / salle.depthM), 1, 80); onPlan({ height, posY: Math.min(tb.posY || 0, 100 - height) }); }} />
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

// Fiche d'un élément de décor (mur, entrée, comptoir…) : tout est local jusqu'à « Enregistrer le plan ».
function FicheElement({ el, salle, onFermer, onPoser, onDupliquer, onSupprimer }) {
  const { t } = useLanguage();
  const largeurCm = Math.round(el.w * salle.widthM);
  const profondeurCm = Math.round(el.h * salle.depthM);
  const maxL = Math.round(salle.widthM * 100); const maxP = Math.round(salle.depthM * 100);
  return (
    <div className="fp-lateral">
      <h4>
        {ELEMENT_ICONES[el.type]} {el.label || t(`floorPlan.el_${el.type}`)}
        <button type="button" className="btn-ghost" style={{ padding: '2px 8px' }} onClick={onFermer} aria-label={t('floorPlan.close')}>✕</button>
      </h4>
      <div className="fp-champs">
        <div className="fp-large">
          <label htmlFor="fp-el-type">{t('floorPlan.elType')}</label>
          <select id="fp-el-type" value={el.type} onChange={(e) => onPoser({ type: e.target.value })}>
            {TYPES_ELEMENT.map((type) => <option key={type} value={type}>{ELEMENT_ICONES[type]} {t(`floorPlan.el_${type}`)}</option>)}
          </select>
        </div>
        <div className="fp-large">
          <label htmlFor="fp-el-nom">{t('floorPlan.elLabel')}</label>
          <input id="fp-el-nom" value={el.label || ''} maxLength={30} placeholder={t(`floorPlan.el_${el.type}`)} onChange={(e) => onPoser({ label: e.target.value })} />
        </div>
        <div className="fp-large">
          <label htmlFor="fp-el-l">{t('floorPlan.fLengthCm', { cm: largeurCm })}</label>
          <input id="fp-el-l" type="range" min="10" max={maxL} step="10" value={clamp(largeurCm, 10, maxL)} style={{ padding: 0 }}
            onChange={(e) => { const w = clamp(r2(Number(e.target.value) / salle.widthM), 0.5, 100); onPoser({ w, x: Math.min(el.x, 100 - w) }); }} />
        </div>
        <div className="fp-large">
          <label htmlFor="fp-el-p">{t('floorPlan.fDepthCm', { cm: profondeurCm })}</label>
          <input id="fp-el-p" type="range" min="10" max={maxP} step="10" value={clamp(profondeurCm, 10, maxP)} style={{ padding: 0 }}
            onChange={(e) => { const h = clamp(r2(Number(e.target.value) / salle.depthM), 0.5, 100); onPoser({ h, y: Math.min(el.y, 100 - h) }); }} />
        </div>
      </div>
      <div className="fp-actions">
        <button type="button" className="btn-outline" onClick={() => onPoser({ rotation: ((el.rotation || 0) + 90) % 360 })}>{t('floorPlan.rotate')}</button>
        <button type="button" className="btn-outline" onClick={() => onPoser({ rotation: ((el.rotation || 0) + 45) % 360 })}>{t('floorPlan.rotate45')}</button>
        <button type="button" className="btn-outline" onClick={onDupliquer}>{t('floorPlan.duplicate')}</button>
        <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} onClick={onSupprimer}>{t('floorPlan.delete')}</button>
      </div>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('floorPlan.elHint')}</p>
    </div>
  );
}

// Volet latéral en mode occupation : l'état de la table et la réservation en cours / suivante.
const DUREES_OCCUPATION = [60, 90, 120, 180];
function FicheOccupation({ tb, salle, etat, onFermer, onOccuper, onLiberer, onEnLigne }) {
  const { t } = useLanguage();
  const statut = etat?.status || (tb.active ? 'free' : 'blocked');
  const [duree, setDuree] = useState(90);
  const [envoi, setEnvoi] = useState(false);
  const agir = async (fn) => { setEnvoi(true); try { await fn(); } finally { setEnvoi(false); } };
  const enLigne = etat?.onlineBookable ?? tb.onlineBookable !== false;
  const resa = (r, titre) => (
    <div className="fp-resa">
      <span className="small">{titre}</span>
      <b>{r.name || '-'} · {t('floorPlan.nPeople', { n: r.partySize })}</b>
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
        <span className={`fp-etat-pastille ${statut}`} />{t(`floorPlan.status_${statut}`)} · {t('floorPlan.seatsIn', { n: tb.seats, zone: salle?.name || areaLabel(t, tb.area) })}
      </p>
      {etat?.reservation && resa(etat.reservation, t('floorPlan.currentResa'))}
      {etat?.next && resa(etat.next, t('floorPlan.nextResa'))}
      {!etat?.reservation && !etat?.next && statut !== 'blocked' && !etat?.walkIn && <p className="small" style={{ margin: '8px 0 0' }}>{t('floorPlan.noResaLater')}</p>}
      {tb.notes && <p className="small" style={{ margin: '8px 0 0' }}>📝 {tb.notes}</p>}

      {/* Clients arrivés sans réservation : un appui, la table est prise et retirée des créneaux en ligne. */}
      {statut !== 'blocked' && (
        <div className="fp-rapide">
          {etat?.walkIn ? (
            <>
              <p className="small" style={{ margin: '0 0 6px' }}>👥 {t('floorPlan.walkInUntil', { from: heureLocale(etat.walkIn.since), to: heureLocale(etat.walkIn.until) })}</p>
              <button type="button" className="btn-teal btn-block" disabled={envoi} onClick={() => agir(onLiberer)}>✅ {t('floorPlan.freeTable')}</button>
            </>
          ) : !etat?.reservation && (
            <>
              <p className="small" style={{ margin: '0 0 6px' }}><b>{t('floorPlan.walkInTitle')}</b></p>
              <div className="fp-durees" role="radiogroup" aria-label={t('floorPlan.walkInDuration')}>
                {DUREES_OCCUPATION.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={duree === m} className={`chip${duree === m ? ' active' : ''}`} onClick={() => setDuree(m)}>
                    {m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`}
                  </button>
                ))}
              </div>
              <button type="button" className="btn-gold btn-block" disabled={envoi} onClick={() => agir(() => onOccuper(duree))}>👥 {t('floorPlan.markOccupied')}</button>
            </>
          )}
          <label className="fp-case" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={enLigne} disabled={envoi} onChange={(e) => agir(() => onEnLigne(e.target.checked))} />
            <span>🌐 {t('floorPlan.fOnlineBookable')}</span>
          </label>
        </div>
      )}
    </div>
  );
}
