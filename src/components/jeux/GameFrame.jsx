import { useEffect, useRef, useState } from 'react';

// Le moteur commun des mini-jeux : boucle, saisie, rendu, tableau de bord, règles.
//
// Chaque jeu (voir jeux.js) n'est qu'une définition — update(dt, input) et draw(ctx). Tout ce qui est
// commun vit ici et une seule fois : la boucle requestAnimationFrame avec un dt réel et plafonné, la
// saisie pointeur/clavier normalisée en coordonnées du cadre, le canvas mis à l'échelle du dpr, le
// meilleur score par jeu, la pause automatique quand l'onglet passe en arrière-plan, et le bouton 📖
// qui ouvre les règles.
//
// POURQUOI UN CANVAS. Les anciennes versions rendaient chaque objet en <span> repositionné par React
// seize fois par seconde. Ici on dessine une image par rafraîchissement d'écran, sans passer par React :
// c'est ce qui rend le mouvement continu. React ne voit passer que le score et l'état de la partie.

const DT_MAX = 0.05; // au-delà (onglet réveillé, saccade), on avance d'un pas plafonné plutôt que de sauter

function lireMeilleur(cle) {
  try { return Number(localStorage.getItem(cle)) || 0; } catch { return 0; }
}

export default function GameFrame({ jeu, width = 140, height = 280, fill = false, large = false }) {
  const [taille, setTaille] = useState({ w: width, h: height });
  const [status, setStatus] = useState('idle'); // idle | playing | paused | lost
  const [score, setScore] = useState(0);
  const [meilleur, setMeilleur] = useState(() => lireMeilleur(jeu.stockage));
  const [nouveauRecord, setNouveauRecord] = useState(false);
  const [reglesOuvertes, setReglesOuvertes] = useState(false);

  const conteneur = useRef(null);
  const canvas = useRef(null);
  const instance = useRef(null);
  const scoreRef = useRef(0);
  const meilleurRef = useRef(meilleur);
  const statusRef = useRef(status);
  const tailleRef = useRef(taille);
  const input = useRef({ x: null, y: null, enfonce: false, tapes: [] });
  const raf = useRef(0);
  const derniereImage = useRef(0);

  statusRef.current = status;
  tailleRef.current = taille;

  const niveau = () => Math.min(jeu.maxNiveau, Math.floor(scoreRef.current / jeu.pointsParNiveau));

  // Taille : imposée par les props, ou celle du conteneur quand `fill` (plein écran, rotation).
  useEffect(() => {
    if (!fill) { setTaille({ w: width, h: height }); return undefined; }
    const el = conteneur.current; if (!el) return undefined;
    const mesurer = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(120, Math.floor(r.width)); const h = Math.max(160, Math.floor(r.height));
      setTaille((t) => (t.w === w && t.h === h ? t : { w, h }));
    };
    mesurer();
    const ro = new ResizeObserver(mesurer); ro.observe(el);
    window.addEventListener('resize', mesurer); // rotation d écran : ceinture et bretelles
    return () => { ro.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [fill, width, height]);

  // Le canvas suit la densité de l'écran : sans ça, un emoji dessiné en pixels CSS est flou sur Retina.
  function preparerContexte() {
    const c = canvas.current; if (!c) return null;
    const dpr = window.devicePixelRatio || 1;
    const { w, h } = tailleRef.current;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }
  function dessiner() {
    const ctx = preparerContexte(); if (!ctx || !instance.current) return;
    ctx.clearRect(0, 0, tailleRef.current.w, tailleRef.current.h);
    instance.current.draw(ctx);
  }

  // L'instance du jeu : créée une fois par définition, informée des changements de taille.
  useEffect(() => {
    const api = {
      get w() { return tailleRef.current.w; },
      get h() { return tailleRef.current.h; },
      large,
      marquer(n = 1) { scoreRef.current += n; setScore(scoreRef.current); },
      perdre() {
        if (statusRef.current !== 'playing') return;
        const record = scoreRef.current > meilleurRef.current;
        if (record) {
          meilleurRef.current = scoreRef.current; setMeilleur(scoreRef.current);
          try { localStorage.setItem(jeu.stockage, String(scoreRef.current)); } catch { /* stockage indisponible : le score vit le temps de la page */ }
        }
        setNouveauRecord(record);
        setStatus('lost');
      },
      niveau,
      score: () => scoreRef.current
    };
    instance.current = jeu.creer(api);
    instance.current.reset();
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
      if (statusRef.current === 'playing') { dessiner(); raf.current = requestAnimationFrame(pas); }
      else dessiner();
    };
    raf.current = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Onglet en arrière-plan : on met en pause plutôt que de laisser le jeu « rattraper » d'un coup au
  // retour — perdre parce qu'on a répondu à un message n'est pas du jeu.
  useEffect(() => {
    const surVisibilite = () => { if (document.hidden && statusRef.current === 'playing') setStatus('paused'); };
    document.addEventListener('visibilitychange', surVisibilite);
    return () => document.removeEventListener('visibilitychange', surVisibilite);
  }, []);

  // Espace = maintenir (FairRider) ; utile aussi au clavier pour taper une cible.
  useEffect(() => {
    const bas = (e) => { if (e.code === 'Space' && statusRef.current === 'playing') { e.preventDefault(); input.current.enfonce = true; } };
    const haut = (e) => { if (e.code === 'Space') input.current.enfonce = false; };
    window.addEventListener('keydown', bas); window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  }, []);

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

  function commencer() {
    scoreRef.current = 0; setScore(0); setNouveauRecord(false);
    input.current = { x: null, y: null, enfonce: false, tapes: [] };
    instance.current?.reset();
    setStatus('playing');
  }
  function ouvrirRegles() { if (statusRef.current === 'playing') setStatus('paused'); setReglesOuvertes(true); }

  const { w, h } = taille;
  return (
    <div className={`jeu${large ? ' jeu--large' : ''}${fill ? ' jeu--fill' : ''}`}>
      <div className="jeu-hud">
        <span className="jeu-best">🥇 {meilleur}</span>
        <span className="jeu-score">🏆 {score} <span className="jeu-niveau">· Niv. {niveau() + 1}</span></span>
        <button type="button" className="jeu-regles-btn" onClick={ouvrirRegles} aria-label={`Règles de ${jeu.label}`} title="Comment jouer">📖</button>
      </div>

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
              <span className="jeu-titre">{jeu.emoji} {jeu.label}</span>
              <span className="jeu-sous">{jeu.sub}</span>
              <button type="button" className="jeu-btn" onClick={commencer}>▶️ Commencer</button>
              <button type="button" className="jeu-btn jeu-btn-ghost" onClick={ouvrirRegles}>📖 Comment jouer</button>
            </div>
          </div>
        )}
        {status === 'paused' && !reglesOuvertes && (
          <div className="jeu-overlay">
            <div className="jeu-carte">
              <span className="jeu-titre">⏸️ En pause</span>
              <button type="button" className="jeu-btn" onClick={() => setStatus('playing')}>▶️ Continuer</button>
              <button type="button" className="jeu-btn jeu-btn-ghost" onClick={commencer}>🔄 Recommencer</button>
            </div>
          </div>
        )}
        {status === 'lost' && !reglesOuvertes && (
          <div className="jeu-overlay">
            <div className="jeu-carte">
              <span className="jeu-titre">{jeu.perdu}</span>
              <span className="jeu-sous">Score : {score}{nouveauRecord ? ' — 🎉 nouveau record !' : ''}</span>
              <button type="button" className="jeu-btn" onClick={commencer}>🔄 Rejouer</button>
            </div>
          </div>
        )}
        {reglesOuvertes && (
          <div className="jeu-overlay" role="dialog" aria-label={`Règles de ${jeu.label}`}>
            <div className="jeu-carte jeu-regles">
              <span className="jeu-titre">{jeu.emoji} {jeu.label}</span>
              <ul>
                {jeu.regles.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className="jeu-controles"><b>Commandes.</b> {jeu.controles}</p>
              {/* Ouvrir les règles en pleine partie a mis le jeu en pause : les refermer reprend la partie,
                  sans repasser par l'écran « En pause » qui ferait un clic de plus pour rien. */}
              <button type="button" className="jeu-btn" onClick={() => { setReglesOuvertes(false); if (status === 'paused') setStatus('playing'); }}>
                {status === 'paused' ? '▶️ Reprendre' : 'Compris'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="jeu-actions">
        {status === 'playing' && <button type="button" onClick={() => setStatus('paused')} aria-label="Mettre en pause">⏸️ Pause</button>}
      </div>
    </div>
  );
}
