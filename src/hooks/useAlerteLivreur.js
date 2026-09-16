import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage, getLocale } from '../context/LanguageContext';
import { playChime } from './useNewOrderAlert';

// Alertes du livreur. Jusqu'ici, une course disponible n'était signalée par RIEN : ni son, ni notification — le
// livreur devait fixer son écran. Même principe que l'alerte du restaurateur (useNewOrderAlert.js), sur ses
// deux moments clés :
//   1. une NOUVELLE course apparaît dans les courses disponibles → carillon, vibration, notification ;
//   2. une course qu'il a prise passe « prête » au restaurant → son distinct, vibration, notification.
// Plus un compteur dans le titre de l'onglet. Onglet fermé ou téléphone en veille : le serveur prend le relais
// par e-mail (course sans livreur depuis quelques minutes, commande prête — voir orderTimeouts.js).
//
// `actif` : compte validé, paiements actifs, pas en pause. Un livreur en pause ne doit pas être dérangé.
// `pret` : au moins un chargement terminé — sans ce drapeau, les courses déjà présentes à l'ouverture de la page
// sonneraient comme si elles venaient d'arriver.
const CLE_SON = 'fairide_driver_alert_sound';
const NOTES_NOUVELLE = [784, 987.77, 1174.66, 1567.98];
const NOTES_PRETE = [1046.5, 1318.51, 1046.5, 1318.51];

function sonActifMemorise() {
  try { return localStorage.getItem(CLE_SON) !== 'off'; } catch { return true; }
}

function vibrer(motif) {
  try { navigator.vibrate?.(motif); } catch { /* non pris en charge */ }
}

export default function useAlerteLivreur({ disponibles, mesCourses, pret, actif }) {
  const { t } = useLanguage();
  const [sonActif, setSonActifEtat] = useState(sonActifMemorise);
  const [permission, setPermission] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const ctxRef = useRef(null);
  const vuesRef = useRef(null); // ids des courses disponibles déjà connues
  const pretesRef = useRef(null); // ids de mes courses déjà vues « prêtes »

  const setSonActif = useCallback((v) => {
    setSonActifEtat(v);
    try { localStorage.setItem(CLE_SON, v ? 'on' : 'off'); } catch { /* sans stockage */ }
  }, []);

  const demanderPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const r = await Notification.requestPermission();
    setPermission(r);
    return r;
  }, []);

  // Contexte audio créé tout de suite, débloqué au premier geste (règle des navigateurs).
  useEffect(() => {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return undefined;
    const ctx = new Ctor();
    ctxRef.current = ctx;
    const debloquer = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    const evts = ['pointerdown', 'keydown', 'touchstart'];
    evts.forEach((e) => window.addEventListener(e, debloquer, { passive: true }));
    return () => {
      evts.forEach((e) => window.removeEventListener(e, debloquer));
      ctxRef.current = null;
      ctx.close().catch(() => {});
    };
  }, []);

  const alerter = useCallback((notes, motifVibration, titre, corps, tag) => {
    const ctx = ctxRef.current;
    if (sonActif && ctx && ctx.state === 'running') { try { playChime(ctx, notes); } catch { /* contexte fermé */ } }
    vibrer(motifVibration);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(titre, { body: corps, icon: '/icons/icon.svg', tag }); } catch { /* refusées entre-temps */ }
    }
  }, [sonActif]);

  // 1. Nouvelles courses disponibles.
  useEffect(() => {
    if (!pret) return;
    const ids = new Set(disponibles.map((o) => o.id));
    const avant = vuesRef.current;
    vuesRef.current = ids;
    if (!avant || !actif) return;
    const nouvelles = disponibles.filter((o) => !avant.has(o.id));
    if (!nouvelles.length) return;
    const o = nouvelles[0];
    const gain = o.driverFee != null ? new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'EUR' }).format(Number(o.driverFee)) : '';
    alerter(
      NOTES_NOUVELLE, [220, 120, 220],
      nouvelles.length > 1 ? t('driverAlert.notifNewMany', { n: nouvelles.length }) : t('driverAlert.notifNewOne', { name: o.restaurantName || '' }),
      nouvelles.length > 1 ? t('driverAlert.notifNewManyBody') : t('driverAlert.notifNewOneBody', { commune: o.commune || '', gain }),
      'fairide-course-disponible'
    );
  }, [disponibles, pret, actif, alerter, t]);

  // 2. Mes courses qui passent « prête ».
  useEffect(() => {
    if (!pret) return;
    const pretes = mesCourses.filter((o) => o.status === 'pret');
    const ids = new Set(pretes.map((o) => o.id));
    const avant = pretesRef.current;
    pretesRef.current = ids;
    if (!avant) return;
    const nouvelles = pretes.filter((o) => !avant.has(o.id));
    if (!nouvelles.length) return;
    alerter(
      NOTES_PRETE, [400, 150, 400],
      t('driverAlert.notifReady', { name: nouvelles[0].restaurantName || '' }),
      t('driverAlert.notifReadyBody'),
      'fairide-course-prete'
    );
  }, [mesCourses, pret, alerter, t]);

  // Rappel sonore toutes les 30 s tant qu'une course prête attend d'être récupérée : le livreur a pu rater le premier.
  const nbPretes = mesCourses.filter((o) => o.status === 'pret').length;
  useEffect(() => {
    if (!nbPretes) return undefined;
    const id = setInterval(() => {
      const ctx = ctxRef.current;
      if (sonActif && ctx && ctx.state === 'running') { try { playChime(ctx, NOTES_PRETE); } catch { /* contexte fermé */ } }
    }, 30000);
    return () => clearInterval(id);
  }, [nbPretes, sonActif]);

  // Compteur dans le titre de l'onglet.
  const baseTitre = useRef(null);
  if (baseTitre.current === null && typeof document !== 'undefined') baseTitre.current = document.title;
  const nbDispo = actif ? disponibles.length : 0;
  useEffect(() => {
    const base = baseTitre.current || 'Fairide';
    if (nbPretes) document.title = `(${nbPretes}) ${t('driverAlert.titleReady')} · ${base}`;
    else if (nbDispo) document.title = `(${nbDispo}) ${t('driverAlert.titleAvailable')} · ${base}`;
    else document.title = base;
    return () => { document.title = base; };
  }, [nbPretes, nbDispo, t]);

  return { sonActif, setSonActif, permission, demanderPermission, nbDispo, nbPretes };
}
