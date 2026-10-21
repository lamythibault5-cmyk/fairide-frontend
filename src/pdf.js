import { apiDownload, API_BASE } from './api';
import { estNatif, ouvrirPdfBlob, telechargerPdfBlob } from './natif';
import { toastHorsComposant } from './toastGlobal';

// Contrats et documents en PDF (fondateur, 2026-10-08) : on OUVRE le PDF complet (lecteur du navigateur, ou visionneuse du
// téléphone dans l'application), jamais une page d'impression ni de scan ; et on peut l'ENREGISTRER sous un nom lisible.
//
// SAFARI ET LES ERREURS (audit du 19/10, CROSS-08). Le PDF était récupéré, PUIS ouvert par window.open : après un await, hors
// du geste de l'utilisateur, Safari bloque la fenêtre sans un mot (même constat que ouvrirDocument.js) — « Voir le reçu » ne
// faisait rien sur iPhone. On ouvre donc l'onglet TOUT DE SUITE, pendant le toucher, et on y charge le PDF quand il arrive ;
// onglet refusé malgré tout : le PDF est téléchargé. Les erreurs passaient par alert(), que les WebView et les applications
// installées suppriment (même règle que window.confirm, CLAUDE.md) : c'est maintenant le toast. Et le téléchargement passe
// par apiDownload : session expirée renvoyée vers la connexion, « serveur injoignable » traduit au lieu de « Failed to fetch ».
const chemin = (url) => (url.startsWith(API_BASE) ? url.slice(API_BASE.length) : url);

// Erreur de récupération : session expirée (401) et serveur injoignable (pas de statut) gardent le message traduit
// d'apiDownload ; un autre refus prend le message de l'écran appelant.
function signalerEchec(e, messageErreur) {
  const message = e?.status && e.status !== 401 ? (messageErreur || e.message) : e?.message;
  toastHorsComposant(message || messageErreur, 'erreur');
}
// Feuille de partage fermée sans rien choisir : ce n'est pas une erreur.
const annule = (e) => /cancel/i.test(String(e?.message || ''));

export async function ouvrirPdf(url, token, messageErreur) {
  // Sans noopener : avec, window.open rend null et l'onglet ne peut plus recevoir le PDF. Le PDF vient de notre propre
  // serveur, et le lien vers cette page est coupé juste après.
  const onglet = estNatif() ? null : window.open('', '_blank');
  if (onglet) { try { onglet.opener = null; } catch { /* navigateur qui refuse : sans conséquence */ } }
  let blob;
  try { blob = await apiDownload(chemin(url), { token, rendreBlob: true }); } catch (e) {
    // L'onglet vide resterait sinon ouvert sur une page blanche, sans explication.
    if (onglet) onglet.close();
    signalerEchec(e, messageErreur);
    return;
  }
  try {
    if (onglet) {
      const lien = URL.createObjectURL(blob);
      onglet.location.href = lien;
      setTimeout(() => URL.revokeObjectURL(lien), 60000);
    } else if (estNatif()) await ouvrirPdfBlob(blob);
    else await telechargerPdfBlob(blob); // onglet bloqué : le PDF est enregistré plutôt que perdu
  } catch (e) {
    if (!annule(e)) toastHorsComposant(messageErreur || e.message, 'erreur');
  }
}

export async function telechargerPdf(url, token, nom, messageErreur) {
  const sep = url.includes('?') ? '&' : '?';
  let blob;
  try { blob = await apiDownload(chemin(`${url}${sep}download=1`), { token, rendreBlob: true }); } catch (e) { signalerEchec(e, messageErreur); return; }
  try { await telechargerPdfBlob(blob, nom); } catch (e) {
    if (!annule(e)) toastHorsComposant(messageErreur || e.message, 'erreur');
  }
}
