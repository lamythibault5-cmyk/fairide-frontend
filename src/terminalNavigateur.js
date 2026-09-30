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
  config = c;
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* sans stockage */ }
  demarrerTerminalNavigateur();
}
export function oublierTerminalNavigateur() {
  arreter();
  config = null;
  try { localStorage.removeItem(CLE); } catch { /* rien */ }
  majEtat({ actif: false });
}

let minuteries = []; let fluxCtrl = null; let enCours = false; let aRefaire = false;
function arreter() {
  minuteries.forEach(clearInterval); minuteries = [];
  try { fluxCtrl?.abort(); } catch { /* rien */ }
  fluxCtrl = null;
}
const appel = (chemin, opts = {}) => api(chemin, { ...opts, token: config?.token, logoutOn401: false });
function sessionPerdue(e) {
  if (e?.status === 401 || ['TERMINAL_REVOKED', 'TERMINAL_UNKNOWN'].includes(e?.code)) { oublierTerminalNavigateur(); return true; }
  return false;
}

async function battement() {
  if (!config) return;
  const ok = await serviceGoodcomDisponible({ forcer: true });
  const imprimante = ok ? 'ok' : 'printer_offline';
  majEtat({ imprimante });
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
      const r = await fetch(`${API_BASE}/terminal/events`, { headers: { Authorization: `Bearer ${config.token}`, Accept: 'text/event-stream' }, signal: fluxCtrl.signal });
      if (r.status === 401) { oublierTerminalNavigateur(); return; }
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
