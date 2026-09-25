import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { abonnementOuvert, dateOuvertureAbonnement } from '../launch';

// Remise de carte et mise en ligne.
//
// Quand l'équipe Fairide prépare la carte à la place du restaurateur, elle lui est d'abord remise :
// elle n'est visible que dans son tableau de bord tant qu'il ne l'a pas relue et confirmée. Ce
// bandeau porte cette confirmation, puis la liste des étapes qui restent avant que son commerce
// s'affiche aux clients — moyens de paiement et contrat de partenariat.
// Côté serveur : restaurants.onboarding (menuHandover.js), POST /restaurants/:id/menu/confirm.

function Etape({ fait, children }) {
  return (
    <li style={{ margin: '6px 0', listStyle: 'none', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span aria-hidden="true">{fait ? '✅' : '⬜'}</span>
      <span style={{ flex: 1, opacity: fait ? 0.7 : 1 }}>{children}</span>
    </li>
  );
}

export default function MenuReadiness({ restaurant, restoId, token, onConfirmed, modeAdmin = false }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [confirmation, setConfirmation] = useState(false);
  const o = restaurant?.onboarding;
  if (!o) return null; // backend pas encore déployé : on n'affiche rien plutôt qu'une check-list fausse

  const aConfirmer = o.menuPending;
  // paymentsRequired / menuReady absents (serveur plus ancien) : on garde l'ancienne exigence.
  const paiementsOk = o.paymentsRequired === false || o.paymentsReady;
  const carteOk = o.menuReady !== false;
  const toutPret = !o.menuPending && carteOk && o.contractAccepted && paiementsOk;

  async function confirmer() {
    setConfirmation(true);
    try {
      await api(`/restaurants/${restoId}/menu/confirm`, { method: 'POST', token, body: {} });
      await onConfirmed?.();
      toast(t('menuPage.handoverConfirmed'));
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setConfirmation(false);
    }
  }

  return (
    <>
      {aConfirmer && (
        <div className="card" id="menu-a-confirmer" style={{ border: '2px solid var(--gold, #C9A227)' }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{t('menuPage.handoverTitle')}</h3>
          <p className="small" style={{ margin: '0 0 8px' }}>{t('menuPage.handoverIntro')}</p>
          <p className="small" style={{ margin: '0 0 12px', background: 'var(--cream-dim)', padding: '10px 12px', borderRadius: 8 }}>
            {t('menuPage.handoverNotVisible')}
          </p>
          {!modeAdmin && (
            <button type="button" className="btn-teal" disabled={confirmation} onClick={confirmer}>
              {confirmation ? '…' : t('menuPage.handoverConfirmButton')}
            </button>
          )}
          {modeAdmin && <p className="small" style={{ margin: 0, opacity: 0.8 }}>{t('menuPage.handoverAdminNote')}</p>}
        </div>
      )}

      {!modeAdmin && !toutPret && (
        <div className="card" id="menu-mise-en-ligne">
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('menuPage.readyTitle')}</h3>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('menuPage.readyIntro')}</p>
          <ul style={{ padding: 0, margin: 0 }}>
            {/* L'étape « carte » ne concerne que les commerces dont l'équipe Fairide a préparé la carte :
                ailleurs, il n'y a rien à confirmer et l'afficher cochée serait mensonger. */}
            {o.menuReviewRequestedAt && (
              <Etape fait={!o.menuPending}>
                {o.menuPending ? t('menuPage.readyStepMenuTodo') : t('menuPage.readyStepMenuDone')}
              </Etape>
            )}
            {!o.menuReviewRequestedAt && o.itemCount !== null && o.itemCount !== undefined && (
              <Etape fait={o.menuReady}>{t('menuPage.readyStepMenuCreate')}</Etape>
            )}
            {o.paymentsRequired !== false && (
              <Etape fait={o.paymentsReady}>
                {t('menuPage.readyStepPayments')} {!o.paymentsReady && <Link to="/account?ouvrir=paiement">{t('menuPage.readyGoPayments')}</Link>}
              </Etape>
            )}
            {/* Avant le 6 octobre, l'abonnement ne s'active NULLE PART : ni ici, ni dans Mon compte
                (le bouton n'y est rendu qu'une fois la date passée), ni côté serveur, qui le refuse.
                Annoncer « Activer la formule complète » avec un lien envoyait donc le restaurateur
                vers un écran où il n'y avait rien à faire. Tant que la date n'est pas là, l'étape dit
                à partir de quand elle s'ouvre et ne prétend plus être une action à faire tout de suite. */}
            {o.plan === 'complete' && (
              <Etape fait={o.subscriptionActive}>
                {o.subscriptionActive || abonnementOuvert()
                  ? t('menuPage.readyStepSubscription')
                  : t('menuPage.readyStepSubscriptionSoon', { date: dateOuvertureAbonnement(locale) })}
                {' '}
                {!o.subscriptionActive && <Link to="/account?ouvrir=abonnement">{t(abonnementOuvert() ? 'menuPage.readyGoSubscription' : 'menuPage.readySeeSubscription')}</Link>}
              </Etape>
            )}
            <Etape fait={o.contractAccepted}>
              {t('menuPage.readyStepContract')} {!o.contractAccepted && <Link to="/account?ouvrir=contrat">{t('menuPage.readyGoContract')}</Link>}
            </Etape>
          </ul>
          {!o.publicListed && <p className="small" style={{ margin: '10px 0 0', opacity: 0.8 }}>{t('menuPage.readyAdminStep')}</p>}
        </div>
      )}

      {!modeAdmin && toutPret && o.menuConfirmedAt && (
        <div className="card" id="menu-mise-en-ligne">
          <p className="small" style={{ margin: 0 }}>{t('menuPage.readyAllDone')}</p>
        </div>
      )}
    </>
  );
}
