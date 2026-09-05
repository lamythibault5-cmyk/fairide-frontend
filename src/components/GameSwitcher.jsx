import { useState } from 'react';
import GameFrame from './jeux/GameFrame';
import { JEUX } from './jeux/jeux';

// Le choix du mini-jeu à côté de la carte de suivi. Six jeux, chacun avec son meilleur score
// (localStorage, une clé par jeu — voir jeux.js) ; changer de jeu démonte l'ancien proprement grâce au
// `key`, ce qui arrête sa boucle. Le bouton 📖 des règles vit dans le cadre du jeu (GameFrame) : il
// est toujours celui du jeu affiché, pas un par onglet — six petits livres côte à côte ne se liraient
// pas.
//
// `pourquoi` : une phrase qui explique ce que des jeux font sur une carte de livraison (rester devant la
// carte sans attendre pour rien, voir le livreur arriver). Derrière un 💡 : la personne qui se pose la
// question la trouve, celle qui ne se la pose pas n'a pas un paragraphe sous les yeux.
// `fill` : le cadre prend toute la place de son conteneur (plein écran, carte masquée). Sinon la
// taille est fixe, pensée pour la colonne à côté de la carte.
const CLE_INDEX = 'fairide_game_switcher_index';

export default function GameSwitcher({ width = 140, height = 280, fill = false, large = false, pourquoi }) {
  const [index, setIndex] = useState(() => {
    const sauve = Number(localStorage.getItem(CLE_INDEX));
    return Number.isInteger(sauve) && sauve >= 0 && sauve < JEUX.length ? sauve : 0;
  });
  const [pourquoiOuvert, setPourquoiOuvert] = useState(false);
  function choisir(i) { setIndex(i); try { localStorage.setItem(CLE_INDEX, String(i)); } catch { /* sans stockage, le choix vaut pour la page */ } }
  const jeu = JEUX[index];

  return (
    // Compact : le bloc a la largeur du terrain, sinon la bulle 💡 l'élargirait à la longueur de sa phrase
    // et écraserait la carte à côté.
    <div className={`game-switcher${large ? ' game-switcher--large' : ''}${fill ? ' game-switcher--fill' : ''}`} style={fill || large ? undefined : { width }}>
      {pourquoi && (
        <div className="game-switcher-entete">
          <span className="game-switcher-entete-titre">🎮 Mini-jeux</span>
          <button type="button" className="game-switcher-pourquoi" onClick={() => setPourquoiOuvert((o) => !o)} aria-expanded={pourquoiOuvert} aria-label="Pourquoi des jeux ?" title="Pourquoi des jeux ?">💡</button>
        </div>
      )}
      {pourquoi && pourquoiOuvert && (
        <div className="game-switcher-pourquoi-bulle" role="note">
          <b>💡 Pourquoi des jeux ?</b> {pourquoi}
          <button type="button" className="game-switcher-pourquoi-ok" onClick={() => setPourquoiOuvert(false)}>Compris</button>
        </div>
      )}
      <div className="game-switcher-picker" role="tablist" aria-label="Choisir un mini-jeu">
        {JEUX.map((g, i) => (
          <button key={g.key} type="button" role="tab" aria-selected={i === index} title={`${g.label} — ${g.sub}`}
            className={`game-switcher-tab${i === index ? ' active' : ''}`} onClick={() => choisir(i)}>
            <span className="game-switcher-tab-emoji" aria-hidden="true">{g.emoji}</span>
            {large && (
              <span className="game-switcher-tab-text">
                <span className="game-switcher-tab-label">{g.label}</span>
                <span className="game-switcher-tab-sub">{g.sub}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <GameFrame key={jeu.key} jeu={jeu} width={width} height={height} fill={fill} large={large} />
    </div>
  );
}
