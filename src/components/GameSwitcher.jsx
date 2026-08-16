import { useState } from 'react';
import FoodCatchGame from './FoodCatchGame';
import DodgeGame from './DodgeGame';
import ReactionGame from './ReactionGame';
import SortGame from './SortGame';

// Regroupe les 4 mini-jeux disponibles à côté de la carte de suivi, avec un bouton pour passer de l'un
// à l'autre. Chaque jeu garde son propre meilleur score (localStorage séparé par jeu) — changer de jeu
// n'affecte pas les scores des autres. Le `key` sur le composant force un démontage propre à chaque
// changement (arrête proprement la boucle de jeu précédente).
const GAMES = [
  { key: 'catch', label: 'Attrape', emoji: '🧺', Component: FoodCatchGame },
  { key: 'dodge', label: 'Évite', emoji: '🚧', Component: DodgeGame },
  { key: 'reaction', label: 'Réflexe', emoji: '🎯', Component: ReactionGame },
  { key: 'sort', label: 'Triage', emoji: '🗑️', Component: SortGame }
];
const GAME_INDEX_KEY = 'fairide_game_switcher_index';

export default function GameSwitcher() {
  const [index, setIndex] = useState(() => {
    const saved = Number(localStorage.getItem(GAME_INDEX_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < GAMES.length ? saved : 0;
  });

  function nextGame() {
    const next = (index + 1) % GAMES.length;
    setIndex(next);
    localStorage.setItem(GAME_INDEX_KEY, String(next));
  }

  const game = GAMES[index];
  const GameComponent = game.Component;

  return (
    <div className="game-switcher">
      <button type="button" className="game-switcher-btn" onClick={nextGame}>
        🔄 {game.emoji} {game.label}
      </button>
      <GameComponent key={game.key} />
    </div>
  );
}
