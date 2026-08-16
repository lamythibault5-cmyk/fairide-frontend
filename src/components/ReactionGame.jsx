import { useEffect, useRef, useState } from 'react';

// Variante "réflexe" du mini-jeu à côté de la carte : une cible apparaît à un endroit aléatoire du
// cadre, il faut taper dessus avant qu'elle disparaisse. Une cible manquée (temps écoulé sans clic) fait
// recommencer la partie à zéro. Réutilise les mêmes classes CSS .food-catch-* que FoodCatchGame.jsx.
const WIDTH = 110;
const HEIGHT = 260;
const TARGET_SIZE = 34;
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

function randomTargetPos() {
  return {
    x: Math.random() * (WIDTH - TARGET_SIZE),
    y: Math.random() * (HEIGHT - TARGET_SIZE)
  };
}

export default function ReactionGame() {
  const [status, setStatus] = useState('idle');
  const [target, setTarget] = useState(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_KEY)) || 0);
  const [justLost, setJustLost] = useState(false);
  const statusRef = useRef(status);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(bestScore);
  const timeoutRef = useRef(null);
  const lostMsgTimeoutRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  function loseRound() {
    if (scoreRef.current > bestScoreRef.current) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);
      localStorage.setItem(BEST_SCORE_KEY, String(scoreRef.current));
    }
    scoreRef.current = 0;
    setScore(0);
    setTarget(null);
    setJustLost(true);
    if (lostMsgTimeoutRef.current) clearTimeout(lostMsgTimeoutRef.current);
    // Le pause peut arriver pendant ce délai d'1.2s — on ne relance la cible que si la partie est
    // toujours en cours à ce moment-là, sinon une nouvelle cible/minuteur tournerait en arrière-plan
    // pendant la pause et ferait perdre à nouveau avant même que le joueur ait repris.
    lostMsgTimeoutRef.current = setTimeout(() => {
      setJustLost(false);
      if (statusRef.current === 'playing') spawnTarget();
    }, 1200);
  }

  function spawnTarget() {
    setTarget(randomTargetPos());
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
    if (lostMsgTimeoutRef.current) clearTimeout(lostMsgTimeoutRef.current);
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
    setJustLost(false);
    setStatus('playing');
  }

  function pauseGame() { setStatus('paused'); }
  function resumeGame() { setStatus('playing'); }
  function restartGame() { startGame(); }

  return (
    <div className="food-catch-game">
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
        {justLost && <div className="food-catch-lost">⏱️ Trop lent !<br />On recommence</div>}
        {status === 'idle' && !justLost && (
          <div className="food-catch-overlay">
            <button type="button" className="food-catch-start" onClick={startGame}>▶️ Commencer</button>
          </div>
        )}
        {status === 'paused' && (
          <div className="food-catch-overlay">
            <span className="food-catch-paused-label">⏸️ En pause</span>
            <div className="food-catch-overlay-buttons">
              <button type="button" onClick={resumeGame}>▶️ Continuer</button>
              <button type="button" onClick={restartGame}>🔄 Recommencer</button>
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
