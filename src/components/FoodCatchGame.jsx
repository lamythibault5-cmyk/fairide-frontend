import { useEffect, useRef, useState } from 'react';

// Petit jeu casual à côté de la carte de suivi, pour patienter pendant la livraison sans perdre la
// carte des yeux : attrape les plats qui tombent avec le panier. Rater un plat (qui touche le fond sans
// être attrapé) fait recommencer la partie à zéro — le meilleur score est gardé (localStorage) et affiché
// au-dessus du score courant. Un palier de difficulté tous les 10 points (chute plus rapide, spawn plus
// fréquent), plafonné pour rester jouable. Ne démarre pas tout seul : le client choisit quand jouer
// (bouton Commencer), peut mettre en pause, puis reprendre où il en était ou recommencer à zéro.
const FOODS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮', '🥐', '🍦'];
const WIDTH = 110;
const HEIGHT = 260;
const BASKET_WIDTH = 34;
const BASKET_Y = HEIGHT - 32;
const ITEM_SIZE = 22;
const BASE_SPAWN_EVERY_TICKS = 16;
const MIN_SPAWN_EVERY_TICKS = 7;
const TICK_MS = 60;
const BEST_SCORE_KEY = 'fairide_food_catch_best';
const POINTS_PER_LEVEL = 10;
const MAX_LEVEL = 8;

function levelForScore(s) {
  return Math.min(MAX_LEVEL, Math.floor(s / POINTS_PER_LEVEL));
}
function spawnEveryForLevel(level) {
  return Math.max(MIN_SPAWN_EVERY_TICKS, BASE_SPAWN_EVERY_TICKS - level * 1.2);
}
function speedRangeForLevel(level) {
  return { min: 2 + level * 0.35, max: 4.2 + level * 0.55 };
}

export default function FoodCatchGame() {
  const [status, setStatus] = useState('idle'); // 'idle' | 'playing' | 'paused'
  const [items, setItems] = useState([]);
  const [basketX, setBasketX] = useState(WIDTH / 2 - BASKET_WIDTH / 2);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => Number(localStorage.getItem(BEST_SCORE_KEY)) || 0);
  const [justLost, setJustLost] = useState(false);
  const basketXRef = useRef(basketX);
  const scoreRef = useRef(0);
  const bestScoreRef = useRef(bestScore);
  const nextIdRef = useRef(0);
  const tickRef = useRef(0);
  const ticksSinceSpawnRef = useRef(0);
  const lostMsgTimeoutRef = useRef(null);

  function loseRound() {
    if (scoreRef.current > bestScoreRef.current) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);
      localStorage.setItem(BEST_SCORE_KEY, String(scoreRef.current));
    }
    scoreRef.current = 0;
    setScore(0);
    setJustLost(true);
    if (lostMsgTimeoutRef.current) clearTimeout(lostMsgTimeoutRef.current);
    lostMsgTimeoutRef.current = setTimeout(() => setJustLost(false), 1200);
  }

  useEffect(() => {
    if (status !== 'playing') return undefined;
    const interval = setInterval(() => {
      tickRef.current += 1;
      setItems((prev) => {
        let missed = false;
        let next = prev
          .map((it) => ({ ...it, y: it.y + it.speed }))
          .filter((it) => {
            const bx = basketXRef.current;
            const caught = it.y + ITEM_SIZE >= BASKET_Y && it.y <= BASKET_Y + 18 && it.x + ITEM_SIZE > bx && it.x < bx + BASKET_WIDTH;
            if (caught) { scoreRef.current += 1; setScore(scoreRef.current); return false; }
            if (it.y >= HEIGHT) { missed = true; return false; }
            return true;
          });
        if (missed) {
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
              emoji: FOODS[Math.floor(Math.random() * FOODS.length)]
            }];
          }
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => () => {
    if (lostMsgTimeoutRef.current) clearTimeout(lostMsgTimeoutRef.current);
  }, []);

  function move(dir) {
    setBasketX((x) => {
      const next = Math.max(0, Math.min(WIDTH - BASKET_WIDTH, x + dir * 16));
      basketXRef.current = next;
      return next;
    });
  }

  function startGame() {
    scoreRef.current = 0;
    ticksSinceSpawnRef.current = 0;
    setScore(0);
    setItems([]);
    setJustLost(false);
    setStatus('playing');
  }

  function pauseGame() {
    setStatus('paused');
  }

  function resumeGame() {
    setStatus('playing');
  }

  function restartGame() {
    startGame();
  }

  return (
    <div className="food-catch-game">
      <div className="food-catch-best">🥇 Meilleur : {bestScore}</div>
      <div className="food-catch-score">🏆 {score} <span className="food-catch-level">· Niv. {levelForScore(score) + 1}</span></div>
      <div className="food-catch-field" style={{ width: WIDTH, height: HEIGHT }}>
        {items.map((it) => (
          <span key={it.id} className="food-catch-item" style={{ left: it.x, top: it.y }}>{it.emoji}</span>
        ))}
        <div className="food-catch-basket" style={{ left: basketX, width: BASKET_WIDTH }}>🧺</div>
        {justLost && <div className="food-catch-lost">💥 Raté !<br />On recommence</div>}
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
          <>
            <button type="button" onClick={() => move(-1)} aria-label="Déplacer à gauche">◀️</button>
            <button type="button" onClick={pauseGame} aria-label="Mettre en pause">⏸️</button>
            <button type="button" onClick={() => move(1)} aria-label="Déplacer à droite">▶️</button>
          </>
        )}
      </div>
    </div>
  );
}
