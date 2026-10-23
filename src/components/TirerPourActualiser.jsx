import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';
import { estNatif } from '../natif';
import { mouvementReduit, vibrer } from '../gestes';

/* TIRER POUR ACTUALISER, AVEC LE VÉLO (fondateur, 2026-10-19, audit « Look and feel » 6c). Sur Mes commandes, la liste des
 * commerces, les courses du livreur et les commandes du commerce : en haut de la page, on tire vers le bas ; le bandeau iris
 * s'étire et le vélo lime de la marque avance avec le doigt. Passé le seuil, le libellé change et le téléphone donne une
 * tape franche ; on lâche, le vélo roule en boucle le temps que `onActualiser` (une promesse) revienne, puis tout remonte.
 *
 * App seulement (estNatif, comme tous les gestes : CLAUDE.md « Gestures are app-only ») : sur le site, rien n'est monté et
 * les listes se rafraîchissent déjà seules (sondage, useRevalidation). Le contenu qui descend est le <main> de la page ;
 * la zone iris qui apparaît au-dessus est fixe, sous la barre d'état. Un tirage qui commence dans une feuille ou une
 * fenêtre ouverte (role="dialog") ne compte pas : elles ont leur propre geste (tirer pour fermer).
 * Styles : « Tirer pour actualiser » dans styles.css. */

const SEUIL = 72;      // px tirés (après amorti) pour déclencher
const MAX = 130;       // le bandeau ne s'étire pas plus
const AMORTI = 0.5;    // le doigt va deux fois plus loin que le bandeau, comme un élastique
const TENUE = 56;      // hauteur gardée pendant l'actualisation
const DUREE_MIN = 700; // le vélo fait au moins un tour, même si la réponse est instantanée
const SENS = 10;       // px avant de décider : de côté (une rangée qui défile) ou vers le bas (un tirage)

export default function TirerPourActualiser({ onActualiser }) {
  const natif = estNatif();
  const { t } = useLanguage();
  const repere = useRef(null);
  const zone = useRef(null);
  const appel = useRef(onActualiser);
  appel.current = onActualiser;
  const [etat, setEtat] = useState('repos'); // 'repos' | 'tire' | 'pret' | 'actualise'

  useEffect(() => {
    if (!natif || !repere.current) return undefined;
    const main = repere.current.closest('main');
    const z = zone.current;
    if (!main || !z) return undefined;
    let y0 = null;
    let x0 = 0;
    let engage = false;
    let bloquant = false;
    let p = 0;
    let occupe = false;
    let pret = false;

    const poser = (val, anime) => {
      p = val;
      const transition = anime ? 'transform .45s cubic-bezier(.34, 1.3, .64, 1)' : 'none';
      main.style.transition = transition;
      main.style.transform = p ? `translateY(${p}px)` : '';
      z.style.transition = anime ? 'height .45s cubic-bezier(.34, 1.3, .64, 1)' : 'none';
      z.style.setProperty('--tirer-p', `${p}px`);
      z.style.setProperty('--tirer-o', String(Math.min(1, p / 40)));
      z.style.setProperty('--tirer-velo', `${Math.min(100, (p / SEUIL) * 62)}%`);
    };
    const debut = (e) => {
      if (occupe || e.touches.length !== 1 || window.scrollY > 0) return;
      if (e.target.closest?.('[role="dialog"], .plat-feuille, input, textarea, select')) return;
      y0 = e.touches[0].clientY;
      x0 = e.touches[0].clientX;
      engage = false;
      pret = false;
    };
    const bouge = (e) => {
      if (y0 === null) return;
      // LE SENS SE DÉCIDE SUR LES PREMIERS PIXELS (2026-10-23, app iPhone : glisser de DeliSpice à Maestro dans « À la une »,
      // en haut de la liste, partait en « tirer pour actualiser » au moindre pixel vers le bas). De côté : c'est une rangée
      // qui défile, on laisse faire. Vers le bas : le tirage commence, compté à partir de là.
      if (!engage) {
        const dx = e.touches[0].clientX - x0; const d = e.touches[0].clientY - y0;
        if (Math.abs(dx) > SENS && Math.abs(dx) >= Math.abs(d)) { y0 = null; return; }
        if (d < SENS) { if (d < -SENS) y0 = null; return; }
        engage = true;
        y0 += SENS;
      }
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || window.scrollY > 0) { if (p) poser(0); y0 = dy <= 0 ? y0 : null; return; }
      // On tient le geste : sans ça, iOS ferait rebondir la page en même temps.
      if (e.cancelable) e.preventDefault();
      poser(Math.min(MAX, dy * AMORTI), false);
      const auSeuil = p >= SEUIL;
      if (auSeuil !== pret) { pret = auSeuil; if (auSeuil) vibrer('seuil'); }
      setEtat(auSeuil ? 'pret' : 'tire');
    };
    const fin = async () => {
      if (y0 === null) return;
      y0 = null;
      if (!pret) { poser(0, true); setEtat('repos'); return; }
      occupe = true;
      poser(TENUE, true);
      setEtat('actualise');
      const depuis = Date.now();
      try { await appel.current?.(); } catch { /* la page affiche ses erreurs elle-même */ }
      const reste = DUREE_MIN - (Date.now() - depuis);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      poser(0, true);
      setEtat('repos');
      pret = false;
      setTimeout(() => { occupe = false; }, 450);
    };
    // BLOQUANT SEULEMENT EN HAUT DE PAGE (2026-10-23) : le touchmove non passif (qui empêche iOS de faire rebondir la page et
    // de montrer du blanc) est posé tant que la page est tout en haut, là où un tirage peut commencer, et retiré dès qu'elle a
    // défilé : plus bas, le défilement n'attend pas JavaScript. Posé au toucher même, iOS pouvait l'ignorer pour ce geste-là.
    const suivreHaut = () => {
      const enHaut = window.scrollY <= 0;
      if (enHaut && !bloquant) { window.addEventListener('touchmove', bouge, { passive: false }); bloquant = true; }
      else if (!enHaut && bloquant && y0 === null) { window.removeEventListener('touchmove', bouge); bloquant = false; }
    };
    suivreHaut();
    window.addEventListener('scroll', suivreHaut, { passive: true });
    window.addEventListener('touchstart', debut, { passive: true });
    window.addEventListener('touchend', fin);
    window.addEventListener('touchcancel', fin);
    return () => {
      window.removeEventListener('scroll', suivreHaut);
      window.removeEventListener('touchstart', debut);
      window.removeEventListener('touchmove', bouge);
      window.removeEventListener('touchend', fin);
      window.removeEventListener('touchcancel', fin);
      main.style.transform = ''; main.style.transition = '';
    };
  }, [natif]);

  if (!natif) return null;
  const libelle = etat === 'actualise' ? t('tirer.actualise') : etat === 'pret' ? t('tirer.lacher') : t('tirer.tirer');
  return (
    <>
      <span ref={repere} hidden />
      {createPortal(<div ref={zone} className={`tirer-zone${etat === 'actualise' && !mouvementReduit() ? ' tirer-zone--roule' : ''}`} aria-hidden={etat === 'repos'}>
        <div className="tirer-route">
          <span className="tirer-velo">
            <svg viewBox="-3 5 82 42" width="34" height="17" aria-hidden="true">
              <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
              <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
            </svg>
          </span>
        </div>
        <p className="tirer-libelle" role="status">{etat === 'repos' ? '' : libelle}</p>
      </div>, document.body)}
    </>
  );
}
