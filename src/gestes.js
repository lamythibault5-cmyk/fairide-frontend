// Petits gestes qui rendent l'appli « vivante » sur téléphone (fondateur, 2026-10-01 : « smooth, fluide, original »).
// Tout ici est décoratif : si l'API manque (Safari n'a pas de vibration, vieux navigateurs sans Web Animations) ou si
// l'utilisateur a demandé moins de mouvement (pour les animations ; les vibrations suivent leur propre réglage, voir
// vibrer), rien ne se passe et l'action elle-même n'en dépend jamais.

export function mouvementReduit() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// Comportement de défilement à passer à scrollIntoView / scrollTo : « smooth », sauf si l'utilisateur a demandé moins de
// mouvement. Un `behavior: 'smooth'` écrit en dur passe outre la règle CSS globale de mouvement réduit (styles.css), qui ne
// touche que les animations CSS : onze défilements l'ignoraient (audit du 15/10/2026).
export function defilement() {
  return mouvementReduit() ? 'auto' : 'smooth';
}

// Un « tic » sous le doigt, comme un bouton physique. Dans l'app : le moteur haptique ; sur le site : navigator.vibrate
// (Android seulement, muet ailleurs).
import { estNatif, vibrerNatif } from './natif';

/* UN SENS PAR GESTE, PAS DES MILLISECONDES (2026-10-23, test TestFlight : « je ne sens pas les vibrations » ; suite des
 * sensations nommées du 2026-10-19, audit « Look and feel » 6a). Les appelants passaient des durées (6, 8, 10, 14) : sur
 * l'iPhone, tout ce qui était sous 20 devenait la tape la plus faible du téléphone, perdue dans une coque — 21 des 43
 * vibrations de l'app. On dit maintenant ce que le geste VEUT DIRE, et le téléphone joue sa propre sensation pour ce sens
 * (natif.js → greffon Haptique d'iOS et d'Android, ios/App/App/HaptiquePlugin.swift, android/…/HaptiquePlugin.java) :
 *   'choix'      le cran d'une molette : une lentille (onglets, puces, sections) qui passe sur un élément, un segment ;
 *   'bascule'    un petit contrôle : cœur, interrupteur, − / + ;
 *   'valider'    un toucher qui engage, AU MOMENT DU TOUCHER : Ajouter, Payer, Accepter, Prendre la course, Envoyer ;
 *   'seuil'      un seuil franchi pendant un geste, une lentille qui se pose ;
 *   'pose'       une feuille qui se pose ;
 *   'appuiLong'  un appui long ;
 *   'succes'     la réponse qui confirme : paiement confirmé, commande acceptée, demande envoyée ;
 *   'attention'  ce qui bloque sans être une erreur : option obligatoire manquante, course annulée, commande refusée ;
 *   'erreur'     tout message d'erreur (le toast rouge, ToastContext.jsx), paiement échoué ;
 *   'alerte'     ce qui doit se sentir dans une poche : une course arrive, une course est prête (livreur).
 * Pas de vibration pour un simple toucher d'onglet ni pour un retour par glissement : l'iPhone n'en fait pas là.
 * Les anciennes valeurs (nombres, tableaux, 'selection', 'moyen') sont encore comprises le temps que tous les écrans passent
 * aux sens. Sur le site, chaque sens a son équivalent en millisecondes pour navigator.vibrate (Android seulement).
 * PLUS COUPÉ PAR « RÉDUIRE LES ANIMATIONS » : une vibration n'est pas un mouvement à l'écran, et le réglage « Vibrations du
 * système » de l'iPhone (ou « Retour tactile » d'Android) s'applique de lui-même. Avant, cocher « Réduire les animations »
 * éteignait toutes les vibrations de l'app, celles d'un paiement et des erreurs comprises. */
const MOTIFS_WEB = {
  choix: 4, bascule: 8, valider: 14, seuil: 16, pose: 6, appuiLong: 30,
  succes: [10, 40, 18], attention: [14, 40, 14], erreur: [14, 40, 14, 40, 14], alerte: [220, 120, 220]
};
const ANCIENS = { selection: 'choix', moyen: 'seuil' };

export function sensDe(motif) {
  if (Array.isArray(motif)) return 'succes';
  if (typeof motif === 'number') return motif > 10 ? 'valider' : 'bascule';
  return ANCIENS[motif] || (MOTIFS_WEB[motif] !== undefined ? motif : 'valider');
}

export function vibrer(motif = 'valider') {
  const sens = sensDe(motif);
  // Application native : le moteur haptique (Taptic Engine sur iPhone, où navigator.vibrate n'existe pas).
  if (estNatif()) { vibrerNatif(sens); return; }
  try { navigator.vibrate?.(MOTIFS_WEB[sens]); } catch { /* non pris en charge */ }
}

// Où atterrit un ajout : la pilule du panier si elle est affichée, sinon l'endroit où elle va apparaître
// (centrée au-dessus des onglets sur téléphone, en bas à droite sur ordinateur — voir .panier-pilule).
// Sur la fiche d'un commerce vue sur un ordinateur, le panier vit dans une colonne à droite (PanierColonne.jsx) et la
// pilule est masquée : l'ajout atterrit sur son bouton « Voir le panier » (data-cible-panier), s'il est affiché.
function cibleDuPanier() {
  const colonne = document.querySelector('[data-cible-panier]');
  const rc = colonne?.getBoundingClientRect();
  if (rc && rc.width > 0 && rc.bottom > 0 && rc.top < window.innerHeight) return { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
  const pilule = document.querySelector('.panier-pilule');
  if (pilule && pilule.getClientRects().length) {
    const r = pilule.getBoundingClientRect();
    return { x: r.left + 28, y: r.top + r.height / 2 };
  }
  const large = window.innerWidth > 900;
  return large ? { x: window.innerWidth - 120, y: window.innerHeight - 48 } : { x: window.innerWidth / 2, y: window.innerHeight - 104 };
}

// LE PLAT S'ENVOLE VERS LE PANIER. Une vignette ronde (la photo du plat, ou une pastille lime avec la quantité)
// part du bouton « Ajouter » et décrit une courbe jusqu'au panier, puis la pilule rebondit
// (événement fairide:panier-atterri, écouté par FloatingCart). On voit OÙ est parti ce qu'on vient d'ajouter.
export function envolerVersPanier({ depuis, image, quantite = 1 }) {
  if (!depuis || mouvementReduit() || typeof document === 'undefined') {
    window.dispatchEvent(new Event('fairide:panier-atterri'));
    return;
  }
  const taille = 56;
  const el = document.createElement('div');
  el.className = 'envol-panier';
  el.setAttribute('aria-hidden', 'true');
  if (image) {
    const img = document.createElement('img');
    img.src = image; img.alt = ''; img.decoding = 'async';
    el.appendChild(img);
  } else {
    el.textContent = `+${quantite}`;
  }
  const x0 = depuis.left + depuis.width / 2 - taille / 2;
  const y0 = depuis.top + depuis.height / 2 - taille / 2;
  const { x, y } = cibleDuPanier();
  const dx = x - taille / 2 - x0; const dy = y - taille / 2 - y0;
  el.style.left = `${x0}px`; el.style.top = `${y0}px`;
  document.body.appendChild(el);
  // Une courbe plutôt qu'une ligne droite : la vignette monte un peu avant de plonger, comme lancée.
  const anim = el.animate?.([
    { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(0.9)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.6 }
  ], { duration: 620, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  // Filet de sécurité : un onglet passé en arrière-plan gèle les animations, et `onfinish` ne viendrait qu'au retour —
  // la vignette resterait figée au milieu de l'écran. Quoi qu'il arrive, elle disparaît après 900 ms.
  let fini = false;
  const fin = () => { if (fini) return; fini = true; el.remove(); window.dispatchEvent(new Event('fairide:panier-atterri')); };
  if (anim) anim.onfinish = fin; else fin();
  setTimeout(fin, 900);
}
