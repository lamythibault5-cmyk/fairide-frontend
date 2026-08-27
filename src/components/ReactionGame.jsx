import { useEffect, useRef, useState } from 'react';

// Variante "réflexe" du mini-jeu à côté de la carte : une cible apparaît à un endroit aléatoire du
// cadre, il faut taper dessus avant qu'elle disparaisse. Une cible manquée (temps écoulé sans clic)
// termine la partie — jamais de reprise automatique, toujours le joueur qui relance via "Rejouer".
// Réutilise les mêmes classes CSS .food-catch-* que FoodCatchGame.jsx.
const BASE_WINDOW_MS = 1500;
const MIN_WINDOW_MS = 550;
const BEST_SCORE_KEY = 'fairide_reaction_best';
const POINTS_PER_LEVEL = 8;
const MAX_LEVEL = 8;

function levelForScore(s) {
  return Math.min(MAX_LEVEL, Math.floor(s / POINTS_PER_LEVEL));
}
function windowForLevel(level) {
  return Math.max(MIN_WINDOW_MS, BASE_WINDOW_MS - level * 120);
}

// Fonction de module (pas dans le composant) : width/height/targetSize lui sont passés explicitement
// plutôt que capturés par fermeture, pour rester utilisable indépendamment du composant.
function randomTargetPos(width, height, targetSize) {
  return {
    x: Math.random() * (width - targetSize),
    y: Math.random() * (height - targetSize)
  };
}

export default function ReactionGame({ width = 110, height = 260, large = false }) {
  const WIDTH = width;
  const HEIGHT = height;
  const TARGET_SIZE = large ? 56 : 34;
  const [status, setStatus] = useState('idle');
  const [target, setTarget] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_KEY)) || 0);
  const [isNewBest, setIsNewBest] = useState(false);
  const statusRef = useRef(status);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(bestScore);
  const timeoutRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function loseRound() {
    const beatBest = scoreRef.current > bestScoreRef.current;
    if (beatBest) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);
      localStorage.setItem(BEST_SCORE_KEY, String(scoreRef.current));
    }
    setIsNewBest(beatBest);
    setTarget(null);
    setStatus('lost');
  }

  function spawnTarget() {
    setTarget(randomTargetPos(WIDTH, HEIGHT, TARGET_SIZE));
    const level = levelForScore(scoreRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (statusRef.current === 'playing') loseRound();
    }, windowForLevel(level));
  }

  useEffect(() => {
    if (status !== 'playing') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return undefined;
    }
    spawnTarget();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function hitTarget() {
    if (status !== 'playing') return;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    spawnTarget();
  }

  function startGame() {
    scoreRef.current = 0;
    setScore(0);
    setIsNewBest(false);
    setStatus('playing');
  }

  function pauseGame() { setStatus('paused'); }
  function resumeGame() { setStatus('playing'); }
  function restartGame() { startGame(); }

  return (
    <div className={`food-catch-game${large ? ' food-catch-game--large' : ''}`}>
      <div className="food-catch-best">🥇 Meilleur : {bestScore}</div>
      <div className="food-catch-score">🏆 {score} <span className="food-catch-level">· Niv. {levelForScore(score) + 1}</span></div>
      <div className="food-catch-field" style={{ width: WIDTH, height: HEIGHT }}>
        {status === 'playing' && target && (
          <button
            type="button"
            className="reaction-target"
            style={{ left: target.x, top: target.y, width: TARGET_SIZE, height: TARGET_SIZE }}
            onClick={hitTarget}
            aria-label="Cible"
          >🎯</button>
        )}
        {status === 'idle' && (
          <div className="food-catch-overlay">
            <div className="food-catch-overlay-card">
              <span className="food-catch-overlay-title">🎯 FairFlash : tape la cible !</span>
              <button type="button" className="food-catch-start" onClick={startGame}>▶️ Commencer</button>
            </div>
          </div>
        )}
        {status === 'paused' && (
          <div className="food-catch-overlay">
            <div className="food-catch-overlay-card">
              <span className="food-catch-paused-label">⏸️ En pause</span>
              <div className="food-catch-overlay-buttons">
                <button type="button" onClick={resumeGame}>▶️ Continuer</button>
                <button type="button" className="food-catch-btn-ghost" onClick={restartGame}>🔄 Recommencer</button>
              </div>
            </div>
          </div>
        )}
        {status === 'lost' && (
          <div className="food-catch-overlay">
            <div className="food-catch-overlay-card">
              <span className="food-catch-lost-title">⏱️ Trop lent !</span>
              <span className="food-catch-lost-score">Score : {score}{isNewBest ? ' — 🎉 nouveau record !' : ''}</span>
              <button type="button" className="food-catch-start" onClick={restartGame}>🔄 Rejouer</button>
            </div>
          </div>
        )}
      </div>
      <div className="food-catch-controls">
        {status === 'playing' && (
          <button type="button" onClick={pauseGame} aria-label="Mettre en pause">⏸️ Pause</button>
        )}
      </div>
    </div>
  );
}
