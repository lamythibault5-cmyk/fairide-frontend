import { useLanguage, getLocale } from '../context/LanguageContext';
import { datePremierPrelevement } from '../launch';

// La promesse Fairide aux commerces, dite avec les mêmes mots partout (inscription, Mon compte) : la réservation de
// table reste gratuite ; livraison et à emporter = 20 € HTVA par mois + 10 % HTVA des commandes payées en ligne,
// premier mois offert ; rien n'est prélevé tant que le commerce n'a pas activé lui-même la formule complète.
// L'ambiguïté « quand est-ce que je commence à payer ? » fait hésiter devant un modèle gratuit → payant : la date
// du premier prélèvement est donc donnée en clair, calculée comme côté serveur (voir launch.js).
//
// payant : livraison ou à emporter choisis. statut : statut de la formule complète (trialing, active…), finEssai :
// date de fin du mois offert ou du prochain prélèvement. onActiver : bouton d'activation (Mon compte).
export default function OffreFormules({ payant = false, statut = null, finEssai = null, onActiver = null, inscription = false }) {
  const { t } = useLanguage();
  const fmt = (d) => new Date(d).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const essai = statut === 'trialing';
  const actif = statut === 'active';
  return (
    <div className="offre-formules">
      <div className="offre-colonnes">
        <div className={`offre-col${!payant ? ' offre-col-choisie' : ''}`}>
          <b>🍽️ {t('accountUi.offre_resaTitle')}</b>
          <span className="offre-prix">{t('accountUi.offre_resaPrice')}</span>
          <span className="small">{t('accountUi.offre_resaDetail')}</span>
        </div>
        <div className={`offre-col${payant ? ' offre-col-choisie' : ''}`}>
          <b>🛵 {t('accountUi.offre_completeTitle')}</b>
          <span className="offre-prix">{t('accountUi.offre_completePrice')}</span>
          <span className="small">{t('accountUi.offre_completeDetail')}</span>
        </div>
      </div>
      <div className="offre-quand">
        <b>{t('accountUi.offre_whenTitle')}</b>
        <ol className="small">
          <li>{t('accountUi.offre_when1')}</li>
          <li>{t('accountUi.offre_when2')}</li>
          <li>{essai && finEssai ? t('accountUi.offre_when3Trial', { date: fmt(finEssai) })
            : actif && finEssai ? t('accountUi.offre_when3Active', { date: fmt(finEssai) })
              : t('accountUi.offre_when3', { date: fmt(datePremierPrelevement()) })}</li>
        </ol>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('accountUi.offre_noCommitment')}</p>
      </div>
      {inscription && payant && <p className="small offre-note">✅ {t('accountUi.offre_signupComplete')}</p>}
      {onActiver && payant && !essai && !actif && (
        <button type="button" className="btn-gold" style={{ marginTop: 10 }} onClick={onActiver}>{t('accountUi.offre_activateBtn')}</button>
      )}
    </div>
  );
}
