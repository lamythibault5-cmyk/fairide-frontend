import { useEffect, useRef, useState } from 'react';
import Icone from '../Icone';
import { useLanguage } from '../../context/LanguageContext';
import { musique } from './musique';

// Le moteur commun des mini-jeux : boucle, saisie, rendu, tableau de bord, règles, effets.
//
// Chaque jeu (voir jeux.js) n'est qu'une définition — update(dt, input) et draw(ctx). Tout ce qui est
// commun vit ici et une seule fois : la boucle requestAnimationFrame avec un dt réel et plafonné, la
// saisie pointeur/clavier normalisée en coordonnées du cadre, le canvas mis à l'échelle du dpr, le
// meilleur score par jeu, la pause automatique quand l'onglet passe en arrière-plan, le bouton des regles
// qui ouvre les règles, la musique de fond (coupée par défaut, voir musique.js), le compte à rebours
// « Prêt ? → Go ! » avant chaque partie, et une couche d'effets partagée : textes flottants « +1 »,
// éclats de particules, annonce de niveau, flash de chute. Les jeux la déclenchent via
// api.effet(x, y, texte) et api.eclat(x, y, couleur, n) — sans rien connaître de React ni du canvas.
//
// POURQUOI UN CANVAS. Les anciennes versions rendaient chaque objet en <span> repositionné par React
// seize fois par seconde. Ici on dessine une image par rafraîchissement d'écran, sans passer par React :
// c'est ce qui rend le mouvement continu. React ne voit passer que le score et l'état de la partie.

const DT_MAX = 0.05; // au-delà (onglet réveillé, saccade), on avance d'un pas plafonné plutôt que de sauter
const COMPTE_PRET = 0.7; // « Prêt ? » puis « Go ! » : une seconde en tout, assez pour poser le doigt
const COMPTE_TOTAL = 1.1;
const VITESSE_CLAVIER = 1.3; // flèches ← → : largeurs de terrain par seconde
const IRIS = '#3B2FB5'; const LIME = '#C8F03C';
// Une ligne de règles = une icône + son texte ; le libellé avant le premier « : » est mis en gras.
const ICONES_REGLES = ['cible', 'etoile', 'interdit', 'manette'];

function lireMeilleur(cle) {
  try { return Number(localStorage.getItem(cle)) || 0; } catch { return 0; }
}

// Texte d'un jeu dans la langue de l'interface (jeux.js garde le français comme source) ; repli sur
// le français si une clé manque, plutôt que d'afficher la clé.
export function tJeu(t, jeu, champ, defaut) {
  const cle = `jeux.${jeu.key}_${champ}`;
  const v = t(cle);
  return v === cle ? defaut : v;
}
// Même repli pour les textes du moteur : la clé manquante n'est jamais affichée telle quelle.
const tDef = (t, cle, defaut, vars) => { const v = t(cle, vars); return v === cle ? defaut : v; };

// « But : … » → <b>But :</b> … (le libellé reste court, sinon on n'y touche pas).
function LigneRegle({ texte }) {
  const i = texte.indexOf(':');
  if (i <= 0 || i > 24) return texte;
  return <><b>{texte.slice(0, i + 1)}</b>{texte.slice(i + 1)}</>;
}

// Couche d'effets : mise à jour et dessin indépendants du jeu, par-dessus son rendu.
function creerEffets() {
  let textes = []; let particules = []; let annonce = null; let flash = 0;
  return {
    texte(x, y, texte, couleur = LIME) { textes.push({ x, y, texte, couleur, reste: 0.9, duree: 0.9 }); },
    eclat(x, y, couleur = IRIS, n = 8) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2; const v = 60 + Math.random() * 120;
        particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, r: 2 + Math.random() * 3, couleur, reste: 0.55, duree: 0.55 });
      }
    },
    // Annonce au centre du terrain (niveau franchi, compte à rebours) ; yk = hauteur relative.
    annoncer(texte, duree = 1.3, yk = 0.3, grand = false) { annonce = { texte, reste: duree, duree, yk, grand }; },
    flasher() { flash = 1; },
    vider() { textes = []; particules = []; annonce = null; flash = 0; },
    update(dt) {
      for (const t of textes) { t.y -= 42 * dt; t.reste -= dt; }
      textes = textes.filter((t) => t.reste > 0);
      for (const p of particules) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.reste -= dt; }
      particules = particules.filter((p) => p.reste > 0);
      if (annonce) { annonce.reste -= dt; if (annonce.reste <= 0) annonce = null; }
      if (flash > 0) flash = Math.max(0, flash - dt * 3);
    },
    draw(ctx, w, h, large) {
      for (const p of particules) {
        ctx.globalAlpha = Math.max(0, p.reste / p.duree);
        ctx.fillStyle = p.couleur; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const t of textes) {
        const k = t.reste / t.duree;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.font = `800 ${large ? 20 : 15}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        // Un « Parfait ! +2 » né au bord du terrain est ramené dedans : jamais de texte coupé.
        const demi = ctx.measureText(t.texte).width / 2 + 4;
        const x = Math.max(demi, Math.min(w - demi, t.x)); const y = Math.max(12, t.y);
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,18,31,.55)'; ctx.strokeText(t.texte, x, y);
        ctx.fillStyle = t.couleur; ctx.fillText(t.texte, x, y);
      }
      ctx.globalAlpha = 1;
      if (annonce) {
        const k = annonce.reste / annonce.duree; // 1 → 0
        const entree = Math.min(1, (1 - k) * 6); // apparition rapide
        const sortie = Math.min(1, k * 4); // disparition en fin
        const alpha = Math.min(entree, sortie);
        const echelle = 0.85 + 0.15 * entree;
        const px = (annonce.grand ? 1.5 : 1) * (large ? 30 : 18);
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(w / 2, h * annonce.yk); ctx.scale(echelle, echelle);
        ctx.font = `900 ${px}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,18,31,.6)'; ctx.strokeText(annonce.texte, 0, 0);
        ctx.fillStyle = LIME; ctx.fillText(annonce.texte, 0, 0);
        ctx.restore();
      }
      if (flash > 0) { ctx.fillStyle = `rgba(217,45,60,${(flash * 0.35).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
    }
  };
}

// Partie en cours : le panier flottant n'a rien à faire par-dessus le terrain. Un compteur, parce que
// la page peut monter deux cadres de jeu à la fois.
let partiesEnCours = 0;
function signalerPartie(active) {
  partiesEnCours = Math.max(0, partiesEnCours + (active ? 1 : -1));
  document.documentElement.classList.toggle('jeu-en-cours', partiesEnCours > 0);
}

const surTelephone = () => { try { return window.matchMedia('(max-width: 820px)').matches; } catch { return false; } };

const dansChampTexte = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
// Souris + survol : un clavier est probablement là, on peut suggérer « Espace pour rejouer ».
const clavierProbable = () => { try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };

// onStartRequest(demarrer) : le parent décide quand la partie commence (il peut d'abord demander un
// pseudo, voir GameSocial.jsx) et appelle demarrer() lui-même. onScore(score) : fin de partie.
// onEcranScinde : affiche le jeu ET la carte en même temps (fourni par TrackingWithGames). ecranScindeActif :
// on y est déjà.
export default function GameFrame({ jeu, width = 140, height = 280, fill = false, large = false, onStartRequest, onScore, onEcranScinde, ecranScindeActif = false }) {
  const { t } = useLanguage();
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const tRef = useRef(t);
  tRef.current = t;
  const [taille, setTaille] = useState({ w: width, h: height });
  const [status, setStatus] = useState('idle'); // idle | countdown | playing | paused | lost
  const [score, setScore] = useState(0);
  const [meilleur, setMeilleur] = useState(() => lireMeilleur(jeu.stockage));
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [pop, setPop] = useState(0); // incrémenté à chaque point : relance l'animation du score
  // Musique de fond (musique.js) : un seul moteur pour tous les jeux, coupée par défaut.
  const [musiqueActive, setMusiqueActive] = useState(() => musique.estActive());
  const [pisteMusique, setPisteMusique] = useState(() => musique.piste());
  const [menuMusique, setMenuMusique] = useState(false);
  const racine = useRef(null);
  useEffect(() => musique.abonner((a, piste) => { setMusiqueActive(a); setPisteMusique(piste); }), []);
  // Le menu se ferme d'un clic ailleurs ou avec Échap.
  useEffect(() => {
    if (!menuMusique) return undefined;
    const fermer = (e) => { if (!e.target.closest?.('.jeu-musique-menu, .jeu-musique-btn, .jeu-btn-musique')) setMenuMusique(false); };
    const clavier = (e) => { if (e.key === 'Escape') setMenuMusique(false); };
    document.addEventListener('pointerdown', fermer); document.addEventListener('keydown', clavier);
    return () => { document.removeEventListener('pointerdown', fermer); document.removeEventListener('keydown', clavier); };
  }, [menuMusique]);
  const menuPistes = (
    <div className="jeu-musique-menu" role="menu" aria-label={t('gameFrame.musicMenuTitle')}>
      <div className="jeu-musique-menu-titre">{t('gameFrame.musicMenuTitle')}</div>
      <button type="button" role="menuitemradio" aria-checked={!musiqueActive} className={`jeu-musique-item${!musiqueActive ? ' active' : ''}`} onClick={() => { musique.arreter(); setMenuMusique(false); }}><Icone nom="sonCoupe" taille={15} /> {t('gameFrame.musicNone')}</button>
      <button type="button" role="menuitemradio" aria-checked={musiqueActive && pisteMusique === 'mix'} className={`jeu-musique-item${musiqueActive && pisteMusique === 'mix' ? ' active' : ''}`} onClick={() => { musique.choisir('mix'); setMenuMusique(false); }}>{t('gameFrame.musicMix')}</button>
      {musique.pistes.map((id) => (
        <button key={id} type="button" role="menuitemradio" aria-checked={musiqueActive && pisteMusique === id} className={`jeu-musique-item${musiqueActive && pisteMusique === id ? ' active' : ''}`} onClick={() => { musique.choisir(id); setMenuMusique(false); }}>
          <Icone nom="son" taille={15} /> {t(`gameFrame.track_${id}`)}<span className="jeu-musique-sous">{t(`gameFrame.track_${id}_sub`)}</span>
        </button>
      ))}
    </div>
  );

  const conteneur = useRef(null);
  const canvas = useRef(null);
  // Le contexte 2D du canvas, garde entre les images (voir preparerContexte).
  const ctxRef = useRef(null);
  const instance = useRef(null);
  const effets = useRef(null);
  if (!effets.current) effets.current = creerEffets();
  const scoreRef = useRef(0);
  const meilleurRef = useRef(meilleur);
  const statusRef = useRef(status);
  const tailleRef = useRef(taille);
  const input = useRef({ x: null, y: null, enfonce: false, tapes: [], gauche: false, droite: false });
  const raf = useRef(0);
  const derniereImage = useRef(0);
  const finRaf = useRef(0);
  const commencerRef = useRef(null);

  statusRef.current = status;
  tailleRef.current = taille;

  const niveau = () => Math.min(jeu.maxNiveau, Math.floor(scoreRef.current / jeu.pointsParNiveau));

  // Taille : imposée par les props, ou celle du conteneur quand `fill` est demandé par le parent.
  useEffect(() => {
    if (!fill) { setTaille({ w: width, h: height }); return undefined; }
    const el = conteneur.current; if (!el) return undefined;
    // LA BOÎTE DE CONTENU, PAS LA BOÎTE DE BORDURE.
    //
    // Cette mesure utilisait getBoundingClientRect(), qui inclut la bordure. Le cadre en porte une
    // de 1px : le canvas était donc posé 2px plus haut que la place réellement disponible, ce qui
    // rendait le cadre 2px plus haut — et le ResizeObserver repartait. Le terrain grandissait de
    // 2px par image, sans jamais s'arrêter.
    //
    // C'est aussi ce qui écroulait les images par seconde : à chaque mesure, preparerContexte()
    // voyait une taille différente et réassignait c.width/c.height, ce qui RÉALLOUE le tampon du
    // canvas et l'efface. Soixante réallocations d'un tampon de 800×1800 par seconde, pour rien.
    // clientWidth/clientHeight donnent la boîte de contenu, bordure exclue : la mesure se stabilise
    // dès la première image.
    const mesurer = () => {
      const w = Math.max(120, el.clientWidth); const h = Math.max(120, el.clientHeight);
      setTaille((tt) => (tt.w === w && tt.h === h ? tt : { w, h }));
    };
    mesurer();
    const ro = new ResizeObserver(mesurer); ro.observe(el);
    window.addEventListener('resize', mesurer); // rotation d écran : ceinture et bretelles
    return () => { ro.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [fill, width, height]);

  // Tactile pendant le jeu : pas de loupe iOS, pas de sélection de texte, pas de menu contextuel au doigt
  // appuyé, pas de zoom au double tap ni au pincement, sur le canvas.
  useEffect(() => {
    const cible = canvas.current;
    if (!cible) return undefined;
    const interactif = (t) => !!t?.closest?.('button, a, input, textarea, select, label, [role="dialog"]');
    const tactile = (e) => { if (e.cancelable && !interactif(e.target)) e.preventDefault(); };
    const bloquer = (e) => { if (!interactif(e.target)) e.preventDefault(); };
    cible.addEventListener('touchstart', tactile, { passive: false });
    cible.addEventListener('touchmove', tactile, { passive: false });
    cible.addEventListener('contextmenu', bloquer);
    cible.addEventListener('selectstart', bloquer);
    cible.addEventListener('dblclick', bloquer);
    return () => {
      cible.removeEventListener('touchstart', tactile);
      cible.removeEventListener('touchmove', tactile);
      cible.removeEventListener('contextmenu', bloquer);
      cible.removeEventListener('selectstart', bloquer);
      cible.removeEventListener('dblclick', bloquer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const partieActive = status === 'countdown' || status === 'playing' || status === 'paused';
  useEffect(() => {
    if (!partieActive) return undefined;
    signalerPartie(true);
    return () => signalerPartie(false);
  }, [partieActive]);


  // Le canvas suit la densité de l'écran : sans ça, un emoji dessiné en pixels CSS est flou sur Retina.
  function preparerContexte() {
    const c = canvas.current; if (!c) return null;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const { w, h } = tailleRef.current;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    // Le contexte est gardé : getContext('2d') était rappelé à chaque image, soixante fois par
    // seconde, alors qu'il rend toujours le même objet pour un canvas donné. On le relit seulement
    // si le canvas a changé (changement de jeu, remontage).
    if (ctxRef.current?.canvas !== c) ctxRef.current = c.getContext('2d');
    const ctx = ctxRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function dessiner() {
    const ctx = preparerContexte(); if (!ctx || !instance.current) return;
    const { w, h } = tailleRef.current;
    ctx.clearRect(0, 0, w, h);
    instance.current.draw(ctx);
    effets.current.draw(ctx, w, h, large);
  }

  // L'instance du jeu : créée une fois par définition, informée des changements de taille.
  useEffect(() => {
    const api = {
      get w() { return tailleRef.current.w; },
      get h() { return tailleRef.current.h; },
      large,
      marquer(n = 1) {
        const avant = niveau();
        scoreRef.current += n; setScore(scoreRef.current); setPop((p) => p + 1);
        // Palier franchi : une annonce dans le terrain, sans passer par React.
        if (niveau() > avant) effets.current.annoncer(tRef.current('gameFrame.levelUp', { n: niveau() + 1 }));
      },
      perdre() {
        if (statusRef.current !== 'playing') return;
        effets.current.flasher();
        const record = scoreRef.current > meilleurRef.current;
        if (record) {
          meilleurRef.current = scoreRef.current; setMeilleur(scoreRef.current);
          try { localStorage.setItem(jeu.stockage, String(scoreRef.current)); } catch { /* stockage indisponible : le score vit le temps de la page */ }
        }
        setNouveauRecord(record);
        setStatus('lost');
        onScoreRef.current?.(scoreRef.current);
      },
      // Effets partagés : « +1 » flottant, éclat de particules.
      effet(x, y, texte, couleur) { effets.current.texte(x, y, texte, couleur); },
      eclat(x, y, couleur, n) { effets.current.eclat(x, y, couleur, n); },
      // Textes affichés dans le terrain (« Pfiou ! »…) : traduits par le moteur, dans la langue courante.
      t: (cle, vars) => tRef.current(cle, vars),
      niveau,
      score: () => scoreRef.current
    };
    instance.current = jeu.creer(api);
    instance.current.reset();
    effets.current.vider();
    dessiner();
    return () => { instance.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jeu]);

  useEffect(() => {
    instance.current?.redimensionner?.(taille.w, taille.h);
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taille]);

  // La boucle. Ne tourne qu'en partie ; s'arrête d'elle-même dès que le statut change.
  useEffect(() => {
    if (status !== 'playing') return undefined;
    derniereImage.current = performance.now();
    // Lissage du pas : les horodatages d'images tremblent de quelques millisecondes, et ce tremblement passait
    // tel quel dans les positions (micro-saccades visibles sur un défilement régulier). On estime la période de
    // l'écran et, tant que l'image arrive à l'heure (±30 %), on avance d'exactement cette période ; l'écart est
    // mis de côté et rendu par petites touches, pour que le temps du jeu ne dérive jamais de l'horloge réelle.
    let periode = 1 / 60; let dette = 0;
    const pas = (maintenant) => {
      if (statusRef.current !== 'playing' || !instance.current) return;
      const brut = Math.min(DT_MAX, (maintenant - derniereImage.current) / 1000);
      derniereImage.current = maintenant;
      let dt = brut;
      if (brut > 0 && Math.abs(brut - periode) < periode * 0.3) {
        periode += (brut - periode) * 0.05;
        dette += brut - periode;
        const rendu = Math.max(-periode * 0.1, Math.min(periode * 0.1, dette * 0.1));
        dette -= rendu;
        dt = periode + rendu;
      } else dette = 0;
      const inp = input.current;
      // Flèches ← → : un pointeur virtuel qui glisse à vitesse constante (les jeux ne voient qu'un x).
      if (inp.gauche !== inp.droite) {
        const { w, h } = tailleRef.current;
        inp.x = Math.max(0, Math.min(w, (inp.x ?? w / 2) + (inp.droite ? 1 : -1) * w * VITESSE_CLAVIER * dt));
        if (inp.y == null) inp.y = h / 2;
      }
      instance.current.update(dt, { x: inp.x, y: inp.y, enfonce: inp.enfonce, tapes: inp.tapes, sauts: inp.sauts || 0, niveau: niveau() });
      inp.tapes = []; inp.sauts = 0;
      effets.current.update(dt);
      dessiner();
      if (statusRef.current === 'playing') raf.current = requestAnimationFrame(pas);
    };
    raf.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Compte à rebours « Prêt ? → Go ! » : le terrain est dessiné (immobile) avec l'annonce par-dessus, puis
  // la partie démarre. Les tapes faites pendant le compte ne comptent pas.
  useEffect(() => {
    if (status !== 'countdown') return undefined;
    const debut = performance.now(); let precedent = debut; let go = false;
    effets.current.annoncer(tDef(t, 'gameFrame.ready', 'Prêt ?'), COMPTE_PRET, 0.42, true);
    const boucle = (m) => {
      const dt = Math.min(DT_MAX, (m - precedent) / 1000); precedent = m;
      const ecoule = (m - debut) / 1000;
      if (!go && ecoule >= COMPTE_PRET) { go = true; effets.current.annoncer(tDef(t, 'gameFrame.go', 'Go !'), COMPTE_TOTAL - COMPTE_PRET + 0.25, 0.42, true); }
      effets.current.update(dt); dessiner();
      if (ecoule >= COMPTE_TOTAL) { input.current.tapes = []; input.current.sauts = 0; setStatus('playing'); return; }
      finRaf.current = requestAnimationFrame(boucle);
    };
    finRaf.current = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(finRaf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Après une chute, le flash rouge et les derniers effets finissent de s'estomper (quelques dixièmes).
  useEffect(() => {
    if (status !== 'lost') return undefined;
    const debut = performance.now(); let precedent = debut;
    const boucle = (m) => {
      const dt = Math.min(DT_MAX, (m - precedent) / 1000); precedent = m;
      effets.current.update(dt); dessiner();
      if (m - debut < 900) finRaf.current = requestAnimationFrame(boucle);
    };
    finRaf.current = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(finRaf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Onglet en arrière-plan : on met en pause plutôt que de laisser le jeu « rattraper » d'un coup au
  // retour — perdre parce qu'on a répondu à un message n'est pas du jeu. (Le compte à rebours aussi.)
  useEffect(() => {
    const surVisibilite = () => {
      if (!document.hidden) return;
      if (statusRef.current === 'playing' || statusRef.current === 'countdown') setStatus('paused');
      input.current.enfonce = false; input.current.gauche = false; input.current.droite = false;
    };
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  }, []);

  // Clavier : Espace = maintenir (FairRider) ou (re)commencer ; ← → = déplacer ; Échap ou P = pause / reprise.
  useEffect(() => {
    const bas = (e) => {
      if (dansChampTexte(e)) return;
      const st = statusRef.current;
      // Sur un bouton (atteint au clavier), Espace et Entrée restent au bouton : pas de double action.
      if ((e.code === 'Space' || e.code === 'Enter') && e.target?.tagName !== 'BUTTON') {
        if (st === 'playing') { e.preventDefault(); input.current.enfonce = true; }
        else if ((st === 'idle' || st === 'lost') && !reglesOuvertes && !e.repeat) { e.preventDefault(); commencerRef.current?.(); }
        else if (st === 'paused' && !reglesOuvertes && !e.repeat) { e.preventDefault(); setStatus('playing'); }
      }
      // ↑ ou W : saut direct (FairRider), l'équivalent clavier du double tap. Les autres jeux l'ignorent.
      if ((e.code === 'ArrowUp' || e.code === 'KeyW') && st === 'playing') {
        e.preventDefault();
        if (!e.repeat) input.current.sauts = (input.current.sauts || 0) + 1;
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (st === 'playing' || st === 'countdown') e.preventDefault();
        input.current[e.code === 'ArrowLeft' ? 'gauche' : 'droite'] = true;
      }
      // Calque de secours (iPhone) : Échap le referme au lieu de mettre en pause.
      if ((e.code === 'Escape' || e.code === 'KeyP') && !reglesOuvertes) {
        if (st === 'playing') setStatus('paused');
        else if (st === 'paused') setStatus('playing');
      }
    };
    const haut = (e) => {
      if (e.code === 'Space' || e.code === 'Enter') input.current.enfonce = false;
      if (e.code === 'ArrowLeft') input.current.gauche = false;
      if (e.code === 'ArrowRight') input.current.droite = false;
    };
    // Fenêtre quittée touche enfoncée : on relâche tout, sinon le joueur file tout seul au retour.
    const relacher = () => { input.current.enfonce = false; input.current.gauche = false; input.current.droite = false; };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut); window.addEventListener('blur', relacher);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); window.removeEventListener('blur', relacher); };
  }, [reglesOuvertes]);

  function coord(e) {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function libererFocus() {
    const a = document.activeElement;
    if (a && a !== document.body && /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(a.tagName)) a.blur();
  }
  function surPointeurBas(e) {
    libererFocus();
    const p = coord(e); input.current.x = p.x; input.current.y = p.y; input.current.enfonce = true;
    input.current.tapes.push(p);
    try { canvas.current.setPointerCapture?.(e.pointerId); } catch { /* pointeur déjà relâché : sans capture, le glissé marche quand même */ }
  }
  function surPointeurMouv(e) { const p = coord(e); input.current.x = p.x; input.current.y = p.y; }
  function surPointeurHaut() { input.current.enfonce = false; }

  function demarrer() {
    scoreRef.current = 0; setScore(0); setNouveauRecord(false);
    input.current = { x: null, y: null, enfonce: false, tapes: [], sauts: 0, gauche: false, droite: false };
    instance.current?.reset();
    effets.current.vider();
    setStatus('countdown');
  }
  function commencer() { if (onStartRequest) onStartRequest(demarrer); else demarrer(); }
  // Écran scindé : la page affiche le jeu et la carte ensemble.
  function ecranScinde() {
    onEcranScinde?.();
  }
  commencerRef.current = commencer;
  function ouvrirRegles() { if (statusRef.current === 'playing' || statusRef.current === 'countdown') setStatus('paused'); setReglesOuvertes(true); }

  const { w, h } = taille;
  const remplir = fill;
  const niv = niveau();
  const progression = niv >= jeu.maxNiveau ? 1 : (score % jeu.pointsParNiveau) / jeu.pointsParNiveau;
  const lignesRegles = [...jeu.regles.map((r, i) => tJeu(t, jeu, `regles_${i}`, r)), tJeu(t, jeu, 'regles_3', jeu.controles)];
  return (
    <div ref={racine} className={`jeu${large ? ' jeu--large' : ''}${remplir ? ' jeu--fill' : ''}`}>
      <div className="jeu-hud">
        <span className="jeu-best" title={t('gameFrame.bestTitle')}><Icone nom="etoile" taille={14} />{meilleur}</span>
        <span className="jeu-score" key={pop}><span className={`jeu-score-val${pop ? ' pop' : ''}`}>{score}</span> <span className="jeu-niveau">{t('gameFrame.level', { n: niv + 1 })}</span></span>
        <span className="jeu-hud-boutons">
          <span style={{ position: 'relative' }}>
            <button type="button" className={`jeu-regles-btn jeu-musique-btn${musiqueActive ? ' active' : ''}`} onClick={() => setMenuMusique((o) => !o)} aria-haspopup="menu" aria-expanded={menuMusique} aria-label={t('gameFrame.musicMenuTitle')} title={t('gameFrame.musicMenuTitle')}>
              <Icone nom={musiqueActive ? 'son' : 'sonCoupe'} taille={16} />{large && <span className="jeu-musique-label">{musiqueActive ? t(`gameFrame.track_${pisteMusique}`) : t('gameFrame.music')}</span>}
            </button>
            {menuMusique && menuPistes}
          </span>
          <button type="button" className="jeu-regles-btn" onClick={ouvrirRegles} aria-label={t('gameFrame.rulesOf', { game: jeu.label })} title={t('gameFrame.howToPlayShort')}><Icone nom="guide" taille={16} /></button>
          {onEcranScinde && !ecranScindeActif && (
            <button type="button" className={`jeu-regles-btn${large ? ' jeu-action-nommee' : ''}`} onClick={ecranScinde}
              aria-label={t('gameFrame.splitScreen')} title={t('gameFrame.splitScreen')}>
              ◧{large && <span> {t('gameFrame.splitScreen')}</span>}
            </button>
          )}
        </span>
      </div>
      {/* Progression vers le prochain palier : une barre fine, lisible d'un coup d'œil pendant la partie. */}
      <div className="jeu-progress" aria-hidden="true"><div style={{ width: `${Math.round(progression * 100)}%` }} /></div>
      {/* En grand, la commande du jeu reste sous les yeux : on n'a pas à rouvrir les règles pour
          se souvenir s'il faut glisser, taper ou maintenir. */}
      {large && <p className="jeu-indice"><Icone nom="manette" taille={14} /><span>{tJeu(t, jeu, 'regles_3', jeu.controles)}</span></p>}

      {/* En `fill`, c'est le cadre (et non tout le bloc, qui contient aussi le tableau de bord et les
          boutons) qui est mesuré : le canvas doit remplir exactement la place laissée au terrain. */}
      <div className="jeu-cadre" ref={conteneur} style={remplir ? undefined : { width: w, height: h }}>
        <canvas
          ref={canvas}
          className="jeu-canvas"
          style={{ width: w, height: h }}
          onPointerDown={surPointeurBas}
          onPointerMove={surPointeurMouv}
          onPointerUp={surPointeurHaut}
          onPointerCancel={surPointeurHaut}
          onPointerLeave={surPointeurHaut}
        />

        {status === 'idle' && !reglesOuvertes && (
          <div className="jeu-overlay">
            <div className="jeu-carte">
              <span className="jeu-emoji" aria-hidden="true">{jeu.emoji}</span>
              <span className="jeu-titre">{jeu.label}</span>
              <span className="jeu-sous">{tJeu(t, jeu, 'sub', jeu.sub)}</span>
              {meilleur > 0 && <span className="jeu-sous jeu-record"><Icone nom="etoile" taille={14} /> {t('gameFrame.bestScore', { n: meilleur })}</span>}
              <button type="button" className="jeu-btn" onClick={commencer}>{t('gameFrame.start')}</button>
              <div className="jeu-ligne-boutons">
                <button type="button" className="jeu-btn jeu-btn-ghost" onClick={ouvrirRegles}>{t('gameFrame.howToPlay')}</button>
                <span style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <button type="button" className={`jeu-btn jeu-btn-ghost jeu-btn-musique${musiqueActive ? ' active' : ''}`} onClick={() => setMenuMusique((o) => !o)} aria-haspopup="menu" aria-expanded={menuMusique}><Icone nom={musiqueActive ? 'son' : 'sonCoupe'} taille={15} /> {musiqueActive ? t(`gameFrame.track_${pisteMusique}`) : t('gameFrame.music')}</button>
                  {menuMusique && menuPistes}
                </span>
              </div>
            </div>
          </div>
        )}
        {status === 'paused' && !reglesOuvertes && (
          <div className="jeu-overlay">
            <div className="jeu-carte">
              <span className="jeu-titre">{t('gameFrame.paused')}</span>
              {/* Deux clés existantes plutôt qu'une nouvelle : « Score : 12 · Record : 40 ». Les
                  deux glyphes 🏆 et 🥇 qui les remplaçaient ne disaient pas lequel était lequel. */}
              <span className="jeu-sous">{t('gameFrame.score', { score, record: '' })} · {t('gameFrame.bestScore', { n: meilleur })}</span>
              <button type="button" className="jeu-btn" onClick={() => setStatus('playing')}>{t('gameFrame.resume')}</button>
              <button type="button" className="jeu-btn jeu-btn-ghost" onClick={commencer}>{t('gameFrame.restart')}</button>
            </div>
          </div>
        )}
        {status === 'lost' && !reglesOuvertes && (
          // La carte de fin arrive avec un demi-temps de retard (CSS) : on voit d'abord la chute.
          <div className="jeu-overlay jeu-overlay--fin">
            <div className="jeu-carte">
              <span className="jeu-titre">{tJeu(t, jeu, 'perdu', jeu.perdu)}</span>
              <span className={`jeu-score-final${nouveauRecord ? ' record' : ''}`}>{score}</span>
              <span className="jeu-sous">{nouveauRecord ? t('gameFrame.newRecordLine') : t('gameFrame.bestScore', { n: meilleur })}</span>
              <span className="jeu-sous jeu-fin-niveau">{tDef(t, 'gameFrame.levelReached', `Niveau ${niv + 1} atteint`, { n: niv + 1 })}</span>
              <button type="button" className="jeu-btn" onClick={commencer}>{t('gameFrame.playAgain')}</button>
              {clavierProbable() && <span className="jeu-sous jeu-touche">{tDef(t, 'gameFrame.spaceHint', 'Espace ou Entrée pour rejouer')}</span>}
            </div>
          </div>
        )}
        {reglesOuvertes && (
          <div className="jeu-overlay" role="dialog" aria-label={t('gameFrame.rulesOf', { game: jeu.label })}>
            <div className="jeu-carte jeu-regles">
              <span className="jeu-titre">{jeu.emoji} {jeu.label}</span>
              {/* Quatre lignes — but, score, fin de partie, commandes — dans une zone qui défile si le terrain est
                  petit ; le bouton reste sous les yeux. */}
              <div className="jeu-regles-corps">
                <ul>
                  {lignesRegles.map((r, i) => (
                    <li key={r}><span className="jeu-regles-ico" aria-hidden="true"><Icone nom={ICONES_REGLES[i]} taille={15} /></span><span><LigneRegle texte={r} /></span></li>
                  ))}
                </ul>
              </div>
              {/* Ouvrir les règles en pleine partie a mis le jeu en pause : les refermer reprend la partie,
                  sans repasser par l'écran « En pause » qui ferait un clic de plus pour rien. */}
              <button type="button" className="jeu-btn" onClick={() => { setReglesOuvertes(false); if (status === 'paused') setStatus('playing'); }}>
                {status === 'paused' ? t('gameFrame.resume') : t('games.gotIt')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="jeu-actions">
        {status === 'playing' && <button type="button" onClick={() => setStatus('paused')} aria-label={t('gameFrame.pauseAria')}>{t('gameFrame.pause')}</button>}
      </div>
    </div>
  );
}
