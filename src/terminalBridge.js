// Pont vers la coque Android du terminal Fairide (Goodcom GT81H). Dans le terminal, la PWA tourne dans une WebView
// qui expose `window.FairideTerminal` ; partout ailleurs (navigateur, téléphone), cet objet n'existe pas et toutes
// ces fonctions répondent « pas de terminal » sans rien casser.
//
// Contrat attendu de la coque (méthodes synchrones, chaînes JSON, comme toute interface JavaScript Android) :
//   getDeviceInfo()        → '{"serial","model","appVersion","androidVersion","paperColumns","playServices"}'
//   getPrinterStatus()     → '{"status":"ok|paper_out|cover_open|overheat|printer_busy|printer_offline|low_battery|unknown"}'
//   setDeviceToken(token, apiBase)  garde le jeton du terminal (stockage chiffré) et démarre le service d'impression
//   hasDeviceToken()       → 'true' | 'false'
//   clearDeviceToken()     oublie le jeton (terminal retiré du commerce)
// L'impression elle-même ne passe PAS par la page : c'est le service de la coque qui reçoit les jobs du serveur et
// les imprime, même écran éteint. La page ne fait que demander (réimprimer, test) et afficher l'état.
function pont() {
  try { return typeof window !== 'undefined' && window.FairideTerminal ? window.FairideTerminal : null; } catch { return null; }
}
function lireJson(fn) {
  try { const v = fn(); return v ? JSON.parse(v) : null; } catch { return null; }
}

export function dansTerminal() { return !!pont(); }
export function infosAppareil() { const p = pont(); return p?.getDeviceInfo ? lireJson(() => p.getDeviceInfo()) : null; }
export function etatImprimante() { const p = pont(); return p?.getPrinterStatus ? lireJson(() => p.getPrinterStatus())?.status || null : null; }
export function terminalAssocie() { const p = pont(); try { return p?.hasDeviceToken ? String(p.hasDeviceToken()) === 'true' : false; } catch { return false; } }
export function transmettreJeton(token, apiBase) { const p = pont(); if (!p?.setDeviceToken) return false; try { p.setDeviceToken(token, apiBase); return true; } catch { return false; } }
export function oublierJeton() { const p = pont(); try { p?.clearDeviceToken?.(); } catch { /* rien */ } }
