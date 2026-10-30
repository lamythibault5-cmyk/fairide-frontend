import { useEffect, useId, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

/* LES QUESTIONS DE FAIRIDE SUR LA CARTE, À UNE TOUCHE (fondateur, 2026-10-20 ; maquettes/questions-commerce.html).
 *
 * Les mêmes questions à deux endroits : la page du lien « C'est bon » reçu par e-mail (ValiderCarte.jsx, sans compte) et
 * « Avant d'être en ligne » du tableau de bord (QuestionsPage.jsx), site comme application. Une question se répond d'une
 * touche : une pastille parmi celles que l'équipe propose, « Oui », ou « Autre… » / « Non… » qui ouvre un petit champ.
 * Seules les questions « texte » demandent d'écrire. Le bouton s'active quand toutes les questions ont une réponse : une
 * réponse partielle laisserait l'équipe sans pouvoir finir la carte.
 *
 * `onEnvoyer(reponses)` reçoit [{ id, value, other }] ; les règles sont vérifiées une seconde fois côté serveur
 * (questionsCarte.verifierReponse).
 *
 * LES RÉPONSES RESTENT (fondateur, 2026-10-30, coupure 7 de maquettes/progression) : elles partent toutes ensemble, et un
 * commerçant qui sortait à la question 4 sur 6 (un client au comptoir, la page fermée) recommençait à la 1. Elles sont gardées
 * dans le téléphone, par question, 7 jours (la durée du lien « C'est bon ») ; une question envoyée ne revient plus dans la
 * liste, sa réponse gardée est oubliée à la prochaine ouverture. Déclaré dans la politique des cookies. */
const AUTRE = '__autre';
const CLE_REPONSES = 'fairide_reponses_carte';
const REPONSES_MAX_MS = 7 * 24 * 3600 * 1000;
function reponsesGardees(questions) {
  try {
    const g = JSON.parse(localStorage.getItem(CLE_REPONSES) || 'null');
    if (!g || Date.now() - (g.at || 0) > REPONSES_MAX_MS) return {};
    return Object.fromEntries(questions.filter((q) => g.reponses?.[q.id]).map((q) => [q.id, g.reponses[q.id]]));
  } catch { return {}; }
}
function garderReponses(reponses) {
  try {
    if (Object.keys(reponses).length) localStorage.setItem(CLE_REPONSES, JSON.stringify({ at: Date.now(), reponses }));
    else localStorage.removeItem(CLE_REPONSES);
  } catch { /* stockage indisponible */ }
}

function complete(q, r) {
  if (!r) return false;
  if (q.kind === 'text') return !!r.other?.trim();
  if (r.value === AUTRE) return !!r.other?.trim();
  return !!r.value;
}

// La réponse telle qu'on la rappelle au commerce après l'envoi (« 2 », « Autre : + Bicky poulet », « Non : 25 cl »).
export function reponseAffichee(q, r, t) {
  if (!r) return '';
  if (q.kind === 'yes_no') return r.value === 'oui' ? t('questionsCarte.yes') : `${t('questionsCarte.no').replace(/…$/, '')}${r.other ? ` : ${r.other}` : ''}`;
  if (r.value) return r.value;
  return q.kind === 'choice' ? `${t('questionsCarte.other').replace(/…$/, '')} : ${r.other}` : r.other;
}

export default function QuestionsCarte({ questions, onEnvoyer, envoi = false }) {
  const { t } = useLanguage();
  const id = useId();
  const [reponses, setReponses] = useState(() => reponsesGardees(questions));
  const poser = (qid, r) => setReponses((x) => ({ ...x, [qid]: { ...x[qid], ...r } }));
  useEffect(() => { garderReponses(reponses); }, [reponses]);
  const faites = questions.filter((q) => complete(q, reponses[q.id])).length;
  const toutes = faites === questions.length;

  function envoyer() {
    onEnvoyer(questions.map((q) => {
      const r = reponses[q.id] || {};
      if (q.kind === 'text') return { id: q.id, value: null, other: r.other.trim() };
      if (r.value === AUTRE) return { id: q.id, value: null, other: r.other.trim() };
      return { id: q.id, value: r.value, other: r.value === 'non' ? (r.other || '').trim() || null : null };
    }));
  }

  return (
    <div className="qc">
      {questions.map((q, i) => {
        const r = reponses[q.id] || {};
        const champ = q.kind === 'text' || r.value === AUTRE || (q.kind === 'yes_no' && r.value === 'non');
        const pastilles = q.kind === 'choice'
          ? [...q.options.map((o) => [o, o]), [AUTRE, t('questionsCarte.other')]]
          : q.kind === 'yes_no' ? [['oui', t('questionsCarte.yes')], ['non', t('questionsCarte.no')]] : [];
        return (
          <fieldset key={q.id} className="qc-question">
            <legend>
              <span className="qc-num">{t('questionsCarte.number', { n: i + 1, total: questions.length })}</span>
              <span className="qc-titre">{q.question}</span>
            </legend>
            {q.context && <p className="qc-contexte">{q.context}</p>}
            {pastilles.length > 0 && (
              <div className="qc-choix">
                {pastilles.map(([v, libelle]) => (
                  <button key={v} type="button" aria-pressed={r.value === v}
                    className={`qc-pastille${r.value === v ? ' on' : ''}${v === AUTRE || v === 'non' ? ' qc-pastille--ouvre' : ''}`}
                    onClick={() => poser(q.id, { value: v })}>{libelle}</button>
                ))}
              </div>
            )}
            {champ && (
              <input className="qc-champ" id={`${id}-${q.id}`} aria-label={q.question} value={r.other || ''} maxLength={300}
                placeholder={q.kind === 'yes_no' ? t('questionsCarte.noPlaceholder') : t('questionsCarte.otherPlaceholder')}
                autoFocus={q.kind !== 'text'} onChange={(e) => poser(q.id, { other: e.target.value })} />
            )}
          </fieldset>
        );
      })}
      <div className="qc-pied">
        <p className="qc-compte" aria-live="polite">{t('questionsCarte.count', { n: faites, total: questions.length })}</p>
        <button type="button" className="btn-gold gn-action" disabled={!toutes || envoi} onClick={envoyer}>
          {envoi ? '…' : t('questionsCarte.send')}
        </button>
        <a className="qc-appel" href="mailto:contact@fairride.be">{t('questionsCarte.callMe')}</a>
      </div>
    </div>
  );
}
