import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import Icone from './components/Icone';

// L'icône en texte SVG, pour ce qui n'accepte pas un composant React : les marqueurs Leaflet (`L.divIcon({ html })`).
// Rendue une fois par nom et par taille dans un nœud détaché, puis gardée : un marqueur de carte se redessine souvent,
// le rendu ne se fait qu'une fois. À appeler hors du rendu React (dans un effet, comme les cartes le font déjà).
const htmlEnCache = new Map();
export function iconeHtml(nom, taille = 18) {
  const cle = `${nom}:${taille}`;
  if (htmlEnCache.has(cle)) return htmlEnCache.get(cle);
  const noeud = document.createElement('div');
  const racine = createRoot(noeud);
  flushSync(() => racine.render(<Icone nom={nom} taille={taille} />));
  const html = noeud.innerHTML;
  racine.unmount();
  htmlEnCache.set(cle, html);
  return html;
}
