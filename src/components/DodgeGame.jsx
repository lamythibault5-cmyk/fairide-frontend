import { useEffect, useRef, useState } from 'react';

// Variante "évite les obstacles" du mini-jeu à côté de la carte : déplace le livreur pour ne pas se
// faire toucher par les obstacles qui tombent. Toucher un obstacle termine la partie — jamais de reprise
// automatique, c'est toujours le joueur qui relance via le bouton "Rejouer" (voir status === 'lost').
// Réutilise les mêmes classes CSS .food-catch-* que FoodCatchGame.jsx (structure visuelle partagée par
// tous les mini-jeux : score, meilleur score, cadre, overlays début/pause/perdu).
const OBSTACLES = ['🚧', '🪨', '🕳️', '🔥', '💥'];
const BASE_SPAWN_EVERY_TICKS = 20;
const MIN_SPAWN_EVERY_TICKS = 9;
const TICK_MS = 60;
const BEST_SCORE_KEY = 'fairide_dodge_best';
const POINTS_PER_LEVEL = 10;
const MAX_LEVEL = 8;

function levelForScore(s) {
  return Math.min(MAX_LEVEL, Math.floor(s / POINTS_PER_LEVEL));
}
function spawnEveryForLevel(level) {
  return Math.max(MIN_SPAWN_EVERY_TICKS, BASE_SPAWN_EVERY_TICKS - level * 1.3);
}
function speedRangeForLevel(level) {
  return { min: 1.8 + level * 0.3, max: 3.6 + level * 0.5 };
}

export default function DodgeGame({ width = 110, height = 260, large = false }) {
  const WIDTH = width;
  const HEIGHT = height;
  const RIDER_WIDTH = large ? 50 : 30;
  const RIDER_Y = HEIGHT - (large ? 44 : 32);
  const ITEM_SIZE = large ? 34 : 22;
  const [status, setStatus] = useState('idle');
  const [items, setItems] = useState([]);
  const [riderX, setRiderX] = useState(WIDTH / 2 - RIDER_WIDTH / 2);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_KEY)) || 0);
  const [isNewBest, setIsNewBest] = useState(false);
  const riderXRef = useRef(riderX);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(bestScore);
  const nextIdRef = useRef(0);
  const ticksSinceSpawnRef = useRef(0);
  const fieldRef = useRef(null);

  function loseRound() {
    const beatBest = scoreRef.current > bestScoreRef.current;
    if (beatBest) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);
      localStorage.setItem(BEST_SCORE_KEY, String(scoreRef.current));
    }
    setIsNewBest(beatBest);
    setStatus('lost');
  }

  useEffect(() => {
    if (status !== 'playing') return undefined;
    const interval = setInterval(() => {
      setItems((prev) => {
        let hit = false;
        let next = prev
          .map((it) => ({ ...it, y: it.y + it.speed }))
          .filter((it) => {
            const rx = riderXRef.current;
            const touching = it.y + ITEM_SIZE >= RIDER_Y && it.y <= RIDER_Y + 18 && it.x + ITEM_SIZE > rx && it.x < rx + RIDER_WIDTH;
            if (touching) { hit = true; return false; }
            if (it.y >= HEIGHT) { scoreRef.current += 1; setScore(scoreRef.current); return false; }
            return true;
          });
        if (hit) {
          loseRound();
          next = [];
          ticksSinceSpawnRef.current = 0;
        } else {
          ticksSinceSpawnRef.current += 1;
          const level = levelForScore(scoreRef.current);
          if (ticksSinceSpawnRef.current >= spawnEveryForLevel(level)) {
            ticksSinceSpawnRef.current = 0;
            const { min, max } = speedRangeForLevel(level);
            next = [...next, {
              id: nextIdRef.current++,
              x: Math.random() * (WIDTH - ITEM_SIZE),
              y: -ITEM_SIZE,
              speed: min + Math.random() * (max - min),
              emoji: OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)]
            }];
          }
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // Voir FoodCatchGame.jsx : WIDTH/HEIGHT/RIDER_WIDTH/RIDER_Y/ITEM_SIZE dérivent de props fixes pour
    // toute la durée de vie du composant, volontairement absents des deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function followPointer(e) {
    if (status !== 'playing' || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const next = Math.max(0, Math.min(WIDTH - RIDER_WIDTH, e.clientX - rect.left - RIDER_WIDTH / 2));
    riderXRef.current = next;
    setRiderX(next);
  }

  function startGame() {
    scoreRef.current = 0;
    ticksSinceSpawnRef.current = 0;
    setScore(0);
    setItems([]);
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
      <div
        ref={fieldRef}
        className="food-catch-field"
        style={{ width: WIDTH, height: HEIGHT }}
        onPointerDown={followPointer}
        onPointerMove={followPointer}
      >
        {items.map((it) => (
          <span key={it.id} className="food-catch-item" style={{ left: it.x, top: it.y }}>{it.emoji}</span>
        ))}
        <div className="food-catch-basket" style={{ left: riderX, width: RIDER_WIDTH }}>🛵</div>
        {status === 'idle' && (
          <div className="food-catch-overlay">
            <div className="food-catch-overlay-card">
              <span className="food-catch-overlay-title">🚧 FairDodge : évite les obstacles !</span>
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
              <span className="food-catch-lost-title">💥 Touché !</span>
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
