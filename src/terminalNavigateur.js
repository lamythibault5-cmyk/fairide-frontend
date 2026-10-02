import { api, API_BASE } from './api';
import { imprimerSurGoodcom, serviceGoodcomDisponible } from './goodcomWebPrinter';

// TERMINAL « NAVIGATEUR » : sur un Goodcom, tant que la coque Android n'existe pas, la PWA ouverte dans le navigateur
// joue elle-même le terminal Fairide. Associée au commerce (jeton « ftm_… » gardé sur l'appareil), elle reçoit les
// tickets de la file d'impression (flux temps réel + relecture toutes les 15 s), les imprime par le service
// d'impression Goodcom (goodcomWebPrinter.js) et accuse chaque ticket au serveur. Même logique que le terminal simulé
// (backend scripts/terminal-simule.js) :
//   - un ticket déjà imprimé et re-livré (coupure réseau) n'est pas réimprimé, seulement ré-accusé ;
//   - un incident d'imprimante met TOUTE la file en pause jusqu'au tour suivant (pas de copie 2 avant la copie 1).
// Limite assumée : rien ne s'imprime quand la page est fermée ou l'écran verrouillé — c'est le rôle de la coque Android.
const CLE = 'fairide_terminal_web';
const CLE_IMPRIMES = 'fairide_terminal_web_imprimes';
const lireJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };

let config = lireJson(CLE, null);
let imprimes = new Set(lireJson(CLE_IMPRIMES, []));
let etat = { actif: false, imprimante: 'unknown', dernierTicket: null, derniereErreur: null, enAttente: 0 };
const abonnes = new Set();
const notifier = () => abonnes.forEach((f) => { try { f({ ...etat, config }); } catch { /* rien */ } });
const majEtat = (p) => { etat = { ...etat, ...p }; notifier(); };

export function configTerminalNavigateur() { return config; }
export function abonnerTerminalNavigateur(f) { abonnes.add(f); f({ ...etat, config }); return () => abonnes.delete(f); }

export function associerTerminalNavigateur(c) {
  // Déjà en marche pour un autre compte : on arrête ses boucles et son flux (ouvert avec l'ancien jeton) avant de
  // repartir proprement avec le nouveau.
  if (etat.actif) { arreter(); etat = { ...etat, actif: false }; }
  etat = { ...etat, motif: null, derniereErreur: null };
  config = c;
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* sans stockage */ }
  demarrerTerminalNavigateur();
}
// `motif` : pourquoi le terminal s'est arrêté quand ce n'est pas l'utilisateur qui l'a demandé (compte supprimé,
// terminal retiré depuis un autre appareil ou repris par un autre compte) — la page l'explique au lieu de se taire.
export function oublierTerminalNavigateur(motif = null) {
  arreter();
  config = null;
  try { localStorage.removeItem(CLE); } catch { /* rien */ }
  majEtat({ actif: false, motif });
}
// Déconnecter CE terminal : il se retire lui-même côté serveur avec son propre jeton — quel que soit le compte ouvert
// sur l'appareil —, puis oublie son association. Si le serveur est injoignable, l'appareil oublie quand même.
export async function deconnecterTerminalNavigateur() {
  // On oublie D'ABORD (boucles arrêtées, plus aucune requête ne part), puis on retire le terminal côté serveur : une
  // requête encore en vol ne peut plus transformer cette déconnexion voulue en « terminal retiré » affiché à l'écran.
  const jeton = config?.token;
  oublierTerminalNavigateur();
  if (jeton) await api('/terminal/me', { method: 'DELETE', token: jeton, logoutOn401: false }).catch(() => {});
}

let minuteries = []; let fluxCtrl = null; let enCours = false; let aRefaire = false;
function arreter() {
  minuteries.forEach(clearInterval); minuteries = [];
  try { fluxCtrl?.abort(); } catch { /* rien */ }
  fluxCtrl = null;
}
// Chaque appel retient le jeton avec lequel il est parti : un refus ne vaut que pour CE jeton.
const appel = (chemin, opts = {}) => {
  const jeton = config?.token;
  return api(chemin, { ...opts, token: jeton, logoutOn401: false }).catch((e) => { try { e.jetonTerminal = jeton; } catch { /* erreur non extensible */ } throw e; });
};
function sessionPerdue(e) {
  if (e?.status === 401 || ['TERMINAL_REVOKED', 'TERMINAL_UNKNOWN', 'ACCOUNT_DELETED'].includes(e?.code)) {
    // REPRISE PAR UN AUTRE COMPTE : l'ancien jeton vient d'être retiré et le nouveau est déjà en place. Une requête
    // partie avec l'ancien revient « terminal retiré » — elle ne doit pas effacer la nouvelle association (c'est ce
    // qui arrivait : le terminal se déconnectait à l'instant où on le connectait au nouveau compte).
    if (e?.jetonTerminal && config?.token && e.jetonTerminal !== config.token) return true;
    // Déjà déconnecté (par l'utilisateur) : la réponse tardive d'une requête en vol n'a plus rien à dire.
    if (!config) return true;
    oublierTerminalNavigateur(['TERMINAL_REVOKED', 'TERMINAL_UNKNOWN', 'ACCOUNT_DELETED'].includes(e?.code) ? e.code : 'TERMINAL_REVOKED');
    return true;
  }
  return false;
}

async function battement() {
  if (!config) return;
  const ok = await serviceGoodcomDisponible({ forcer: true });
  const imprimante = ok ? 'ok' : 'printer_offline';
  // L'imprimante revient : on vide la file tout de suite, sans attendre le prochain tour.
  const revenue = ok && etat.imprimante === 'printer_offline';
  majEtat({ imprimante });
  if (revenue) traiterFile();
  try {
    const r = await appel('/terminal/heartbeat', { method: 'POST', body: { appVersion: 'web-1', model: 'Goodcom (navigateur)', printerStatus: imprimante, network: navigator.onLine ? 'online' : 'offline', batteryLevel: etat.batterie ?? undefined } });
    majEtat({ enAttente: r.pendingJobs || 0 });
  } catch (e) { sessionPerdue(e); }
}

export async function traiterFile() {
  if (!config) return;
  if (enCours) { aRefaire = true; return; }
  enCours = true;
  try {
    do {
      aRefaire = false;
      const { jobs } = await appel('/terminal/jobs');
      for (const job of jobs || []) {
        if (imprimes.has(job.id)) { await appel(`/terminal/jobs/${job.id}/ack`, { method: 'POST', body: { status: 'printed' } }); continue; }
        try {
          await imprimerSurGoodcom(job.lines, job.columns || 32);
          imprimes.add(job.id);
          try { localStorage.setItem(CLE_IMPRIMES, JSON.stringify([...imprimes].slice(-300))); } catch { /* rien */ }
          await appel(`/terminal/jobs/${job.id}/ack`, { method: 'POST', body: { status: 'printed', renderedText: job.text } });
          majEtat({ dernierTicket: new Date().toISOString(), derniereErreur: null, imprimante: 'ok' });
        } catch (e) {
          const code = e.code || 'unknown';
          await appel(`/terminal/jobs/${job.id}/ack`, { method: 'POST', body: { status: 'failed', errorCode: code, error: e.message } }).catch(() => {});
          majEtat({ derniereErreur: code, imprimante: code === 'printer_offline' ? 'printer_offline' : etat.imprimante });
          // Le serveur apprend la panne tout de suite, sans attendre le battement de la minute : l'écran du commerce (et le
          // banc d'essai) affichait encore « imprimante prête » alors qu'un ticket attendait.
          if (code === 'printer_offline') appel('/terminal/heartbeat', { method: 'POST', body: { appVersion: 'web-1', model: 'Goodcom (navigateur)', printerStatus: 'printer_offline', network: navigator.onLine ? 'online' : 'offline' } }).catch(() => {});
          break; // imprimante en difficulté : le reste de la file attend le tour suivant
        }
      }
    } while (aRefaire);
  } catch (e) { sessionPerdue(e); } finally { enCours = false; }
}

// Flux SSE lu avec fetch (EventSource ne sait pas envoyer l'en-tête Authorization).
async function ecouter() {
  let attente = 1000;
  while (config) {
    fluxCtrl = new AbortController();
    try {
      const jetonFlux = config.token;
      const r = await fetch(`${API_BASE}/terminal/events`, { headers: { Authorization: `Bearer ${jetonFlux}`, Accept: 'text/event-stream' }, signal: fluxCtrl.signal });
      if (r.status === 401) {
        // Même règle que sessionPerdue : si le jeton a changé entre-temps (reprise), on se reconnecte avec le nouveau.
        if (!config) return;
        if (config.token !== jetonFlux) continue;
        const corps = await r.json().catch(() => ({})); oublierTerminalNavigateur(corps.code || 'TERMINAL_REVOKED'); return;
      }
      if (!r.ok || !r.body) throw new Error(`flux ${r.status}`);
      attente = 1000;
      const lecteur = r.body.getReader(); const dec = new TextDecoder(); let tampon = '';
      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) throw new Error('flux fermé');
        tampon += dec.decode(value, { stream: true });
        let i;
        while ((i = tampon.indexOf('\n\n')) >= 0) {
          const bloc = tampon.slice(0, i); tampon = tampon.slice(i + 2);
          if (/^event: /m.test(bloc)) traiterFile();
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError' || !config) return;
      await new Promise((res) => setTimeout(res, attente));
      attente = Math.min(30000, attente * 2);
      traiterFile();
    }
  }
}

export function demarrerTerminalNavigateur() {
  if (!config || etat.actif) return;
  majEtat({ actif: true });
  battement(); traiterFile();
  minuteries.push(setInterval(battement, 60000), setInterval(traiterFile, 15000));
  ecouter();
  // La batterie, si le navigateur la donne (Chrome Android).
  navigator.getBattery?.().then((b) => { const maj = () => { etat.batterie = Math.round(b.level * 100); }; maj(); b.addEventListener?.('levelchange', maj); }).catch(() => {});
}
