import { useEffect, useRef, useState } from 'react';

/* Graphique en colonnes, UNE série, en SVG dessiné à la main (pas de bibliothèque de graphiques dans ce projet).
 *
 * Règles suivies (skill dataviz) : une seule couleur, l'iris de la marque, donc pas de légende (le titre dit ce qui est
 * tracé) ; colonnes de 24 px au plus, bout arrondi de 4 px côté valeur, carré sur la ligne de base, 2 px d'air entre deux
 * colonnes ; grille et axes en filets d'un pixel, discrets ; textes en encre, jamais dans la couleur des données ; chaque
 * colonne est sa propre cible de survol ET de focus clavier, plus large que la colonne peinte, avec une bulle « valeur
 * d'abord, libellé ensuite » ; et toujours une vue en tableau, pour que rien ne dépende du survol.
 * Le dessin suit la largeur réelle du conteneur (ResizeObserver) : un viewBox étiré déformerait les textes.
 *
 * 2026-10-16 (Statistiques au bandeau iris) : les colonnes POUSSENT à l'affichage, l'une après l'autre (.gb-barre, animée
 * dans ecran-commerce.css sous .ec-graphique), et TOUCHER une colonne garde sa bulle ouverte — au doigt, le survol
 * disparaissait dès qu'on levait le doigt. Toucher de nouveau la referme. */
const HAUTEUR_AXE_X = 22;
const MARGE_GAUCHE = 34;

// `entier` : un compte (commandes) n'a pas de graduation « 0,5 » — le pas vaut au moins 1 (audit du 19/10, shop-125).
function graduations(max, entier = false) {
  if (max <= 0) return [0, 1];
  const brut = [1, 2, 5].map((m) => m * 10 ** Math.floor(Math.log10(max / 2))).find((p) => max / p <= 3) || 10 ** Math.ceil(Math.log10(max));
  const pas = entier ? Math.max(1, brut) : brut;
  const haut = Math.ceil(max / pas) * pas;
  const t = [];
  for (let v = 0; v <= haut + 1e-9; v += pas) t.push(+v.toFixed(6));
  return t;
}

export default function GraphiqueBarres({ titre, donnees, formatValeur = (v) => String(v), formatAxe = formatValeur, hauteur = 180, libelleTableau, colonneValeur, entier = false }) {
  const boite = useRef(null);
  const [largeur, setLargeur] = useState(0);
  const [survol, setSurvol] = useState(null);
  const [touche, setTouche] = useState(null);
  useEffect(() => {
    const el = boite.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setLargeur(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(0, ...donnees.map((d) => d.valeur));
  const ticks = graduations(max, entier);
  const haut = ticks[ticks.length - 1] || 1;
  const zone = Math.max(0, largeur - MARGE_GAUCHE);
  const fente = donnees.length ? zone / donnees.length : 0;
  const epaisseur = Math.max(2, Math.min(24, fente - 2));
  const hTrace = hauteur - HAUTEUR_AXE_X;
  const y = (v) => hTrace - (v / haut) * (hTrace - 8);
  // Un libellé d'axe X sur n, pour qu'ils ne se chevauchent pas (environ 44 px chacun).
  const tousLes = Math.max(1, Math.ceil(44 / Math.max(1, fente)));
  const iActif = survol ?? (touche !== null && touche < donnees.length ? touche : null);
  const actif = iActif !== null ? donnees[iActif] : null;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontWeight: 700, marginBottom: 6 }}>{titre}</figcaption>
      <div ref={boite} style={{ position: 'relative', width: '100%', height: hauteur }}>
        {largeur > 0 && (
          <svg width={largeur} height={hauteur} role="img" aria-label={titre} style={{ display: 'block', overflow: 'visible' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={MARGE_GAUCHE} x2={largeur} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={MARGE_GAUCHE - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--ink-soft)" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatAxe(t)}</text>
              </g>
            ))}
            {donnees.map((d, i) => {
              const cx = MARGE_GAUCHE + i * fente + fente / 2;
              const x0 = cx - epaisseur / 2;
              const h = hTrace - y(d.valeur);
              const r = Math.min(4, epaisseur / 2, h);
              const yTop = y(d.valeur);
              // Bout arrondi en haut, carré sur la ligne de base.
              const chemin = h <= 0 ? '' : `M${x0},${hTrace} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + epaisseur - r} Q${x0 + epaisseur},${yTop} ${x0 + epaisseur},${yTop + r} V${hTrace} Z`;
              return (
                <g key={d.cle}>
                  {chemin && <path className="gb-barre" style={{ '--i': i }} d={chemin} fill="var(--iris)" opacity={iActif === null || iActif === i ? 1 : 0.55} />}
                  {i % tousLes === 0 && (
                    <text x={cx} y={hauteur - 6} textAnchor="middle" fontSize="11" fill="var(--ink-soft)">{d.court || d.libelle}</text>
                  )}
                  {/* Cible de survol et de focus : toute la fente, sur toute la hauteur. */}
                  <rect x={MARGE_GAUCHE + i * fente} y={0} width={Math.max(fente, 1)} height={hTrace} fill="transparent"
                    tabIndex={0} aria-label={`${d.libelle} : ${formatValeur(d.valeur)}`}
                    onPointerEnter={(e) => { if (e.pointerType === 'mouse') setSurvol(i); }} onPointerLeave={() => setSurvol(null)}
                    onClick={() => setTouche((v) => (v === i ? null : i))}
                    onFocus={(e) => { if (e.target.matches?.(':focus-visible')) setSurvol(i); }} onBlur={() => setSurvol(null)} style={{ outline: 'none', cursor: 'pointer' }} />
                </g>
              );
            })}
            <line x1={MARGE_GAUCHE} x2={largeur} y1={hTrace} y2={hTrace} stroke="var(--ink-faint)" strokeWidth="1" />
          </svg>
        )}
        {actif && (
          <div role="status" style={{
            position: 'absolute', pointerEvents: 'none', top: Math.max(0, y(actif.valeur) - 52),
            left: Math.min(Math.max(0, MARGE_GAUCHE + iActif * fente + fente / 2 - 70), Math.max(0, largeur - 140)),
            width: 140, background: 'var(--carte)', border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12
          }}>
            <b style={{ display: 'block', fontSize: 14 }}>{formatValeur(actif.valeur)}</b>
            <span style={{ color: 'var(--ink-soft)' }}>{actif.libelle}{actif.detail ? ` · ${actif.detail}` : ''}</span>
          </div>
        )}
      </div>
      <details style={{ marginTop: 6 }}>
        <summary className="small" style={{ cursor: 'pointer' }}>{libelleTableau}</summary>
        <div style={{ overflowX: 'auto' }}>
          <table className="small" style={{ borderCollapse: 'collapse', marginTop: 4 }}>
            <tbody>
              {donnees.map((d) => (
                <tr key={d.cle} style={{ borderTop: '1px solid var(--line)' }}>
                  <th scope="row" style={{ textAlign: 'left', fontWeight: 400, padding: '3px 12px 3px 0' }}>{d.libelle}</th>
                  <td style={{ textAlign: 'right', padding: '3px 0', fontVariantNumeric: 'tabular-nums' }}>{formatValeur(d.valeur)}{d.detail ? ` · ${d.detail}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {colonneValeur && <span className="small" style={{ color: 'var(--ink-soft)' }}>{colonneValeur}</span>}
        </div>
      </details>
    </figure>
  );
}
