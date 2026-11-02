import { api } from '../../api';
import { useActionOptimiste } from '../../actionOptimiste';
import { vibrer } from '../../gestes';
import { useLanguage } from '../../context/LanguageContext';

// « RENFORT FAIRRIDE » (fondateur, 2026-11-02 ; maquettes/livraison-commerce, étape 8, question 4 réponse A). Un commerce qui
// livre avec son équipe ne reçoit aucun livreur Fairride. Coup de rush ou livreur absent : un geste, et les NOUVELLES commandes
// partent aux livreurs Fairride, au tarif Fairride, tant qu'il le laisse allumé. Une commande déjà payée garde son vendeur :
// elle reste à son équipe. Seulement pour un commerce dont le mode est actif (restaurantDelivery.actif).
// Bascule au toucher, comme l'interrupteur de service (actionOptimiste.js) : la fiche reçoit l'état visé tout de suite, un refus
// le remet.
export default function RenfortFairride({ restaurant, restoId, token, loadDashboard, modifierRestaurant }) {
  const { t } = useLanguage();
  const agirOptimiste = useActionOptimiste();
  if (!restaurant?.restaurantDelivery?.actif) return null;
  const allume = !!restaurant.restaurantDelivery.renfort;

  function basculer() {
    vibrer('bascule');
    const vise = !allume;
    const avec = (r, v) => (r ? { ...r, deliveredByRestaurant: !v, restaurantDelivery: { ...r.restaurantDelivery, renfort: v } } : r);
    agirOptimiste('renfort', {
      appliquer: () => { modifierRestaurant?.((r) => avec(r, vise)); return allume; },
      envoyer: () => api(`/restaurants/${restoId}/renfort`, { method: 'PATCH', token, body: { actif: vise } }),
      annuler: (avant) => modifierRestaurant?.((r) => avec(r, avant)),
      rafraichir: () => loadDashboard(restoId, { silencieux: true })
    });
  }

  return (
    <button type="button" className="renfort" aria-pressed={allume} onClick={basculer}>
      <span className="renfort-texte">
        <b>{t('livraisonEquipe.renfort')}</b>
        <span>{allume ? t('livraisonEquipe.renfortOn') : t('livraisonEquipe.renfortOff')}</span>
      </span>
      <span className={`ec-interrupteur ec-interrupteur--lime${allume ? ' on' : ''}`} aria-hidden="true" />
    </button>
  );
}
