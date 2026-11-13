import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NOM_CADRE_APERCU_TEL, messageDeLApercu, signalerAuCadre } from '../../apercuSite';
import { cheminLocalise } from '../../i18n/routing';
import Icone from '../Icone';

/* SUR TÉLÉPHONE, L'APPLI EN VIGNETTE QUI S'OUVRE EN PLEIN ÉCRAN (Owen, 2026-11-13 : version B' de
 * maquettes/site-appli-essai/vignette-b1.html, après vignette-telephone.html et vignette-b.html).
 *
 * Le grand faux téléphone de l'ordinateur ne marchait pas sur un téléphone : presque un écran de haut, et le doigt posé dessus
 * faisait défiler l'appli au lieu de la page. Ici :
 *   - fermée, une petite vignette (~half la largeur) : la VRAIE page des commerces de l'appli (apercuSite.js), réduite, qui ne
 *     prend pas le doigt (inert) : un glissé descend la page, un toucher l'ouvre. Autour, nos dessins gourmands qui flottent
 *     (public/gourmand), et « Voir les restaurants » en lime posé sur son bas (le prochain clic, design.md règle 4) ;
 *   - ouverte, le MÊME cadre grandit depuis sa place jusqu'à tout l'écran (on ne le déplace jamais dans la page : un cadre
 *     déplacé se recharge) et devient l'appli, à sa vraie taille : la pilule Restaurants · Carte à gauche qui se plie en
 *     descendant, et à la place du rond Recherche un rond de verre ✕ qui le referme (DashboardSidebar.jsx). Le bouton retour
 *     du téléphone le referme aussi (une entrée d'historique), comme dans une appli ;
 *   - ouverte, la page dessous est cachée (visibility) et ses animations arrêtées : le cadre partage le fil principal de la
 *     page (même origine), rien d'autre ne lui prend d'image ;
 *   - refermée, elle remontre la page de départ de l'appli (Restaurants, sans filtre, en haut), pas l'endroit où on l'a
 *     quittée (Owen, 2026-11-13) : le cadre y retourne une fois rentré dans la vignette, sans saut sous les yeux.
 * Le cadre a la taille de l'écran du visiteur dès la vignette (réduite par transform) : à l'ouverture, rien ne se remet en
 * page dedans, seule la hauteur s'ajuste si la barre d'adresse du navigateur a bougé. Pas de défilement automatique dans la
 * vignette (celui de la maquette) : il ferait travailler l'appli à chaque image pendant qu'on lit la page. */

// [dessin, côté, écart au bord (px), haut (% de la scène), taille (px), angle (°), durée de flottement (s)] : trois de chaque côté,
// mesurés dans la maquette sur un écran de 390 px. Le côté libre fait ~80 px : ils passent un peu sous la vignette.
const DESSINS = [
  ['pizza', 'g', 2, 8, 64, -10, 5.2], ['sushi', 'g', 20, 39, 50, 8, 6.1], ['belge', 'g', 4, 68, 61, -6, 4.6],
  ['burger', 'd', 7, 4, 59, 9, 5.7], ['mexicain', 'd', 10, 35, 66, -7, 4.9], ['desserts', 'd', 6, 69, 53, 10, 6.6],
];
const BORD = 4; // le cadre noir de la vignette, en px
const RAYON = 24; // ses coins, en px à l'écran
const DUREE = 420; // ms, comme la transition de site-accueil.css

const tailleEcran = () => ({ l: document.documentElement.clientWidth || window.innerWidth, h: window.innerHeight });

export default function VignetteAppli({ t, language }) {
  const scene = useRef(null);
  const boite = useRef(null);
  const cadre = useRef(null);
  const depart = useRef(null);
  const rentre = useRef(false);
  const [ecran, setEcran] = useState(tailleEcran);
  const [largeur, setLargeur] = useState(180);
  // ferme → ouverture (il grandit) → ouvert → fermeture (il rentre) → ferme
  const [phase, setPhase] = useState('ferme');
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // La vignette prend ~la moitié de la scène (190 px au plus) ; le cadre, la largeur de l'écran. Seule une largeur qui change
  // remet le cadre en page : la barre d'adresse qui se montre ou se cache en défilant ne change que la hauteur.
  useLayoutEffect(() => {
    const mesurer = () => {
      if (scene.current) setLargeur(Math.round(Math.min(190, scene.current.clientWidth * 0.52)));
      setEcran((e) => { const n = tailleEcran(); return n.l === e.l ? e : n; });
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, []);
  const echelle = (largeur - 2 * BORD) / ecran.l;

  // Le cadre sait s'il est ouvert : la croix sort de sa barre (GardeApercu.jsx). Aussi quand il vient de (re)charger (« pret »).
  const dire = useCallback(() => signalerAuCadre(cadre.current, { type: 'plein', ouvert: phaseRef.current === 'ouverture' || phaseRef.current === 'ouvert' }), []);
  useEffect(dire, [phase, dire]);

  const ouvrir = useCallback(() => {
    if (phaseRef.current !== 'ferme' || !cadre.current) return;
    const r = cadre.current.getBoundingClientRect();
    depart.current = { x: r.left, y: r.top, s: r.width / cadre.current.offsetWidth };
    try { window.history.pushState({ ...(window.history.state || {}), essaiPlein: true }, ''); } catch { /* sans historique */ }
    setPhase('ouverture');
  }, []);

  const replier = useCallback(() => {
    if (phaseRef.current !== 'ouvert' && phaseRef.current !== 'ouverture') return;
    const f = cadre.current, b = boite.current;
    if (!f || !b) { setPhase('ferme'); return; }
    document.documentElement.classList.remove('sa-essai-cache');
    const r = b.getBoundingClientRect();
    const s = (r.width - 2 * BORD) / f.offsetWidth;
    f.style.transform = `translate(${r.left + BORD}px, ${r.top + BORD}px) scale(${s})`;
    f.style.borderRadius = `${(RAYON - BORD) / s}px`;
    setPhase('fermeture');
  }, []);

  // Le ✕ du cadre ferme par le retour de l'historique (l'entrée ajoutée à l'ouverture) ; le retour du téléphone, pareil.
  const fermer = useCallback(() => {
    if (window.history.state?.essaiPlein) window.history.back();
    else replier();
  }, [replier]);
  useEffect(() => {
    const recevoir = (e) => {
      if (!messageDeLApercu(e)) return;
      if (e.data.type === 'fermer') fermer();
      if (e.data.type === 'pret') dire();
    };
    const retour = () => { if (!window.history.state?.essaiPlein) replier(); };
    window.addEventListener('message', recevoir);
    window.addEventListener('popstate', retour);
    return () => { window.removeEventListener('message', recevoir); window.removeEventListener('popstate', retour); };
  }, [fermer, replier, dire]);

  // Ouverture : le cadre passe en plein écran (position fixed) et on le replace d'abord exactement sur la vignette, puis il
  // grandit (transition CSS sur transform). La page se fige (défilement verrouillé sur <html>, animations arrêtées) ; une
  // fois l'appli à sa taille, la page dessous est cachée.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const f = cadre.current;
    if (phase === 'ouverture' && f && depart.current) {
      html.classList.add('sa-essai-plein');
      const { x, y, s } = depart.current;
      f.style.transition = 'none';
      f.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      f.style.borderRadius = `${(RAYON - BORD) / s}px`;
      f.getBoundingClientRect();
      f.style.transition = '';
      f.style.transform = 'none';
      f.style.borderRadius = '0px';
      const fin = setTimeout(() => { html.classList.add('sa-essai-cache'); setPhase('ouvert'); }, DUREE + 30);
      return () => clearTimeout(fin);
    }
    if (phase === 'fermeture') {
      rentre.current = true;
      const fin = setTimeout(() => setPhase('ferme'), DUREE + 30);
      return () => clearTimeout(fin);
    }
    // Refermé : React remet le style de la vignette (taille de l'écran, réduite) ; sans la classe `plein`, pas de transition.
    // Juste rentré : le cadre retourne à sa page de départ (GardeApercu.jsx).
    if (phase === 'ferme') {
      html.classList.remove('sa-essai-plein', 'sa-essai-cache');
      if (rentre.current) signalerAuCadre(f, { type: 'accueil' });
      rentre.current = false;
    }
    return undefined;
  }, [phase]);
  useEffect(() => () => document.documentElement.classList.remove('sa-essai-plein', 'sa-essai-cache'), []);

  const ouvert = phase !== 'ferme';
  return (
    <div className="sa-vignette-scene" ref={scene}>
      {DESSINS.map(([nom, cote, ecart, haut, taille, angle, duree]) => (
        <img key={nom} className="sa-vignette-dessin" src={`/gourmand/${nom}.webp`} alt="" aria-hidden="true" width={taille} height={taille}
          loading="lazy" decoding="async" draggable="false" onClick={ouvrir}
          style={{ [cote === 'g' ? 'left' : 'right']: ecart, top: `${haut}%`, '--a': `${angle}deg`, '--d': `${duree}s` }} />
      ))}
      <div className="sa-vignette" ref={boite} onClick={ouvrir}
        style={{ width: largeur - 2 * BORD, height: Math.round(ecran.h * echelle), borderWidth: BORD, borderRadius: RAYON }}>
        {/* Le cadre s'ouvre dans la langue de la page (i18n/routing.js) et se recharge quand elle change. Fermé, il est inerte :
            ni le doigt ni le clavier n'y entrent. */}
        <iframe key={language} ref={cadre} name={NOM_CADRE_APERCU_TEL} src={cheminLocalise('/restaurants', language)} title={t('landing.essaiCadre')}
          loading="lazy" inert={!ouvert} className={ouvert ? 'plein' : undefined}
          style={ouvert ? undefined : { width: ecran.l, height: ecran.h, transform: `scale(${echelle})`, borderRadius: (RAYON - BORD) / echelle }} />
      </div>
      <button type="button" className="sa-vignette-bouton" onClick={ouvrir}>
        <Icone nom="restaurants" taille={19} />{t('landing.essaiVoir')}
      </button>
    </div>
  );
}
