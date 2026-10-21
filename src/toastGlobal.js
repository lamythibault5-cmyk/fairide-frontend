// Toast pour le code hors composant (pdf.js : audit du 19/10, CROSS-08, qui remplace ses alert()). Le ToastProvider
// (context/ToastContext.jsx) s'y inscrit au montage ; avant lui, l'appel ne fait rien. Fichier à part : ToastContext.jsx
// ne doit exporter que des composants et des hooks (rechargement à chaud de Vite).
let toastGlobal = null;

export function inscrireToastGlobal(fn) {
  toastGlobal = fn;
  return () => { if (toastGlobal === fn) toastGlobal = null; };
}

export function toastHorsComposant(msg, ton) {
  if (toastGlobal) toastGlobal(msg, ton);
}
