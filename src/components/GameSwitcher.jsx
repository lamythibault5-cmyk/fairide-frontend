import { useEffect, useState } from 'react';
import GameFrame, { tJeu } from './jeux/GameFrame';
import { JEUX } from './jeux/jeux';
import { Podium, PseudoModal, useGameSocial } from './jeux/GameSocial';
import { musique } from './jeux/musique';
import { useLanguage } from '../context/LanguageContext';

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
  const { t } = useLanguage();
  const [index, setIndex] = useState(() => {
    const sauve = Number(localStorage.getItem(CLE_INDEX));
    return Number.isInteger(sauve) && sauve >= 0 && sauve < JEUX.length ? sauve : 0;
  });
  const [pourquoiOuvert, setPourquoiOuvert] = useState(false);
  const social = useGameSocial();
  // Musique : relancée si le joueur l'avait activée la dernière fois (au premier geste, faute de quoi le navigateur
  // la refuserait), coupée quand on quitte la page — elle n'a pas à suivre l'utilisateur dans ses commandes.
  useEffect(() => {
    let relancer = null;
    if (musique.preference() && !musique.estActive()) {
      relancer = () => { musique.demarrer(); retirer(); };
      var retirer = () => ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, relancer));
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, relancer, { passive: true }));
    }
    return () => { if (relancer) retirer(); musique.arreter({ oublier: false }); };
  }, []);
  function choisir(i) { setIndex(i); try { localStorage.setItem(CLE_INDEX, String(i)); } catch { /* sans stockage, le choix vaut pour la page */ } }
  const jeu = JEUX[index];

  return (
    // Compact : le bloc a la largeur du terrain, sinon la bulle 💡 l'élargirait à la longueur de sa phrase
    // et écraserait la carte à côté.
    <div className={`game-switcher${large ? ' game-switcher--large' : ''}${fill ? ' game-switcher--fill' : ''}`} style={fill || large ? undefined : { width }}>
      {pourquoi && (
        <div className="game-switcher-entete">
          <span className="game-switcher-entete-titre">{t('games.title')}</span>
          <button type="button" className="game-switcher-pourquoi" onClick={() => setPourquoiOuvert((o) => !o)} aria-expanded={pourquoiOuvert} aria-label={t('games.why')} title={t('games.why')}>💡</button>
        </div>
      )}
      {pourquoi && pourquoiOuvert && (
        <div className="game-switcher-pourquoi-bulle" role="note">
          <b>{t('games.whyTitle')}</b> {pourquoi}
          <button type="button" className="game-switcher-pourquoi-ok" onClick={() => setPourquoiOuvert(false)}>{t('games.gotIt')}</button>
        </div>
      )}
      <div className="game-switcher-picker" role="tablist" aria-label={t('games.choose')}>
        {JEUX.map((g, i) => (
          <button key={g.key} type="button" role="tab" aria-selected={i === index} title={`${g.label} — ${tJeu(t, g, 'sub', g.sub)}`}
            className={`game-switcher-tab${i === index ? ' active' : ''}`} onClick={() => choisir(i)}>
            <span className="game-switcher-tab-emoji" aria-hidden="true">{g.emoji}</span>
            {large && (
              <span className="game-switcher-tab-text">
                <span className="game-switcher-tab-label">{g.label}</span>
                <span className="game-switcher-tab-sub">{tJeu(t, g, 'sub', g.sub)}</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <GameFrame key={jeu.key} jeu={jeu} width={width} height={height} fill={fill} large={large}
        onStartRequest={social.demanderDepart} onScore={(score) => social.envoyerScore(jeu.key, score)} />
      <Podium jeu={jeu} entrees={social.podium[jeu.key] || []} profil={social.profil} connecte={social.connecte} moiId={social.moiId} onEditer={social.ouvrirProfil} large={large || fill} />
      {social.modal && (
        <PseudoModal profil={social.profil} apres={social.modal.apres} onSave={social.sauverProfil} onClose={social.fermerModal} />
      )}
    </div>
  );
}
