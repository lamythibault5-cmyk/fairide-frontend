// Modèles de salle prêts à l'emploi, décrits en mètres (x, y = coin haut-gauche depuis le mur du fond ; l = largeur,
// p = profondeur). modeleEnPlan() les convertit en % de la salle, le format du plan (FloorPlan.jsx). Une fois appliqué,
// tout se modifie au doigt : tables, places, murs, comptoir, dimensions de la pièce.

const carree = (x, y, seats = 4, cote = 0.9) => ({ shape: 'square', seats, x, y, l: cote, p: cote });
const ronde = (x, y, seats = 2, cote = 0.7) => ({ shape: 'round', seats, x, y, l: cote, p: cote });
const longue = (x, y, seats = 6, l = 1.6, p = 0.8) => ({ shape: 'rect', seats, x, y, l, p });
const el = (type, x, y, l, p, label = '') => ({ type, x, y, l, p, label }); // label : clé floorPlan.*

export const MODELES = [
  {
    id: 'bistrot', icone: '☕', kind: 'inside', widthM: 10, depthM: 7,
    tables: [
      carree(0.7, 2.2, 2, 0.7), carree(0.7, 3.5, 2, 0.7), carree(0.7, 4.8, 2, 0.7),
      carree(2.9, 2.4), carree(4.9, 2.4), carree(2.9, 4.4), carree(4.9, 4.4),
      ronde(8.3, 2.4), ronde(8.3, 4.0)
    ],
    elements: [
      el('kitchen', 0, 0, 2.5, 1.6), el('toilets', 2.7, 0, 1.5, 1.4), el('counter', 6, 0.3, 3.7, 0.8),
      el('bench', 0, 2, 0.5, 3.8), el('window', 0, 6.8, 7, 0.2), el('door', 7.6, 6.6, 1.6, 0.4)
    ]
  },
  {
    id: 'brasserie', icone: '🍺', kind: 'inside', widthM: 16, depthM: 10,
    tables: [
      carree(1, 3), carree(3, 3), carree(5, 3), carree(1, 5), carree(3, 5), carree(5, 5), carree(1, 7), carree(3, 7), carree(5, 7),
      longue(9.8, 3), longue(9.8, 5), longue(9.8, 7),
      carree(13.3, 3, 2, 0.7), carree(13.3, 4.5, 2, 0.7), carree(13.3, 6, 2, 0.7), carree(13.3, 7.5, 2, 0.7)
    ],
    elements: [
      el('kitchen', 0, 0, 4, 1.8), el('toilets', 4.2, 0, 2, 1.8), el('counter', 11, 0.4, 4.6, 0.9), el('column', 7.8, 5.2, 0.5, 0.5),
      el('window', 0, 9.8, 6.8, 0.2), el('door', 7, 9.6, 2, 0.4), el('window', 9.2, 9.8, 6.8, 0.2)
    ]
  },
  {
    id: 'terrasse', icone: '🌤️', kind: 'outside', widthM: 8, depthM: 4,
    tables: [
      ronde(0.9, 1.1), ronde(2.3, 1.1), ronde(4.9, 1.1), ronde(6.3, 1.1),
      ronde(0.9, 2.6), ronde(2.3, 2.6), ronde(3.6, 2.6), ronde(4.9, 2.6), ronde(6.3, 2.6)
    ],
    elements: [
      el('door', 3.2, 0, 1.6, 0.3), el('plant', 0, 0, 0.6, 0.6), el('plant', 7.4, 0, 0.6, 0.6),
      el('plant', 0, 3.4, 0.6, 0.6), el('plant', 7.4, 3.4, 0.6, 0.6)
    ]
  },
  {
    id: 'pizzeria', icone: '🍕', kind: 'inside', widthM: 12, depthM: 8,
    tables: [
      longue(0.8, 3), longue(0.8, 5),
      longue(3.4, 3.2, 8, 2.4, 0.9), longue(3.4, 5.2, 8, 2.4, 0.9),
      carree(7.4, 3), carree(9.6, 3), carree(7.4, 5), carree(9.6, 5)
    ],
    elements: [
      el('kitchen', 0, 0, 4, 2, 'tplLabelOven'), el('counter', 4.3, 0.3, 3, 0.8), el('toilets', 10, 0, 2, 1.6),
      el('window', 0, 7.8, 4.8, 0.2), el('door', 5, 7.6, 2, 0.4), el('window', 7.2, 7.8, 4.8, 0.2)
    ]
  },
  {
    id: 'bar', icone: '🍸', kind: 'bar', widthM: 9, depthM: 6,
    tables: [
      ronde(0.8, 1.8), ronde(2.3, 1.8), ronde(3.8, 1.8),
      carree(6.3, 1.2), carree(6.3, 3),
      ronde(1, 3.7, 4, 0.9), ronde(2.8, 3.7, 4, 0.9), ronde(4.6, 3.7, 4, 0.9)
    ],
    elements: [
      el('counter', 0.3, 0.3, 5, 0.9), el('bench', 8.4, 0.8, 0.5, 3.6), el('plant', 8.3, 5.3, 0.6, 0.6),
      el('door', 3.5, 5.6, 2, 0.4)
    ]
  },
  {
    id: 'banquet', icone: '🥂', kind: 'private', widthM: 8, depthM: 5,
    tables: [longue(1.4, 1.1, 14, 4.8, 1), longue(1.4, 3, 14, 4.8, 1)],
    elements: [el('door', 0, 1.8, 0.4, 1.4), el('counter', 7, 1, 0.8, 3, 'tplLabelBuffet')]
  },
  {
    // Snack / friterie : on commande au comptoir, on mange vite sur des petites tables ou au banc du mur.
    id: 'snack', icone: '🍟', kind: 'inside', widthM: 7, depthM: 5,
    tables: [carree(0.6, 2.6, 2, 0.7), carree(2.0, 2.6, 2, 0.7), carree(3.4, 2.6, 2, 0.7), ronde(5.6, 2.4, 4, 0.9), ronde(5.5, 3.9, 2, 0.6)],
    elements: [
      el('kitchen', 0, 0, 3, 1.5), el('counter', 3.2, 0.3, 3.5, 0.8), el('cash', 6.0, 1.3, 0.8, 0.6),
      el('bench', 0, 2.4, 0.4, 2.2), el('door', 2.8, 4.6, 1.6, 0.4), el('window', 4.8, 4.8, 2.2, 0.2)
    ]
  },
  {
    // Sushi bar : tabourets alignés le long du comptoir du chef, tables de 4 et tables longues derrière.
    id: 'sushi', icone: '🍣', kind: 'inside', widthM: 11, depthM: 7,
    tables: [
      ronde(2.2, 1.6, 1, 0.5), ronde(3.2, 1.6, 1, 0.5), ronde(4.2, 1.6, 1, 0.5), ronde(5.2, 1.6, 1, 0.5), ronde(6.2, 1.6, 1, 0.5), ronde(7.2, 1.6, 1, 0.5), ronde(8.2, 1.6, 1, 0.5),
      carree(1, 3.6), carree(3.2, 3.6), carree(5.4, 3.6), carree(7.6, 3.6),
      longue(1, 5.4, 6), longue(4.4, 5.4, 6), carree(9.4, 5.2, 2, 0.7)
    ],
    elements: [
      el('counter', 2, 0.4, 7, 0.9, 'tplLabelSushi'), el('kitchen', 9.2, 0, 1.8, 1.6), el('toilets', 0, 0, 1.8, 1.4),
      el('door', 8.4, 6.6, 1.6, 0.4), el('window', 0, 6.8, 7, 0.2)
    ]
  },
  {
    // Café / salon de thé : guéridons pour 2, une grande table à partager, banquette contre le mur.
    id: 'cafe', icone: '🫖', kind: 'inside', widthM: 8, depthM: 6,
    tables: [
      ronde(0.8, 2.0), ronde(2.3, 2.0), ronde(3.8, 2.0), ronde(5.3, 2.0),
      ronde(0.8, 3.6), ronde(2.3, 3.6), ronde(3.8, 3.6), ronde(6.6, 2.4, 2, 0.7), ronde(6.6, 4.0, 2, 0.7), carree(3.6, 4.8, 4, 0.9)
    ],
    elements: [
      el('counter', 0.3, 0.3, 3.2, 0.8), el('cash', 3.7, 0.4, 0.7, 0.6), el('kitchen', 6, 0, 2, 1.4), el('bench', 7.5, 2, 0.5, 3.4),
      el('window', 0, 5.8, 5, 0.2), el('door', 5.4, 5.6, 1.6, 0.4), el('plant', 0, 5.2, 0.5, 0.5)
    ]
  },
  {
    // Cantine / self-service : long comptoir de service, caisse en bout, rangées de tables de 8.
    id: 'cantine', icone: '🍽️', kind: 'inside', widthM: 14, depthM: 9,
    tables: [
      longue(0.8, 3.2, 8, 2.4, 0.9), longue(3.8, 3.2, 8, 2.4, 0.9), longue(6.8, 3.2, 8, 2.4, 0.9), longue(9.8, 3.2, 8, 2.4, 0.9),
      longue(0.8, 5.4, 8, 2.4, 0.9), longue(3.8, 5.4, 8, 2.4, 0.9), longue(9.8, 5.4, 8, 2.4, 0.9),
      longue(0.8, 7.2, 8, 2.4, 0.9), longue(3.8, 7.2, 8, 2.4, 0.9), longue(6.8, 7.2, 8, 2.4, 0.9)
    ],
    elements: [
      el('kitchen', 0, 0, 5, 2), el('counter', 5.3, 0.4, 6, 0.9, 'tplLabelSelf'), el('cash', 11.6, 0.5, 0.8, 0.6), el('toilets', 12.4, 0, 1.6, 1.6),
      el('column', 6.9, 5.6, 0.5, 0.5), el('window', 0, 8.8, 9, 0.2), el('door', 9.4, 8.6, 2, 0.4)
    ]
  },
  {
    // Gastronomique : tables espacées, une grande ronde au centre, accueil à l'entrée, pas de comptoir de bar.
    id: 'gastro', icone: '🍷', kind: 'inside', widthM: 12, depthM: 9,
    tables: [
      carree(1.2, 3.2, 2, 0.8), carree(3.6, 3.2, 4, 1), carree(7.4, 3.2, 4, 1), carree(10, 3.2, 2, 0.8),
      carree(1.2, 5.6, 2, 0.8), carree(3.6, 5.6, 4, 1), carree(7.4, 5.6, 4, 1), carree(10, 5.6, 2, 0.8),
      ronde(5.6, 7.0, 6, 1.3)
    ],
    elements: [
      el('kitchen', 0, 0, 3.5, 2), el('toilets', 3.8, 0, 1.6, 1.5), el('counter', 8.5, 0.3, 3.2, 0.8, 'tplLabelWelcome'), el('column', 5.8, 4.4, 0.5, 0.5),
      el('plant', 0, 8.4, 0.6, 0.6), el('plant', 11.4, 8.4, 0.6, 0.6), el('window', 1, 8.8, 4.5, 0.2), el('door', 5.4, 8.6, 1.6, 0.4), el('window', 7.4, 8.8, 3.6, 0.2)
    ]
  },
  {
    // Jardin / cour : tables rondes dispersées, plantes, bar de jardin, accès depuis la salle.
    id: 'jardin', icone: '🌳', kind: 'outside', widthM: 12, depthM: 8,
    tables: [
      ronde(1.4, 1.8, 4, 1), ronde(3.6, 1.4, 4, 1), ronde(2.4, 3.8, 6, 1.3), ronde(5.2, 3.2, 4, 1), ronde(7.2, 1.8, 4, 1),
      ronde(9.6, 2.2, 2, 0.7), ronde(9.6, 3.8, 2, 0.7), ronde(7.4, 4.4, 6, 1.3), ronde(4.6, 5.8, 4, 1), ronde(1.2, 6.0, 2, 0.7), ronde(9.8, 5.8, 4, 1)
    ],
    elements: [
      el('door', 0, 3.2, 0.4, 1.6), el('stairs', 1.2, 0, 1.6, 0.9), el('counter', 8.8, 0.3, 3, 0.8),
      el('plant', 0, 0, 0.7, 0.7), el('plant', 11.3, 0, 0.7, 0.7), el('plant', 0, 7.3, 0.7, 0.7), el('plant', 11.3, 7.3, 0.7, 0.7), el('plant', 5.6, 0, 0.7, 0.7), el('plant', 5.6, 7.3, 0.7, 0.7)
    ]
  },
  {
    // Rooftop : escalier d'accès, bar avec mange-debout, coin lounge avec banquette.
    id: 'rooftop', icone: '🌇', kind: 'outside', widthM: 10, depthM: 6,
    tables: [
      ronde(2.6, 1.8, 2, 0.6), ronde(3.8, 1.8, 2, 0.6), ronde(5.0, 1.8, 2, 0.6), ronde(6.2, 1.8, 2, 0.6),
      carree(1.0, 3.0, 4, 0.9), carree(1.0, 4.6, 4, 0.9), ronde(4.0, 3.6, 4, 1), ronde(6.4, 3.6, 4, 1),
      ronde(8.2, 2.4, 2, 0.7), ronde(8.2, 4.2, 2, 0.7), carree(4.4, 5.0, 2, 0.7)
    ],
    elements: [
      el('stairs', 0, 0, 1.6, 1.2), el('counter', 2.2, 0.3, 4.5, 0.9), el('bench', 0, 2.2, 0.5, 3.4),
      el('plant', 9.3, 0, 0.7, 0.7), el('plant', 9.3, 5.3, 0.7, 0.7)
    ]
  },
  {
    // Mezzanine / salle à l'étage : escalier, petites tables le long des fenêtres, banquette au fond.
    id: 'mezzanine', icone: '🪜', kind: 'inside', widthM: 9, depthM: 6,
    tables: [
      carree(0.6, 2.2, 2, 0.7), carree(2.0, 2.2, 2, 0.7), carree(3.4, 2.2, 2, 0.7), carree(5.6, 2.2, 4, 0.9), carree(7.4, 2.4, 2, 0.7),
      carree(0.8, 4.2, 4, 0.9), carree(2.8, 4.2, 4, 0.9), carree(4.8, 4.2, 4, 0.9), carree(6.8, 4.2, 2, 0.7)
    ],
    elements: [
      el('stairs', 0, 0, 1.8, 1.4), el('toilets', 7.4, 0, 1.6, 1.4), el('bench', 8.5, 2, 0.5, 3.5), el('column', 4.3, 2.8, 0.5, 0.5),
      el('window', 0, 5.8, 8.5, 0.2)
    ]
  },
  {
    // Corner de food court : comptoir de vente et caisse, grandes tables partagées, quelques tables de 2.
    id: 'foodcourt', icone: '🥡', kind: 'inside', widthM: 10, depthM: 7,
    tables: [
      longue(0.8, 2.4, 8, 3, 0.9), longue(4.4, 2.4, 8, 3, 0.9), longue(0.8, 4.4, 8, 3, 0.9), longue(4.4, 4.4, 8, 3, 0.9),
      ronde(8.3, 2.6, 2, 0.7), ronde(8.3, 4.0, 2, 0.7), ronde(8.3, 5.4, 2, 0.7)
    ],
    elements: [
      el('counter', 0.3, 0.3, 5, 0.9, 'tplLabelStand'), el('kitchen', 5.6, 0, 2.4, 1.6), el('cash', 8.4, 0.4, 0.8, 0.6),
      el('plant', 9.3, 6.3, 0.7, 0.7), el('plant', 0, 6.3, 0.7, 0.7), el('door', 4.2, 6.6, 1.6, 0.4)
    ]
  },
  {
    // Séminaire / groupe : tables en U face à l'écran, buffet sur le côté.
    id: 'seminaire', icone: '🖥️', kind: 'private', widthM: 9, depthM: 6,
    tables: [longue(1.4, 1.4, 6, 4.6, 0.8), longue(1.4, 2.4, 3, 0.8, 2.2), longue(5.2, 2.4, 3, 0.8, 2.2), ronde(3.5, 3.4, 2, 0.7)],
    elements: [
      el('door', 0, 2.4, 0.4, 1.4), el('label', 3.4, 0.2, 2.4, 0.5, 'tplLabelScreen'), el('counter', 7.4, 0.4, 1.4, 3, 'tplLabelBuffet'),
      el('window', 0, 5.8, 7, 0.2), el('plant', 8.3, 5.3, 0.7, 0.7)
    ]
  },
  {
    id: 'vierge', icone: '📐', kind: 'inside', widthM: 10, depthM: 6.5,
    tables: [],
    elements: [el('door', 4.2, 6.1, 1.6, 0.4)]
  }
];

const arrondi = (v) => Math.round(v * 100) / 100;

// Modèle (mètres) → plan (% de la salle), prêt pour POST /floor-plan/apply ou l'aperçu.
export function modeleEnPlan(m, t) {
  const W = m.widthM; const D = m.depthM;
  return {
    widthM: W, depthM: D, kind: m.kind,
    tables: m.tables.map((tb) => ({
      shape: tb.shape, seats: tb.seats, rotation: 0,
      posX: arrondi((tb.x / W) * 100), posY: arrondi((tb.y / D) * 100), width: arrondi((tb.l / W) * 100), height: arrondi((tb.p / D) * 100)
    })),
    elements: m.elements.map((e, i) => ({
      id: `${m.id}-${i}`, type: e.type, label: e.label && t ? t('floorPlan.' + e.label) : '', rotation: 0,
      x: arrondi((e.x / W) * 100), y: arrondi((e.y / D) * 100), w: arrondi((e.l / W) * 100), h: arrondi((e.p / D) * 100)
    }))
  };
}

export const couvertsDe = (m) => m.tables.reduce((a, t) => a + t.seats, 0);
