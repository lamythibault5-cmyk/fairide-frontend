import { Fragment } from 'react';
import { TRACES } from './components/Icone';

// L'icône en texte SVG, pour ce qui n'accepte pas un composant React : les marqueurs Leaflet (`L.divIcon({ html })`).
//
// ÉCRITE EN TEXTE, PLUS RENDUE PAR REACT (2026-10-17). Elle passait par createRoot + flushSync dans un nœud détaché ; React
// refuse ce rendu forcé quand il est lui-même en train de valider une mise à jour — donc depuis un effet. La carte du
// livreur fabrique l'icône de son prochain arrêt dans un effet : la console affichait trois erreurs React (« flushSync was
// called from inside a lifecycle method »…) et la pastille pouvait rester vide (relevé par la vérification automatique de
// toutes les pages). Les tracés d'Icone.jsx ne sont que des <path>, <circle> et <rect> aux attributs simples : on les écrit
// directement en texte, avec le même cadre <svg> qu'Icone. Plus de React ici, donc appelable n'importe quand.
const htmlEnCache = new Map();

const nomAttribut = (k) => (k === 'className' ? 'class' : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
const echapper = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function enTexte(noeud) {
  if (noeud == null || typeof noeud === 'boolean') return '';
  if (Array.isArray(noeud)) return noeud.map(enTexte).join('');
  if (typeof noeud === 'string' || typeof noeud === 'number') return echapper(noeud);
  if (noeud.type === Fragment) return enTexte(noeud.props.children);
  if (typeof noeud.type === 'string') {
    const { children, ...attributs } = noeud.props || {};
    const a = Object.entries(attributs)
      .filter(([, v]) => v != null && v !== false)
      .map(([k, v]) => ` ${nomAttribut(k)}="${echapper(v)}"`).join('');
    return `<${noeud.type}${a}>${enTexte(children)}</${noeud.type}>`;
  }
  return '';
}

export function iconeHtml(nom, taille = 18) {
  const cle = `${nom}:${taille}`;
  if (htmlEnCache.has(cle)) return htmlEnCache.get(cle);
  const trace = TRACES[nom];
  // Un nom inconnu ne dessine rien, comme <Icone> : jamais une raison de casser la carte.
  const html = trace
    ? `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${enTexte(trace)}</svg>`
    : '';
  htmlEnCache.set(cle, html);
  return html;
}
