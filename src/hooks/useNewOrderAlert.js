import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

// Alerte du restaurateur à l'arrivée d'une commande.
//
// Jusqu'ici, une nouvelle commande n'était signalée par RIEN : ni son, ni notification, ni changement
// visible — seul un rafraîchissement silencieux toutes les 15 s (DashboardLayout.jsx) mettait la liste
// à jour. Un restaurateur qui change d'onglet, verrouille la tablette du comptoir ou laisse l'écran
// s'éteindre ne voyait donc rien, et les navigateurs ralentissent en plus les minuteurs des onglets en
// arrière-plan : même un onglet ouvert mais masqué ne rafraîchit plus de façon fiable.
//
// Ce que couvre ce module (le "premier palier" — aucun backend nécessaire) :
//   1. un son répété tant qu'une commande reste à traiter,
//   2. un compteur dans le titre de l'onglet, visible sans revenir sur la page,
//   3. une notification système via l'API Notification, tant que l'onglet vit encore.
// Ce qu'il ne couvre PAS : l'onglet fermé ou l'appareil en veille. Cela demande un service worker et
// du Web Push (donc des clés VAPID et un stockage des abonnements côté serveur) — voir le TODO n°1
// en tête de GuidePage.jsx.
const SOUND_KEY = 'fairide_new_order_sound';
const SONNERIE_KEY = 'fairide_new_order_ringtone';
const VOLUME_KEY = 'fairide_new_order_volume';
const REPEAT_MS = 15000;

function loadSoundPref() {
  try {
    // Actif par défaut : c'est une alerte de service, l'oubli d'une commande coûte plus cher qu'un son
    // de trop. Le restaurateur peut la couper explicitement.
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

// Carillon synthétisé plutôt qu'un fichier audio : rien à télécharger, rien à héberger, et le son
// fonctionne même hors ligne. Trois notes montantes, assez distinctes du reste des sons d'un comptoir.
export function playChime(ctx, notes = [880, 1108.73, 1318.51], dest = ctx.destination) {
  const now = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    // Enveloppe douce : une onde brute qui démarre et s'arrête net produit un "clic" désagréable.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    osc.connect(gain).connect(dest);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}

// TROIS SONNERIES AU CHOIX (fondateur, 2026-10-01), toutes synthétisées comme le carillon : rien à télécharger.
//   - carillon : les trois notes montantes d'origine, douces ;
//   - cloche   : deux coups de cloche (onde triangle et harmonique), qui portent dans une cuisine bruyante ;
//   - alarme   : deux tons alternés et répétés, pour un comptoir où l'on ne doit RIEN rater.
//   - marimba  : arpège en bois, chaleureux, cinq notes qui montent puis redescendent ;
//   - velo     : la sonnette d'un vélo, deux « dring » — c'est le son de Fairide ;
//   - melodie  : une petite ritournelle de quatre notes, comme un jingle de bonne nouvelle.
export const SONNERIES = ['carillon', 'cloche', 'marimba', 'velo', 'melodie', 'alarme'];
function note(ctx, { freq, start, duree, type = 'sine', volume = 0.22, dest = ctx.destination }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duree);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + duree + 0.02);
}
export function jouerSonnerie(ctx, nom = 'carillon', dest = ctx.destination) {
  const t0 = ctx.currentTime;
  if (nom === 'marimba') {
    [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25].forEach((f, i) => {
      note(ctx, { freq: f, start: t0 + i * 0.11, duree: 0.28, type: 'triangle', volume: 0.3, dest });
      note(ctx, { freq: f * 2, start: t0 + i * 0.11, duree: 0.12, type: 'sine', volume: 0.08, dest });
    });
    return;
  }
  if (nom === 'velo') {
    for (const d of [0, 0.5]) for (let k = 0; k < 8; k++) note(ctx, { freq: k % 2 ? 2793 : 2637, start: t0 + d + k * 0.04, duree: 0.1, type: 'sine', volume: 0.14, dest });
    return;
  }
  if (nom === 'melodie') {
    [[659.25, 0.16], [783.99, 0.16], [880, 0.16], [1318.5, 0.55]].forEach(([f, dur], i) => {
      note(ctx, { freq: f, start: t0 + i * 0.17, duree: dur, type: 'sine', volume: 0.22, dest });
      note(ctx, { freq: f / 2, start: t0 + i * 0.17, duree: dur, type: 'triangle', volume: 0.08, dest });
    });
    return;
  }
  if (nom === 'cloche') {
    for (const decalage of [0, 0.7]) {
      note(ctx, { freq: 784, start: t0 + decalage, duree: 1.1, type: 'triangle', volume: 0.3, dest });
      note(ctx, { freq: 1568, start: t0 + decalage, duree: 0.6, type: 'sine', volume: 0.12, dest });
      note(ctx, { freq: 2352, start: t0 + decalage, duree: 0.35, type: 'sine', volume: 0.06, dest });
    }
    return;
  }
  if (nom === 'alarme') {
    for (let i = 0; i < 6; i++) note(ctx, { freq: i % 2 ? 740 : 988, start: t0 + i * 0.18, duree: 0.16, type: 'square', volume: 0.12, dest });
    return;
  }
  playChime(ctx, undefined, dest);
}
function loadVolume() {
  try { const v = Number(localStorage.getItem(VOLUME_KEY)); return Number.isFinite(v) && v >= 0 && v <= 100 && localStorage.getItem(VOLUME_KEY) !== null ? v : 80; } catch { return 80; }
}
function loadSonnerie() {
  try { const v = localStorage.getItem(SONNERIE_KEY); return SONNERIES.includes(v) ? v : 'carillon'; } catch { return 'carillon'; }
}

// `ready` : le tableau de bord a-t-il terminé au moins un chargement ? Indispensable et pas cosmétique.
// `orders` vaut [] avant la première réponse du serveur, donc l'arrivée des données est vue comme un
// passage de 0 à N — et sans ce drapeau, le carillon et la notification système se déclenchaient à
// CHAQUE ouverture du tableau de bord pour des commandes qui existaient déjà. Une alerte qui crie au
// loup à chaque chargement est pire que pas d'alerte : on apprend à l'ignorer.
export default function useNewOrderAlert(orders, ready) {
  const { t } = useLanguage();
  const toast = useToast();
  const [soundEnabled, setSoundEnabledState] = useState(loadSoundPref);
  const [sonnerie, setSonnerieState] = useState(loadSonnerie);
  // Volume (0 à 100) : un étage de gain commun à toutes les sonneries, réglé depuis la barre d'alerte.
  const [volume, setVolumeState] = useState(loadVolume);
  const gainRef = useRef(null);
  const [permission, setPermission] = useState(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  );

  const newOrders = orders.filter((o) => o.status === 'nouveau' && o.paid);
  const newCount = newOrders.length;

  const ctxRef = useRef(null);
  const prevCountRef = useRef(null);

  const setSoundEnabled = useCallback((value) => {
    setSoundEnabledState(value);
    try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch { /* stockage indisponible */ }
  }, []);

  const setVolume = useCallback((value) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    setVolumeState(v);
    if (gainRef.current) gainRef.current.gain.value = (v / 100) ** 2;
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* stockage indisponible */ }
  }, []);
  const setSonnerie = useCallback((value) => {
    if (!SONNERIES.includes(value)) return;
    setSonnerieState(value);
    try { localStorage.setItem(SONNERIE_KEY, value); } catch { /* stockage indisponible */ }
  }, []);

  // « Tester l'alarme » : joue la sonnerie demandée (ou celle choisie) même son coupé — c'est un geste de
  // l'utilisateur, donc le navigateur autorise le son ; on réveille le contexte audio au passage.
  const testerAlarme = useCallback(async (nom) => {
    const ctx = ctxRef.current;
    if (!ctx) return false;
    try { if (ctx.state === 'suspended') await ctx.resume(); jouerSonnerie(ctx, nom || sonnerie, gainRef.current || ctx.destination); return true; } catch { return false; }
  }, [sonnerie]);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  // Les navigateurs interdisent de produire du son avant une interaction de l'utilisateur : un
  // AudioContext créé au chargement démarre "suspended" et reste muet. On le débloque au premier
  // clic/appui/touche, ce qui arrive de toute façon très vite sur un tableau de bord.
  useEffect(() => {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return undefined;
    // Créé tout de suite, pas au premier clic : sur une tablette de comptoir posée et jamais touchée,
    // l'ancienne version ne créait jamais de contexte et restait donc muette précisément dans le cas
    // d'usage visé. Il démarre "suspended", ce qui est sans effet tant qu'on ne joue rien.
    const ctx = new Ctor();
    ctxRef.current = ctx;
    // Étage de volume : courbe quadratique, plus naturelle à l'oreille qu'une droite.
    const gain = ctx.createGain();
    gain.gain.value = (loadVolume() / 100) ** 2;
    gain.connect(ctx.destination);
    gainRef.current = gain;

    // Les navigateurs interdisent de produire du son avant une interaction : on lève la suspension au
    // premier geste, quel qu'il soit.
    function unlock() {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock));
      // Fermeture explicite : sans elle, chaque remontage du tableau de bord laissait un contexte
      // audio derrière lui, et Chrome refuse d'en ouvrir plus d'environ six par page.
      ctxRef.current = null;
      ctx.close().catch(() => {});
    };
  }, []);

  const ring = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try { jouerSonnerie(ctx, sonnerie, gainRef.current || ctx.destination); } catch { /* contexte audio fermé par le navigateur */ }
  }, [soundEnabled, sonnerie]);

  // Sonne + notifie à chaque NOUVELLE commande, pas à chaque rafraîchissement. prevCountRef démarre à
  // null pour distinguer le tout premier chargement (où l'on ne veut pas sonner pour des commandes
  // déjà présentes avant l'ouverture de la page) d'une vraie arrivée.
  useEffect(() => {
    // Tant que les données ne sont pas chargées, on n'établit aucune référence : le premier VRAI
    // chargement sert de point de départ, et seules les commandes arrivées après déclenchent l'alerte.
    if (!ready) return;
    const prev = prevCountRef.current;
    prevCountRef.current = newCount;
    if (prev === null || newCount <= prev) return;
    ring();

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const arrived = newCount - prev;
      try {
        new Notification(
          arrived > 1 ? t('alertBar.notifTitleMany', { n: arrived }) : t('alertBar.notifTitleOne'),
          {
            body: t('alertBar.notifBody'),
            icon: '/icons/icon.svg',
            // Un tag constant remplace la notification précédente au lieu d'en empiler une par sondage.
            tag: 'fairide-new-order'
          }
        );
      } catch { /* notifications refusées entre-temps */ }
    }
    // `ready` fait partie des dépendances, ce n'est pas une formalité : sans lui, un restaurant sans
    // commande en attente au chargement ne rejouait jamais cet effet au passage de ready à true (le
    // compteur restant à 0), la référence n'était donc jamais posée — et la toute première commande
    // reçue repartait par la branche `prev === null`, sans un son.
  }, [newCount, ring, ready]);

  // Annulation par le client (possible tant que la commande n'est pas acceptée) : on compare les
  // statuts d'un sondage à l'autre. Une commande vue « nouveau » et revue « annule » déclenche un son
  // descendant (distinct du carillon d'arrivée), un toast et une notification système.
  const prevStatusRef = useRef(null);
  useEffect(() => {
    if (!ready) return;
    const prev = prevStatusRef.current;
    const actuel = new Map(orders.map((o) => [o.id, o.status]));
    prevStatusRef.current = actuel;
    if (!prev) return;
    const annulees = orders.filter((o) => o.status === 'annule' && prev.has(o.id) && !['annule', 'refuse'].includes(prev.get(o.id)));
    if (!annulees.length) return;
    const ctx = ctxRef.current;
    if (soundEnabled && ctx && ctx.state === 'running') { try { playChime(ctx, [660, 440], gainRef.current || ctx.destination); } catch { /* contexte fermé */ } }
    toast(annulees.length > 1 ? t('alertBar.cancelToastMany', { n: annulees.length }) : t('alertBar.cancelToastOne', { client: annulees[0].clientName || '' }));
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(t('alertBar.cancelNotifTitle'), { body: t('alertBar.cancelNotifBody'), icon: '/icons/icon.svg', tag: 'fairide-order-cancelled' });
      } catch { /* notifications refusées entre-temps */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, ready]);

  // Rappel tant que la commande n'est pas traitée : c'est ce qui rattrape le restaurateur parti en
  // cuisine au moment du premier son.
  useEffect(() => {
    if (newCount === 0) return undefined;
    const interval = setInterval(ring, REPEAT_MS);
    return () => clearInterval(interval);
  }, [newCount, ring]);

  // Compteur dans le titre de l'onglet : le seul canal visible quand la page n'est pas au premier plan.
  //
  // Le titre de base est CAPTURÉ au montage, pas écrit en dur. Une constante 'Fairide' écrasait le titre
  // complet de la page (voir usePageMeta) pour tout le reste de la session, y compris après le retour à
  // zéro commande — et pouvait entrer en conflit avec la sauvegarde de titre faite à l'impression d'un
  // bon de commande (OrdersPage).
  const baseTitleRef = useRef(null);
  if (baseTitleRef.current === null && typeof document !== 'undefined') baseTitleRef.current = document.title;

  useEffect(() => {
    const base = baseTitleRef.current || 'Fairide';
    document.title = newCount > 0
      ? `(${newCount}) Nouvelle${newCount > 1 ? 's' : ''} commande${newCount > 1 ? 's' : ''}, ${base}`
      : base;
    return () => { document.title = base; };
  }, [newCount]);

  return { newCount, soundEnabled, setSoundEnabled, permission, requestPermission, sonnerie, setSonnerie, testerAlarme, volume, setVolume };
}
