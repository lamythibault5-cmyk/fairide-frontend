import { useEffect, useRef, useState } from 'react';

// Petit jeu casual à côté de la carte de suivi, pour patienter pendant la livraison sans perdre la
// carte des yeux : attrape les plats qui tombent avec le panier. Pas de "game over" — juste un score qui
// monte, pensé pour être regardé du coin de l'œil plutôt que pour exiger toute l'attention du client.
const FOODS = ['🍕', '🍔', '🍟', '🍩', '🍣', '🌮', '🥐', '🍦'];
const WIDTH = 110;
const HEIGHT = 260;
const BASKET_WIDTH = 34;
const BASKET_Y = HEIGHT - 32;
const ITEM_SIZE = 22;
const SPAWN_EVERY_TICKS = 16;
const TICK_MS = 60;

export default function FoodCatchGame() {
  const [items, setItems] = useState([]);
  const [basketX, setBasketX] = useState(WIDTH / 2 - BASKET_WIDTH / 2);
  const [score, setScore] = useState(0);
  const basketXRef = useRef(basketX);
  const nextIdRef = useRef(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      tickRef.current += 1;
      setItems((prev) => {
        let next = prev
          .map((it) => ({ ...it, y: it.y + it.speed }))
          .filter((it) => {
            const bx = basketXRef.current;
            const caught = it.y + ITEM_SIZE >= BASKET_Y && it.y <= BASKET_Y + 18 && it.x + ITEM_SIZE > bx && it.x < bx + BASKET_WIDTH;
            if (caught) { setScore((s) => s + 1); return false; }
            return it.y < HEIGHT;
          });
        if (tickRef.current % SPAWN_EVERY_TICKS === 0) {
          next = [...next, {
            id: nextIdRef.current++,
            x: Math.random() * (WIDTH - ITEM_SIZE),
            y: -ITEM_SIZE,
            speed: 2 + Math.random() * 2.2,
            emoji: FOODS[Math.floor(Math.random() * FOODS.length)]
          }];
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  function move(dir) {
    setBasketX((x) => {
      const next = Math.max(0, Math.min(WIDTH - BASKET_WIDTH, x + dir * 16));
      basketXRef.current = next;
      return next;
    });
  }

  return (
    <div className="food-catch-game">
      <div className="food-catch-score">🏆 {score}</div>
      <div className="food-catch-field" style={{ width: WIDTH, height: HEIGHT }}>
        {items.map((it) => (
          <span key={it.id} className="food-catch-item" style={{ left: it.x, top: it.y }}>{it.emoji}</span>
        ))}
        <div className="food-catch-basket" style={{ left: basketX, width: BASKET_WIDTH }}>🧺</div>
      </div>
      <div className="food-catch-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Déplacer à gauche">◀️</button>
        <button type="button" onClick={() => move(1)} aria-label="Déplacer à droite">▶️</button>
      </div>
    </div>
  );
}
