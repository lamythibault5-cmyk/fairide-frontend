import { useEffect, useRef, useState } from 'react';
import Icone from '../Icone';
import { estNatif } from '../../natif';
import { mouvementReduit, vibrer } from '../../gestes';
import '../../ecran-commerce.css';

const NATIF = estNatif();
// Largeur de l'action révélée sous la rangée (assez pour « Verwijderen », le plus long des trois libellés).
const LARGEUR = 112;

/* UNE RANGÉE QU'ON SUPPRIME (fondateur, 2026-10-19, finitions-appli.html › Promotions : « Swipe on a row to delete it ») :
 * dans l'APPLICATION NATIVE, on la glisse vers la gauche et « Supprimer » apparaît dessous ; sur le site (et le site posé
 * sur l'écran d'accueil), un petit × visible au bout de la rangée. Les deux ne font qu'appeler `onSupprimer` : la page
 * ouvre ensuite sa ConfirmDialog, jamais window.confirm.
 *
 * Le geste suit la règle du CLAUDE.md (« Gestures are app-only ») : ressort.js n'est chargé, avec import(), que si
 * estNatif() ; le site ne télécharge rien de plus. On ne prend la main qu'une fois le doigt parti à l'horizontale (8 px,
 * plus large que haut) : un défilement vertical commencé sur la rangée reste un défilement (touch-action: pan-y). Au
 * lâcher, on décide d'après l'élan projeté, comme GlisserPourConfirmer : un coup sec suffit.
 *
 * Accessibilité : le bouton caché sous la rangée reste un vrai bouton. Un lecteur d'écran (qui ne glisse pas) le trouve
 * dans l'ordre de lecture, et le focus clavier ouvre la rangée pour qu'on le voie. */
export default function LigneGlissante({ children, onSupprimer, libelle, disabled = false, className = '' }) {
  const contenu = useRef(null);
  const geste = useRef(null);
  const ressortMod = useRef(null);
  const anim = useRef(null);
  const position = useRef(0);
  const clicAvale = useRef(false);
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    if (NATIF && !mouvementReduit()) import('../../ressort').then((m) => { ressortMod.current = m; }).catch(() => {});
    return () => anim.current?.arreter();
  }, []);

  if (!NATIF) {
    return (
      <div className={`ec-ligne ${className}`}>
        {children}
        <button type="button" className="ec-ligne-suppr" aria-label={libelle} title={libelle} disabled={disabled} onClick={onSupprimer}>
          <Icone nom="croix" taille={16} />
        </button>
      </div>
    );
  }

  function poser(x) {
    position.current = x;
    if (contenu.current) contenu.current.style.transform = x ? `translateX(${x}px)` : '';
  }
  function aller(cible, vitesse = 0) {
    anim.current?.arreter();
    const m = ressortMod.current;
    if (m) anim.current = m.ressort({ de: position.current, vers: cible, vitesse, amortissement: 0.9, reponse: 0.3, surImage: poser });
    else poser(cible);
    setOuverte(cible !== 0);
  }

  function debut(e) {
    if (disabled) return;
    anim.current?.arreter();
    geste.current = { x0: e.clientX, y0: e.clientY, depart: position.current, sens: null, id: e.pointerId, suivi: ressortMod.current?.suiviVitesse() };
  }
  function suite(e) {
    const g = geste.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.sens) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.sens = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (g.sens === 'v') { geste.current = null; return; }
      e.currentTarget.setPointerCapture(g.id);
    }
    g.suivi?.ajouter(e.clientX);
    const m = ressortMod.current;
    let x = g.depart + dx;
    // Au-delà des bords (vers la droite, ou plus loin que l'action), la rangée résiste au lieu de s'arrêter net.
    if (x > 0) x = m ? m.elastique(x, LARGEUR) : 0;
    else if (x < -LARGEUR) x = -LARGEUR + (m ? m.elastique(x + LARGEUR, LARGEUR) : 0);
    poser(x);
  }
  function finir() {
    const g = geste.current;
    geste.current = null;
    if (!g || g.sens !== 'h') return;
    // Le doigt a glissé : le clic qui suit le lâcher ne doit pas basculer l'interrupteur de la rangée.
    clicAvale.current = true;
    setTimeout(() => { clicAvale.current = false; }, 0);
    const m = ressortMod.current;
    const v = g.suivi ? g.suivi.vitesse() : 0;
    const ouvrir = position.current + (m ? m.projeter(v) : 0) < -LARGEUR / 2;
    if (ouvrir && !ouverte) vibrer(8);
    aller(ouvrir ? -LARGEUR : 0, v);
  }
  // Rangée ouverte : un appui dessus la referme, sans rien déclencher d'autre.
  function clic(e) {
    if (clicAvale.current || ouverte) { e.preventDefault(); e.stopPropagation(); }
    if (ouverte && !clicAvale.current) aller(0);
  }

  return (
    <div className={`ec-glisse${ouverte ? ' est-ouverte' : ''}`}>
      {/* Ouverte au focus CLAVIER seulement (:focus-visible) : le doigt qui touche le bouton le focalise aussi, et la
          rangée, refermée par le clic, se rouvrait aussitôt derrière la confirmation. */}
      <button type="button" className="ec-glisse-action" disabled={disabled}
        onFocus={(e) => { if (!ouverte && e.currentTarget.matches(':focus-visible')) aller(-LARGEUR); }}
        onClick={() => { aller(0); onSupprimer(); }}>
        {libelle}
      </button>
      <div ref={contenu} className={`ec-ligne ec-glisse-contenu ${className}`} onPointerDown={debut} onPointerMove={suite}
        onPointerUp={finir} onPointerCancel={finir} onClickCapture={clic}>
        {children}
      </div>
    </div>
  );
}
