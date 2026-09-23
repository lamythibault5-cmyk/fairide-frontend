import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import Icone from '../Icone';
import { useLanguage } from '../../context/LanguageContext';

// La couche « sociale » des mini-jeux : pseudo du joueur, accord pour l'afficher, meilleurs scores
// envoyés au serveur, et podium des 3 meilleurs joueurs publics de chaque jeu (routes/games.js).
//
// AVANT DE JOUER (demande du fondateur, 2026-09-17) : pseudo, puis une question posée franchement —
// « ton pseudo peut-il apparaître publiquement ? » — avec deux réponses, Oui / Non, dont AUCUNE n'est
// choisie d'avance. C'était une case cochée par défaut, qu'on validait sans la lire : un accord qui n'en
// était pas un. La fenêtre s'ouvre LA PREMIÈRE FOIS QU'ON LANCE UNE PARTIE (« Commencer », plein écran compris),
// pas à l'arrivée sur la page : on la pose au moment où la question a un sens (fondateur, 2026-09-17).
// Refuser l'affichage public garde les scores (on voit son meilleur) mais n'inscrit sur aucun podium.
// Sans compte, on joue sans pseudo ni podium personnel : rien ne bloque.
//
// LES ANCIENS PSEUDOS AUSSI (2026-09-17) : ceux créés avec la case cochée d'avance n'ont jamais vraiment répondu.
// Le serveur renvoie `consentement: false` tant que la question Oui / Non n'a pas reçu de réponse
// (users.game_consent_at) ; on la repose alors à leur prochaine partie, pseudo prérempli, sans réponse choisie.
// `consentement` absent (ancien serveur pendant un déploiement) = on ne repose rien.
const aRepondu = (p) => !!p?.pseudo && p.consentement !== false;

export function useGameSocial() {
  const { token, user } = useAuth();
  const [profil, setProfil] = useState(null); // { pseudo, public, scores } — null tant que non chargé
  const [podium, setPodium] = useState({});
  const [modal, setModal] = useState(null); // { apres: fn | null } — fn = partie à lancer après l'enregistrement
  // Partie demandée pendant que le profil se charge encore : on tranche dès qu'il arrive (sinon un joueur qui a
  // déjà un pseudo se le verrait redemander, ou un nouveau joueur partirait sans).
  const [enAttente, setEnAttente] = useState(null);

  const chargerPodium = useCallback(() => {
    api('/games/leaderboard').then(setPodium).catch(() => { /* podium indisponible : le jeu reste jouable */ });
  }, []);
  useEffect(() => { chargerPodium(); }, [chargerPodium]);
  useEffect(() => {
    if (!token) { setProfil(null); return; }
    api('/games/me', { token }).then(setProfil).catch(() => setProfil({ pseudo: '', public: false, scores: {} }));
  }, [token]);

  useEffect(() => {
    if (!enAttente || !profil) return;
    const demarrer = enAttente.demarrer; setEnAttente(null);
    if (aRepondu(profil)) demarrer(); else setModal({ apres: demarrer });
  }, [enAttente, profil]);

  // Le jeu demande à démarrer : première partie d'un joueur connecté sans pseudo = on pose d'abord la question.
  const demanderDepart = useCallback((demarrer) => {
    if (!token) { demarrer(); return; }
    if (!profil) { setEnAttente({ demarrer }); return; }
    if (aRepondu(profil)) { demarrer(); return; }
    setModal({ apres: demarrer });
  }, [token, profil]);

  const sauverProfil = useCallback(async (pseudo, publique) => {
    const r = await api('/games/profile', { method: 'PATCH', token, body: { pseudo, public: publique } });
    setProfil((p) => ({ ...(p || { scores: {} }), pseudo: r.pseudo, public: r.public, consentement: true }));
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
  // null = pas encore répondu : rien n'est choisi d'avance, ni pour un nouveau joueur ni pour un ancien pseudo à qui
  // on repose la question. Ensuite (modification via le crayon du podium), on reprend le choix déjà fait.
  const [publique, setPublique] = useState(aRepondu(profil) ? !!profil.public : null);
  const reposee = !!profil?.pseudo && !aRepondu(profil);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const obligatoire = typeof apres === 'function';

  async function valider(e) {
    e.preventDefault();
    if (pseudo.trim().length < 2) { setErreur(t('gameSocial.pseudoTooShort')); return; }
    if (publique === null) { setErreur(t('gameSocial.publicRequired')); return; }
    setEnvoi(true); setErreur('');
    try {
      await onSave(pseudo.trim(), publique);
      onClose();
      apres?.();
    } catch (err) {
      setErreur(err.message || t('gameSocial.saveError'));
    } finally { setEnvoi(false); }
  }

  const reponse = (valeur, titre, sous) => (
    <label className={`pseudo-choix${publique === valeur ? ' actif' : ''}`}>
      <input type="radio" name="pseudo-public" checked={publique === valeur} onChange={() => { setPublique(valeur); setErreur(''); }} />
      <span className="pseudo-choix-rond" aria-hidden="true" />
      <span><b>{titre}</b><span className="small">{sous}</span></span>
    </label>
  );

  return (
    <div className="modal-overlay pseudo-modal-overlay" role="dialog" aria-modal="true" aria-label={t('gameSocial.modalTitle')} onClick={obligatoire ? undefined : onClose}>
      <form className="modal-box pseudo-modal" onClick={(e) => e.stopPropagation()} onSubmit={valider} noValidate>
        <h3 className="modal-titre">{reposee ? t('gameSocial.modalTitleAgain') : t('gameSocial.modalTitle')}</h3>
        <p className="small">{reposee ? t('gameSocial.modalIntroAgain') : obligatoire ? t('gameSocial.modalIntroWelcome') : t('gameSocial.modalIntro')}</p>
        <div className="field">
          <label htmlFor="pseudo-jeu">{t('gameSocial.pseudoLabel')}</label>
          <input id="pseudo-jeu" value={pseudo} maxLength={20} autoFocus autoComplete="off" onChange={(e) => { setPseudo(e.target.value); setErreur(''); }} placeholder={t('gameSocial.pseudoPlaceholder')} />
        </div>
        <fieldset className="pseudo-question">
          <legend>{t('gameSocial.publicQuestion')}</legend>
          {reponse(true, t('gameSocial.publicYes'), t('gameSocial.publicYesSub'))}
          {reponse(false, t('gameSocial.publicNo'), t('gameSocial.publicNoSub'))}
        </fieldset>
        {erreur && <p className="small" role="alert" style={{ color: 'var(--red)', margin: '6px 0 0' }}>{erreur}</p>}
        <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          {/* Avant la première partie aussi, on peut fermer : on ne joue pas, et la question revient au prochain « Commencer ». */}
          <button type="button" className="btn-ghost" onClick={onClose}>{t('gameSocial.close')}</button>
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
          <button type="button" className="podium-editer" onClick={onEditer} title={t('gameSocial.editPseudo')} aria-label={t('gameSocial.editPseudo')}><Icone nom="crayon" taille={14} /></button>
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
