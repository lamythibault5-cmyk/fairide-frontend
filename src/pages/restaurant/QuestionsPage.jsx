import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import CadreSite from '../../components/commerce/CadreSite';
import QuestionsCarte, { reponseAffichee } from '../../components/commerce/QuestionsCarte';
import Icone from '../../components/Icone';

/* « N QUESTIONS SUR TA CARTE » DANS LE TABLEAU DE BORD (/dashboard/questions, fondateur 2026-10-20).
 *
 * Les questions que Fairide pose aussi par le lien de l'e-mail (ValiderCarte.jsx), pour le commerçant qui passe par son
 * tableau de bord, sur le site comme dans l'application. Même composant (QuestionsCarte), mêmes règles côté serveur
 * (questionsCarte.js). On y arrive par l'étape « Avant d'être en ligne » ; une fois répondu, la liste dit que Fairide met
 * la carte à jour, puis propose la validation. */
export default function QuestionsPage() {
  const { restoId, loadDashboard, lectureSeule } = useOutletContext();
  const { token } = useAuth();
  const { t } = useLanguage();
  const [etat, setEtat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [rappel, setRappel] = useState(null);

  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/menu-questions`, { token }).then(setEtat).catch((e) => setErreur(e.message));
  }, [restoId, token]);

  async function repondre(answers) {
    setEnvoi(true);
    try {
      const qs = etat.open;
      const r = await api(`/restaurants/${restoId}/menu-questions/answers`, { method: 'POST', token, body: { answers } });
      setRappel(qs.map((q) => ({ id: q.id, reponse: reponseAffichee(q, answers.find((a) => a.id === q.id), t) })));
      setEtat(r.questions);
      loadDashboard?.(restoId);
    } catch (e) { setErreur(e.message); } finally { setEnvoi(false); }
  }

  const ouvertes = etat?.open || [];
  // « Merci ! » et « Voir la prochaine étape » juste après avoir répondu ; sans rien à répondre, on le dit et on ramène au commerce
  // (fondateur, 2026-10-27, S4 de maquettes/audit-ecrans : un commerce en ligne ouvrait « Merci ! » sur une page vide).
  const vientDeRepondre = !!rappel;
  const titre = ouvertes.length ? t('questionsCarte.title', { n: ouvertes.length }) : vientDeRepondre ? t('questionsCarte.thanksTitle') : t('questionsCarte.rienTitre');
  return (
    // Le bandeau iris dans l'app aussi (fondateur, 2026-10-25, maquettes/une-action/panier-et-site, réponse 9).
    <CadreSite titre={titre} sous={ouvertes.length ? t('questionsCarte.intro', { n: ouvertes.length }) : null} lecture appli>
      {erreur && <p className="gn-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}</p>}
      {!etat && !erreur && <p className="small" role="status">{t('validerCarte.loading')}</p>}
      {etat && ouvertes.length > 0 && (
        <>
          {lectureSeule
            ? <p className="gn-note" role="note"><Icone nom="bulle" taille={18} />{t('questionsCarte.readOnly')}</p>
            : <QuestionsCarte questions={ouvertes} onEnvoyer={repondre} envoi={envoi} />}
        </>
      )}
      {etat && !ouvertes.length && (
        <div className="card">
          <h3 className="qc-merci-titre">{etat.waiting ? t('questionsCarte.updatingTitle') : t('questionsCarte.noneTitle')}</h3>
          <p className="small" style={{ margin: 0 }}>{etat.waiting ? t('questionsCarte.updatingText') : t('questionsCarte.noneText')}</p>
          {/* La sortie, en lime et AVANT le rappel des réponses (fondateur, 2026-10-27, comme « Merci pour ta commande ! ») : un petit
              bouton à contour après la liste, qui passait sous le bord de l'écran avec plusieurs réponses. */}
          <Link to="/dashboard" className="btn-gold gn-action" style={{ marginTop: 14 }}>{vientDeRepondre || etat.waiting ? t('validerCarte.backToDashboard') : t('questionsCarte.retourCommerce')}</Link>
          {rappel && (
            <div className="qc-recap"><b>{t('questionsCarte.yourAnswers')}</b>
              <ol>{rappel.map((r) => <li key={r.id}>{r.reponse}</li>)}</ol>
            </div>
          )}
        </div>
      )}
    </CadreSite>
  );
}
