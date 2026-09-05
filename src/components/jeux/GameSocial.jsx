import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

// La couche « sociale » des mini-jeux : pseudo du joueur, accord pour l'afficher, meilleurs scores
// envoyés au serveur, et podium des 3 meilleurs joueurs publics de chaque jeu (routes/games.js).
//
// Le joueur choisit son pseudo la première fois qu'il lance une partie. Il décide alors s'il accepte
// d'apparaître publiquement : s'il refuse, ses scores sont quand même gardés (il voit son meilleur),
// mais il ne figure sur aucun podium. Sans compte (page publique), on joue sans pseudo ni podium
// personnel : rien ne bloque.

export function useGameSocial() {
  const { token, user } = useAuth();
  const [profil, setProfil] = useState(null); // { pseudo, public, scores } — null tant que non chargé
  const [podium, setPodium] = useState({});
  const [modal, setModal] = useState(null); // { apres: fn | null } — fn = partie à lancer après l'enregistrement

  const chargerPodium = useCallback(() => {
    api('/games/leaderboard').then(setPodium).catch(() => { /* podium indisponible : le jeu reste jouable */ });
  }, []);
  useEffect(() => { chargerPodium(); }, [chargerPodium]);
  useEffect(() => {
    if (!token) { setProfil(null); return; }
    api('/games/me', { token }).then(setProfil).catch(() => setProfil({ pseudo: '', public: false, scores: {} }));
  }, [token]);

  // Le jeu demande à démarrer : connecté sans pseudo, on passe d'abord par la fenêtre de pseudo.
  const demanderDepart = useCallback((demarrer) => {
    if (!token || profil?.pseudo) { demarrer(); return; }
    setModal({ apres: demarrer });
  }, [token, profil]);

  const sauverProfil = useCallback(async (pseudo, publique) => {
    const r = await api('/games/profile', { method: 'PATCH', token, body: { pseudo, public: publique } });
    setProfil((p) => ({ ...(p || { scores: {} }), pseudo: r.pseudo, public: r.public }));
    chargerPodium();
    return r;
  }, [token, chargerPodium]);

  const envoyerScore = useCallback(async (game, score) => {
    if (!token || !(score > 0)) return;
    try {
      const r = await api('/games/score', { method: 'POST', token, body: { game, score } });
      setProfil((p) => (p ? { ...p, scores: { ...p.scores, [game]: r.best } } : p));
      chargerPodium();
    } catch { /* le score local (localStorage) reste ; le serveur se rattrapera à la prochaine partie */ }
  }, [token, chargerPodium]);

  return {
    profil, podium, modal, connecte: !!token, moiId: user?.id,
    demanderDepart, sauverProfil, envoyerScore,
    ouvrirProfil: () => setModal({ apres: null }),
    fermerModal: () => setModal(null)
  };
}

export function PseudoModal({ profil, onSave, onClose, apres }) {
  const { t } = useLanguage();
  const [pseudo, setPseudo] = useState(profil?.pseudo || '');
  // Premier pseudo : la case est cochée par défaut (c'est le sens d'un podium) ; ensuite, on respecte le choix fait.
  const [publique, setPublique] = useState(profil?.pseudo ? !!profil.public : true);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const obligatoire = typeof apres === 'function';

  async function valider(e) {
    e.preventDefault();
    if (pseudo.trim().length < 2) { setErreur(t('gameSocial.pseudoTooShort')); return; }
    setEnvoi(true); setErreur('');
    try {
      await onSave(pseudo.trim(), publique);
      onClose();
      apres?.();
    } catch (err) {
      setErreur(err.message || t('gameSocial.saveError'));
    } finally { setEnvoi(false); }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('gameSocial.modalTitle')} onClick={obligatoire ? undefined : onClose}>
      <form className="modal-box pseudo-modal" onClick={(e) => e.stopPropagation()} onSubmit={valider}>
        <h3 style={{ marginTop: 0 }}>🎮 {t('gameSocial.modalTitle')}</h3>
        <p className="small">{t('gameSocial.modalIntro')}</p>
        <div className="field">
          <label htmlFor="pseudo-jeu">{t('gameSocial.pseudoLabel')}</label>
          <input id="pseudo-jeu" value={pseudo} maxLength={20} autoFocus onChange={(e) => setPseudo(e.target.value)} placeholder={t('gameSocial.pseudoPlaceholder')} />
        </div>
        <label className="pseudo-public">
          <input type="checkbox" checked={publique} onChange={(e) => setPublique(e.target.checked)} />
          <span>
            <b>{t('gameSocial.publicLabel')}</b>
            <span className="small" style={{ display: 'block' }}>{t('gameSocial.publicHelp')}</span>
          </span>
        </label>
        {erreur && <p className="small" style={{ color: 'var(--red)', margin: '4px 0 0' }}>{erreur}</p>}
        <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          {!obligatoire && <button type="button" className="btn-ghost" onClick={onClose}>{t('gameSocial.close')}</button>}
          <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : obligatoire ? t('gameSocial.saveAndPlay') : t('gameSocial.save')}</button>
        </div>
      </form>
    </div>
  );
}

const MEDAILLES = ['🥇', '🥈', '🥉'];

export function Podium({ jeu, entrees, profil, connecte, moiId, onEditer, large = false }) {
  const { t } = useLanguage();
  const mien = profil?.scores?.[jeu.key] || 0;
  return (
    <div className={`podium${large ? ' podium--large' : ''}`} aria-label={t('gameSocial.podiumTitle')}>
      <div className="podium-titre">
        <span>{t('gameSocial.podiumTitle')} · {jeu.label}</span>
        {connecte && profil && (
          <button type="button" className="podium-editer" onClick={onEditer} title={t('gameSocial.editPseudo')} aria-label={t('gameSocial.editPseudo')}>✏️</button>
        )}
      </div>
      {entrees.length === 0 ? (
        <p className="small podium-vide">{t('gameSocial.empty')}</p>
      ) : (
        <ol className="podium-liste">
          {entrees.map((e, i) => (
            <li key={`${e.userId}-${i}`} className={e.userId === moiId ? 'moi' : undefined}>
              <span className="podium-medaille" aria-hidden="true">{MEDAILLES[i]}</span>
              <span className="podium-pseudo">{e.pseudo}{e.userId === moiId ? ` ${t('gameSocial.you')}` : ''}</span>
              <b className="podium-score">{e.best}</b>
            </li>
          ))}
        </ol>
      )}
      {connecte && profil && (
        <p className="small podium-moi">
          {profil.pseudo ? `${profil.pseudo} · ` : ''}{t('gameSocial.yourBest', { n: mien })}
          {profil.pseudo && !profil.public ? ` · ${t('gameSocial.hidden')}` : ''}
        </p>
      )}
    </div>
  );
}
