import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { musique } from './musique';

// Le moteur commun des mini-jeux : boucle, saisie, rendu, tableau de bord, règles, effets.
//
// Chaque jeu (voir jeux.js) n'est qu'une définition — update(dt, input) et draw(ctx). Tout ce qui est
// commun vit ici et une seule fois : la boucle requestAnimationFrame avec un dt réel et plafonné, la
// saisie pointeur/clavier normalisée en coordonnées du cadre, le canvas mis à l'échelle du dpr, le
// meilleur score par jeu, la pause automatique quand l'onglet passe en arrière-plan, le bouton 📖
// qui ouvre les règles, la musique de fond (coupée par défaut, voir musique.js), et une couche
// d'effets partagée : textes flottants « +1 », éclats de particules, annonce de niveau, flash de chute.
// Les jeux la déclenchent via api.effet(x, y, texte) et api.eclat(x, y, couleur, n) — sans rien connaître
// de React ni du canvas.
//
// POURQUOI UN CANVAS. Les anciennes versions rendaient chaque objet en <span> repositionné par React
// seize fois par seconde. Ici on dessine une image par rafraîchissement d'écran, sans passer par React :
// c'est ce qui rend le mouvement continu. React ne voit passer que le score et l'état de la partie.

const DT_MAX = 0.05; // au-delà (onglet réveillé, saccade), on avance d'un pas plafonné plutôt que de sauter
const IRIS = '#3B2FB5'; const LIME = '#C8F03C';

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
    annoncer(texte) { annonce = { texte, reste: 1.3, duree: 1.3 }; },
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
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,18,31,.55)'; ctx.strokeText(t.texte, t.x, t.y);
        ctx.fillStyle = t.couleur; ctx.fillText(t.texte, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      if (annonce) {
        const k = annonce.reste / annonce.duree; // 1 → 0
        const entree = Math.min(1, (1 - k) * 6); // apparition rapide
        const sortie = Math.min(1, k * 4); // disparition en fin
        const alpha = Math.min(entree, sortie);
        const echelle = 0.85 + 0.15 * entree;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(w / 2, h * 0.3); ctx.scale(echelle, echelle);
        ctx.font = `900 ${large ? 30 : 18}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,18,31,.6)'; ctx.strokeText(annonce.texte, 0, 0);
        ctx.fillStyle = LIME; ctx.fillText(annonce.texte, 0, 0);
        ctx.restore();
      }
      if (flash > 0) { ctx.fillStyle = `rgba(217,45,60,${(flash * 0.35).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }
    }
  };
}

// onStartRequest(demarrer) : le parent décide quand la partie commence (il peut d'abord demander un
// pseudo, voir GameSocial.jsx) et appelle demarrer() lui-même. onScore(score) : fin de partie.
export default function GameFrame({ jeu, width = 140, height = 280, fill = false, large = false, onStartRequest, onScore }) {
  const { t } = useLanguage();
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;
  const [taille, setTaille] = useState({ w: width, h: height });
  const [status, setStatus] = useState('idle'); // idle | playing | paused | lost
  const [score, setScore] = useState(0);
  const [meilleur, setMeilleur] = useState(() => lireMeilleur(jeu.stockage));
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [pop, setPop] = useState(0); // incrémenté à chaque point : relance l'animation du score
  // Musique de fond (musique.js) : un seul moteur pour tous les jeux, coupée par défaut.
  const [musiqueActive, setMusiqueActive] = useState(() => musique.estActive());
  const [pisteMusique, setPisteMusique] = useState(() => musique.piste());
  const [menuMusique, setMenuMusique] = useState(false);
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
      <button type="button" role="menuitemradio" aria-checked={!musiqueActive} className={`jeu-musique-item${!musiqueActive ? ' active' : ''}`} onClick={() => { musique.arreter(); setMenuMusique(false); }}>🔇 {t('gameFrame.musicNone')}</button>
      <button type="button" role="menuitemradio" aria-checked={musiqueActive && pisteMusique === 'mix'} className={`jeu-musique-item${musiqueActive && pisteMusique === 'mix' ? ' active' : ''}`} onClick={() => { musique.choisir('mix'); setMenuMusique(false); }}>🎲 {t('gameFrame.musicMix')}</button>
      {musique.pistes.map((id) => (
        <button key={id} type="button" role="menuitemradio" aria-checked={musiqueActive && pisteMusique === id} className={`jeu-musique-item${musiqueActive && pisteMusique === id ? ' active' : ''}`} onClick={() => { musique.choisir(id); setMenuMusique(false); }}>
          🎵 {t(`gameFrame.track_${id}`)}<span className="jeu-musique-sous">{t(`gameFrame.track_${id}_sub`)}</span>
        </button>
      ))}
    </div>
  );

  const conteneur = useRef(null);
  const canvas = useRef(null);
  const instance = useRef(null);
  const effets = useRef(creerEffets());
  const scoreRef = useRef(0);
  const meilleurRef = useRef(meilleur);
  const statusRef = useRef(status);
  const tailleRef = useRef(taille);
  const input = useRef({ x: null, y: null, enfonce: false, tapes: [] });
  const raf = useRef(0);
  const derniereImage = useRef(0);
  const finRaf = useRef(0);

  statusRef.current = status;
  tailleRef.current = taille;

  const niveau = () => Math.min(jeu.maxNiveau, Math.floor(scoreRef.current / jeu.pointsParNiveau));

  // Taille : imposée par les props, ou celle du conteneur quand `fill` (plein écran, rotation).
  useEffect(() => {
    if (!fill) { setTaille({ w: width, h: height }); return undefined; }
    const el = conteneur.current; if (!el) return undefined;
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(120, Math.floor(r.width)); const h = Math.max(120, Math.floor(r.height));
      setTaille((tt) => (tt.w === w && tt.h === h ? tt : { w, h }));
    };
    mesurer();
    const ro = new ResizeObserver(mesurer); ro.observe(el);
    window.addEventListener('resize', mesurer); // rotation d écran : ceinture et bretelles
    return () => { ro.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [fill, width, height]);

  // Le canvas suit la densité de l'écran : sans ça, un emoji dessiné en pixels CSS est flou sur Retina.
  function preparerContexte() {
    const c = canvas.current; if (!c) return null;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const { w, h } = tailleRef.current;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
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
        if (niveau() > avant) effets.current.annoncer(t('gameFrame.levelUp', { n: niveau() + 1 }));
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
    const pas = (maintenant) => {
      if (statusRef.current !== 'playing' || !instance.current) return;
      const dt = Math.min(DT_MAX, (maintenant - derniereImage.current) / 1000);
      derniereImage.current = maintenant;
      const inp = input.current;
      instance.current.update(dt, { x: inp.x, y: inp.y, enfonce: inp.enfonce, tapes: inp.tapes, niveau: niveau() });
      inp.tapes = [];
      effets.current.update(dt);
      dessiner();
      if (statusRef.current === 'playing') raf.current = requestAnimationFrame(pas);
    };
    raf.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf.current);
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
  // retour — perdre parce qu'on a répondu à un message n'est pas du jeu.
  useEffect(() => {
    const surVisibilite = () => { if (document.hidden && statusRef.current === 'playing') setStatus('paused'); };
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  }, []);

  // Clavier : Espace = maintenir (FairRider) ; Échap ou P = pause / reprise.
  useEffect(() => {
    const bas = (e) => {
      if (e.code === 'Space' && statusRef.current === 'playing') { e.preventDefault(); input.current.enfonce = true; }
      if ((e.code === 'Escape' || e.code === 'KeyP') && !reglesOuvertes) {
        if (statusRef.current === 'playing') setStatus('paused');
        else if (statusRef.current === 'paused') setStatus('playing');
      }
    };
    const haut = (e) => { if (e.code === 'Space') input.current.enfonce = false; };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  }, [reglesOuvertes]);

  function coord(e) {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function surPointeurBas(e) {
    const p = coord(e); input.current.x = p.x; input.current.y = p.y; input.current.enfonce = true;
    input.current.tapes.push(p);
    canvas.current.setPointerCapture?.(e.pointerId);
  }
  function surPointeurMouv(e) { const p = coord(e); input.current.x = p.x; input.current.y = p.y; }
  function surPointeurHaut() { input.current.enfonce = false; }

  function demarrer() {
    scoreRef.current = 0; setScore(0); setNouveauRecord(false);
    input.current = { x: null, y: null, enfonce: false, tapes: [] };
    instance.current?.reset();
    effets.current.vider();
    setStatus('playing');
  }
  function commencer() { if (onStartRequest) onStartRequest(demarrer); else demarrer(); }
  function ouvrirRegles() { if (statusRef.current === 'playing') setStatus('paused'); setReglesOuvertes(true); }

  const { w, h } = taille;
  const niv = niveau();
  const progression = niv >= jeu.maxNiveau ? 1 : (score % jeu.pointsParNiveau) / jeu.pointsParNiveau;
  return (
    <div className={`jeu${large ? ' jeu--large' : ''}${fill ? ' jeu--fill' : ''}`}>
      <div className="jeu-hud">
        <span className="jeu-best" title={t('gameFrame.bestTitle')}>🥇 {meilleur}</span>
        <span className="jeu-score" key={pop}><span className={`jeu-score-val${pop ? ' pop' : ''}`}>🏆 {score}</span> <span className="jeu-niveau">{t('gameFrame.level', { n: niv + 1 })}</span></span>
        <span className="jeu-hud-boutons">
          <span style={{ position: 'relative' }}>
            <button type="button" className={`jeu-regles-btn jeu-musique-btn${musiqueActive ? ' active' : ''}`} onClick={() => setMenuMusique((o) => !o)} aria-haspopup="menu" aria-expanded={menuMusique} aria-label={t('gameFrame.musicMenuTitle')} title={t('gameFrame.musicMenuTitle')}>
              {musiqueActive ? '🎵' : '🔇'}{large && <span className="jeu-musique-label">{musiqueActive ? t(`gameFrame.track_${pisteMusique}`) : t('gameFrame.music')}</span>}
            </button>
            {menuMusique && menuPistes}
          </span>
          <button type="button" className="jeu-regles-btn" onClick={ouvrirRegles} aria-label={t('gameFrame.rulesOf', { game: jeu.label })} title={t('gameFrame.howToPlayShort')}>📖</button>
        </span>
      </div>
      {/* Progression vers le prochain palier : une barre fine, lisible d'un coup d'œil pendant la partie. */}
      <div className="jeu-progress" aria-hidden="true"><div style={{ width: `${Math.round(progression * 100)}%` }} /></div>
      {/* En grand (plein écran), la commande du jeu reste sous les yeux : on n'a pas à rouvrir les règles pour
          se souvenir s'il faut glisser, taper ou maintenir. */}
      {large && <p className="jeu-indice">🎮 {tJeu(t, jeu, 'regles_3', jeu.controles)}</p>}

      {/* En `fill`, c'est le cadre (et non tout le bloc, qui contient aussi le tableau de bord et les
          boutons) qui est mesuré : le canvas doit remplir exactement la place laissée au terrain. */}
      <div className="jeu-cadre" ref={conteneur} style={fill ? undefined : { width: w, height: h }}>
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
              {meilleur > 0 && <span className="jeu-sous jeu-record">🥇 {t('gameFrame.bestScore', { n: meilleur })}</span>}
              <button type="button" className="jeu-btn" onClick={commencer}>{t('gameFrame.start')}</button>
              <div className="jeu-ligne-boutons">
                <button type="button" className="jeu-btn jeu-btn-ghost" onClick={ouvrirRegles}>{t('gameFrame.howToPlay')}</button>
                <span style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <button type="button" className={`jeu-btn jeu-btn-ghost jeu-btn-musique${musiqueActive ? ' active' : ''}`} onClick={() => setMenuMusique((o) => !o)} aria-haspopup="menu" aria-expanded={menuMusique}>{musiqueActive ? '🎵' : '🔇'} {musiqueActive ? t(`gameFrame.track_${pisteMusique}`) : t('gameFrame.music')}</button>
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
              <span className="jeu-sous">🏆 {score} · 🥇 {meilleur}</span>
              <button type="button" className="jeu-btn" onClick={() => setStatus('playing')}>{t('gameFrame.resume')}</button>
              <button type="button" className="jeu-btn jeu-btn-ghost" onClick={commencer}>{t('gameFrame.restart')}</button>
            </div>
          </div>
        )}
        {status === 'lost' && !reglesOuvertes && (
          <div className="jeu-overlay">
            <div className="jeu-carte">
              <span className="jeu-titre">{tJeu(t, jeu, 'perdu', jeu.perdu)}</span>
              <span className={`jeu-score-final${nouveauRecord ? ' record' : ''}`}>{score}</span>
              <span className="jeu-sous">{nouveauRecord ? t('gameFrame.newRecordLine') : t('gameFrame.bestScore', { n: meilleur })}</span>
              <button type="button" className="jeu-btn" onClick={commencer}>{t('gameFrame.playAgain')}</button>
            </div>
          </div>
        )}
        {reglesOuvertes && (
          <div className="jeu-overlay" role="dialog" aria-label={t('gameFrame.rulesOf', { game: jeu.label })}>
            <div className="jeu-carte jeu-regles">
              <span className="jeu-titre">{jeu.emoji} {jeu.label}</span>
              <ul>
                {jeu.regles.map((r, i) => <li key={r}>{tJeu(t, jeu, `regles_${i}`, r)}</li>)}
              </ul>
              <p className="jeu-controles"><b>{t('gameFrame.controls')}</b> {tJeu(t, jeu, 'regles_3', jeu.controles)}</p>
              <p className="jeu-controles">{t('gameFrame.keyboardHint')}</p>
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
