import { useLanguage } from '../../context/LanguageContext';

/* Abonnement offert pendant le lancement (fondateur, 7 oct. 2026) : « on démarre sans commande dans aucun commerce ;
 * tant qu'un commerce ne profite pas un peu de Fairide, on ne le fait pas payer ». Seule la majoration de 10 % sur les
 * commandes est prise. Tant que l'équipe n'active pas la facturation pour ce commerce (Admin › Commerces), la page
 * « Mon compte » montre cette carte à la place des boutons de paiement — le serveur refuse d'ailleurs l'abonnement
 * (SUBSCRIPTION_WAIVED, routes/restaurants.js). Composant à part : Account.jsx ne doit plus grossir (CLAUDE.md). */
export default function AbonnementOffert() {
  const { t } = useLanguage();
  return (
    <div className="card" style={{ margin: '0 0 12px', borderLeft: '3px solid var(--iris)' }}>
      <b>{t('accountUi.subWaivedTitle')}</b>
      <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.subWaivedText')}</p>
    </div>
  );
}
