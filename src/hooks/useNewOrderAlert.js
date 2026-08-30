import { useCallback, useEffect, useRef, useState } from 'react';

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
function playChime(ctx) {
  const now = ctx.currentTime;
  [880, 1108.73, 1318.51].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.16;
    // Enveloppe douce : une onde brute qui démarre et s'arrête net produit un "clic" désagréable.
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}

export default function useNewOrderAlert(orders) {
  const [soundEnabled, setSoundEnabledState] = useState(loadSoundPref);
  const [permission, setPermission] = useState(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  );

  const newOrders = orders.filter((o) => o.status === 'nouveau');
  const newCount = newOrders.length;

  const ctxRef = useRef(null);
  const prevCountRef = useRef(null);

  const setSoundEnabled = useCallback((value) => {
    setSoundEnabledState(value);
    try { localStorage.setItem(SOUND_KEY, value ? 'on' : 'off'); } catch { /* stockage indisponible */ }
  }, []);

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
    function unlock() {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume().catch(() => {});
    }
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, unlock, { once: true, passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  const ring = useCallback(() => {
    if (!soundEnabled) return;
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    try { playChime(ctx); } catch { /* contexte audio fermé par le navigateur */ }
  }, [soundEnabled]);

  // Sonne + notifie à chaque NOUVELLE commande, pas à chaque rafraîchissement. prevCountRef démarre à
  // null pour distinguer le tout premier chargement (où l'on ne veut pas sonner pour des commandes
  // déjà présentes avant l'ouverture de la page) d'une vraie arrivée.
  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = newCount;
    if (prev === null || newCount <= prev) return;
    ring();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const arrived = newCount - prev;
      try {
        new Notification(
          arrived > 1 ? `${arrived} nouvelles commandes Fairide` : 'Nouvelle commande Fairide',
          {
            body: 'À accepter ou refuser dans ton tableau de bord.',
            icon: '/icons/icon.svg',
            // Un tag constant remplace la notification précédente au lieu d'en empiler une par sondage.
            tag: 'fairide-new-order'
          }
        );
      } catch { /* notifications refusées entre-temps */ }
    }
  }, [newCount, ring]);

  // Rappel tant que la commande n'est pas traitée : c'est ce qui rattrape le restaurateur parti en
  // cuisine au moment du premier son.
  useEffect(() => {
    if (newCount === 0) return undefined;
    const interval = setInterval(ring, REPEAT_MS);
    return () => clearInterval(interval);
  }, [newCount, ring]);

  // Compteur dans le titre de l'onglet : le seul canal visible quand la page n'est pas au premier plan.
  useEffect(() => {
    const base = 'Fairide';
    document.title = newCount > 0 ? `(${newCount}) Nouvelle${newCount > 1 ? 's' : ''} commande${newCount > 1 ? 's' : ''} — ${base}` : base;
    return () => { document.title = base; };
  }, [newCount]);

  return { newCount, soundEnabled, setSoundEnabled, permission, requestPermission };
}
