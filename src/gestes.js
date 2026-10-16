// Petits gestes qui rendent l'appli « vivante » sur téléphone (fondateur, 2026-10-01 : « smooth, fluide, original »).
// Tout ici est décoratif : si l'API manque (iOS n'a pas de vibration, vieux navigateurs sans Web Animations) ou si
// l'utilisateur a demandé moins de mouvement, rien ne se passe et l'action elle-même n'en dépend jamais.

export function mouvementReduit() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

// Comportement de défilement à passer à scrollIntoView / scrollTo : « smooth », sauf si l'utilisateur a demandé moins de
// mouvement. Un `behavior: 'smooth'` écrit en dur passe outre la règle CSS globale de mouvement réduit (styles.css), qui ne
// touche que les animations CSS : onze défilements l'ignoraient (audit du 15/10/2026).
export function defilement() {
  return mouvementReduit() ? 'auto' : 'smooth';
}

// Un « tic » sous le doigt, comme un bouton physique. Android seulement ; muet ailleurs.
import { estNatif, vibrerNatif } from './natif';

export function vibrer(motif = 12) {
  if (mouvementReduit()) return;
  // Application native : le moteur haptique (Taptic Engine sur iPhone, où navigator.vibrate n'existe pas).
  if (estNatif()) { vibrerNatif(motif).catch(() => {}); return; }
  try { navigator.vibrate?.(motif); } catch { /* non pris en charge */ }
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
