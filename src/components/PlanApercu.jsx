// Éléments de décor du plan de salle (non réservables) et aperçu en lecture seule d'une salle — utilisés par
// FloorPlan.jsx, l'assistant photo et les modèles. Coordonnées en % de la salle (voir floorPlanPhoto.js côté serveur).

export const AREAS = ['inside', 'outside', 'bar', 'private'];
export const AREA_ICONS = { inside: '🏠', outside: '🌤️', bar: '🍸', private: '🔒' };
export function areaLabel(t, area) {
  return t(`floorPlan.area_${AREAS.includes(area) ? area : 'inside'}`);
}

export const TYPES_ELEMENT = ['wall', 'window', 'door', 'counter', 'kitchen', 'toilets', 'plant', 'column', 'stairs', 'cash', 'bench', 'label'];
export const ELEMENT_ICONES = {
  wall: '🧱', window: '🪟', door: '🚪', counter: '🍸', kitchen: '🍳', toilets: '🚻',
  plant: '🪴', column: '⬛', stairs: '🪜', cash: '💳', bench: '🛋️', label: '🏷️'
};
// Taille par défaut d'un nouvel élément, en mètres (largeur × profondeur).
export const ELEMENT_TAILLES_M = {
  wall: [3, 0.2], window: [2, 0.2], door: [1.2, 0.4], counter: [3, 0.8], kitchen: [3, 2], toilets: [1.8, 1.5],
  plant: [0.6, 0.6], column: [0.5, 0.5], stairs: [1.2, 2.5], cash: [1, 0.6], bench: [3, 0.5], label: [2, 0.6]
};
export const SALLE_CLASSES = { inside: '', outside: ' fp-terrasse', bar: ' fp-bar', private: ' fp-prive' };

// Largeur d'affichage d'une salle : une salle de 10 m occupe la largeur du cadre ; 20 m, le double (défilement).
export function styleSalle(widthM, depthM) {
  const w = Number(widthM) || 10; const d = Number(depthM) || 6.25;
  const echelle = Math.min(3, Math.max(0.5, w / 10));
  return {
    width: `calc(${echelle * 100}% * var(--fp-zoom, 1))`,
    aspectRatio: `${w} / ${d}`,
    backgroundSize: `${100 / w}% ${100 / d}%`
  };
}

export function ContenuElement({ el, t }) {
  const texte = el.label || (el.type === 'label' ? '' : t(`floorPlan.el_${el.type}`));
  return (
    <>
      {el.type !== 'wall' && el.type !== 'window' && <i aria-hidden="true">{ELEMENT_ICONES[el.type]}</i>}
      {texte && el.type !== 'wall' && el.type !== 'window' && el.type !== 'column' && el.type !== 'plant' && <span>{texte}</span>}
    </>
  );
}

export default function PlanApercu({ widthM, depthM, kind, tables = [], elements = [], t, vide = '—' }) {
  return (
    <div className="fp-defiler">
      <div className={`fp-plan fp-apercu${SALLE_CLASSES[kind] || ''}`} style={{ ...styleSalle(widthM, depthM), width: '100%' }}>
        {tables.length === 0 && elements.length === 0 && <div className="fp-vide">{vide}</div>}
        {elements.map((e, i) => (
          <div key={e.id || i} className={`fp-el fp-el-${e.type}`} style={{ left: `${e.x}%`, top: `${e.y}%`, width: `${e.w}%`, height: `${e.h}%`, transform: `rotate(${e.rotation || 0}deg)` }}>
            <ContenuElement el={e} t={t} />
          </div>
        ))}
        {tables.map((tb, i) => (
          <div key={i} className={`fp-table fp-${tb.shape}`} style={{ left: `${tb.posX}%`, top: `${tb.posY}%`, width: `${tb.width}%`, height: `${tb.height}%`, transform: `rotate(${tb.rotation || 0}deg)` }}>
            <small>{tb.seats}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
