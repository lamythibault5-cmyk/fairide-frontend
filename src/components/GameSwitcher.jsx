import { useState } from 'react';
import FoodCatchGame from './FoodCatchGame';
import DodgeGame from './DodgeGame';
import ReactionGame from './ReactionGame';
import SortGame from './SortGame';

// Regroupe les 4 mini-jeux disponibles à côté de la carte de suivi. Chaque jeu garde son propre
// meilleur score (localStorage séparé par jeu) — changer de jeu n'affecte pas les scores des autres.
// Le `key` sur le composant force un démontage propre à chaque changement (arrête proprement la boucle
// de jeu précédente). Chaque jeu porte un nom de la famille "Fair..." (écho au nom Fairide) tout en
// restant explicite sur la mécanique via le sous-titre, affiché en entier en mode plein écran (`large`)
// et réduit à l'icône (avec info-bulle) dans la colonne étroite à côté de la carte.
const GAMES = [
  { key: 'catch', label: 'FairCatch', sub: 'Attrape les plats', emoji: '🧺', Component: FoodCatchGame },
  { key: 'dodge', label: 'FairDodge', sub: 'Évite les obstacles', emoji: '🚧', Component: DodgeGame },
  { key: 'reaction', label: 'FairFlash', sub: 'Réflexes rapides', emoji: '🎯', Component: ReactionGame },
  { key: 'sort', label: 'FairSort', sub: 'Trie les bons plats', emoji: '🗑️', Component: SortGame }
];
const GAME_INDEX_KEY = 'fairide_game_switcher_index';

export default function GameSwitcher({ width = 110, height = 260, large = false }) {
  const [index, setIndex] = useState(() => {
    const saved = Number(localStorage.getItem(GAME_INDEX_KEY));
    return Number.isInteger(saved) && saved >= 0 && saved < GAMES.length ? saved : 0;
  });

  function pickGame(i) {
    setIndex(i);
    localStorage.setItem(GAME_INDEX_KEY, String(i));
  }

  const game = GAMES[index];
  const GameComponent = game.Component;

  return (
    <div className={`game-switcher${large ? ' game-switcher--large' : ''}`}>
      <div className="game-switcher-picker" role="tablist" aria-label="Choisir un mini-jeu">
        {GAMES.map((g, i) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={i === index}
            title={`${g.label} — ${g.sub}`}
            className={`game-switcher-tab${i === index ? ' active' : ''}`}
            onClick={() => pickGame(i)}
          >
            <span className="game-switcher-tab-emoji">{g.emoji}</span>
            {large && (
              <span className="game-switcher-tab-text">
                <span className="game-switcher-tab-label">{g.label}</span>
                <span className="game-switcher-tab-sub">{g.sub}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <GameComponent key={game.key} width={width} height={height} large={large} />
    </div>
  );
}
