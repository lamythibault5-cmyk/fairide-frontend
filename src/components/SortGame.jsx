import { useEffect, useRef, useState } from 'react';

// Variante "triage" du mini-jeu à côté de la carte : à la fois des bons plats et des mauvais objets
// tombent — attrape les bons (score+1), mais si un mauvais tombe dans le panier la partie s'arrête
// (jamais de reprise automatique, toujours le joueur qui relance via "Rejouer"). Rater un bon plat
// (non attrapé) n'est pas pénalisé, seul le choix compte. Réutilise les mêmes classes CSS
// .food-catch-* que FoodCatchGame.jsx.
const GOOD_ITEMS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮'];
const BAD_ITEMS = ['🗑️', '🦠', '💀', '🧪'];
const BASE_SPAWN_EVERY_TICKS = 17;
const MIN_SPAWN_EVERY_TICKS = 8;
const TICK_MS = 60;
const BEST_SCORE_KEY = 'fairide_sort_best';
const POINTS_PER_LEVEL = 10;
const MAX_LEVEL = 8;
// Chance qu'un objet qui tombe soit un mauvais objet plutôt qu'un bon plat, croissante par niveau —
// plafonnée pour que ça reste jouable même au niveau max.
const BASE_BAD_CHANCE = 0.22;
const MAX_BAD_CHANCE = 0.45;

function levelForScore(s) {
  return Math.min(MAX_LEVEL, Math.floor(s / POINTS_PER_LEVEL));
}
function spawnEveryForLevel(level) {
  return Math.max(MIN_SPAWN_EVERY_TICKS, BASE_SPAWN_EVERY_TICKS - level * 1.1);
}
function speedRangeForLevel(level) {
  return { min: 2 + level * 0.3, max: 4 + level * 0.5 };
}
function badChanceForLevel(level) {
  return Math.min(MAX_BAD_CHANCE, BASE_BAD_CHANCE + level * 0.03);
}

export default function SortGame({ width = 110, height = 260, large = false }) {
  const WIDTH = width;
  const HEIGHT = height;
  const BASKET_WIDTH = large ? 56 : 34;
  const BASKET_Y = HEIGHT - (large ? 44 : 32);
  const ITEM_SIZE = large ? 34 : 22;
  const [status, setStatus] = useState('idle');
  const [items, setItems] = useState([]);
  const [basketX, setBasketX] = useState(WIDTH / 2 - BASKET_WIDTH / 2);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_KEY)) || 0);
  const [isNewBest, setIsNewBest] = useState(false);
  const basketXRef = useRef(basketX);
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
        let caughtBad = false;
        let next = prev
          .map((it) => ({ ...it, y: it.y + it.speed }))
          .filter((it) => {
            const bx = basketXRef.current;
            const caught = it.y + ITEM_SIZE >= BASKET_Y && it.y <= BASKET_Y + 18 && it.x + ITEM_SIZE > bx && it.x < bx + BASKET_WIDTH;
            if (caught) {
              if (it.bad) { caughtBad = true; return false; }
              scoreRef.current += 1;
              setScore(scoreRef.current);
              return false;
            }
            return it.y < HEIGHT;
          });
        if (caughtBad) {
          loseRound();
          next = [];
          ticksSinceSpawnRef.current = 0;
        } else {
          ticksSinceSpawnRef.current += 1;
          const level = levelForScore(scoreRef.current);
          if (ticksSinceSpawnRef.current >= spawnEveryForLevel(level)) {
            ticksSinceSpawnRef.current = 0;
            const { min, max } = speedRangeForLevel(level);
            const bad = Math.random() < badChanceForLevel(level);
            const pool = bad ? BAD_ITEMS : GOOD_ITEMS;
            next = [...next, {
              id: nextIdRef.current++,
              x: Math.random() * (WIDTH - ITEM_SIZE),
              y: -ITEM_SIZE,
              speed: min + Math.random() * (max - min),
              emoji: pool[Math.floor(Math.random() * pool.length)],
              bad
            }];
          }
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
    // Voir FoodCatchGame.jsx : WIDTH/HEIGHT/BASKET_WIDTH/BASKET_Y/ITEM_SIZE dérivent de props fixes pour
    // toute la durée de vie du composant, volontairement absents des deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function followPointer(e) {
    if (status !== 'playing' || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const next = Math.max(0, Math.min(WIDTH - BASKET_WIDTH, e.clientX - rect.left - BASKET_WIDTH / 2));
    basketXRef.current = next;
    setBasketX(next);
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
          <span key={it.id} className="food-catch-item" style={{ transform: `translate3d(${it.x}px, ${it.y}px, 0)` }}>{it.emoji}</span>
        ))}
        <div className="food-catch-basket" style={{ transform: `translate3d(${basketX}px, 0, 0)`, width: BASKET_WIDTH }}>🧺</div>
        {status === 'idle' && (
          <div className="food-catch-overlay">
            <div className="food-catch-overlay-card">
              <span className="food-catch-overlay-title">🗑️ FairSort : attrape les bons plats, évite le reste !</span>
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
              <span className="food-catch-lost-title">🤢 Mauvais choix !</span>
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
