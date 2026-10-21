// Codes du serveur montrés en mots dans la console (audit du 19/10, admin-85 / admin-86). Fichier à part d'adminUtils.jsx
// pour que celui-ci reste un module de composants (réactualisation à chaud). Même mécanique que ses tables : un Proxy lit la
// langue courante à chaque accès.
import { getLanguage } from '../../context/LanguageContext';

function parLangue(tables) {
  const courante = () => tables[getLanguage()] || tables.fr;
  return new Proxy({}, { get: (_, k) => courante()[k], has: (_, k) => k in courante(), ownKeys: () => Reflect.ownKeys(courante()),
    getOwnPropertyDescriptor: (_, k) => (k in courante() ? { value: courante()[k], enumerable: true, configurable: true, writable: false } : undefined) });
}

export const PAYMENT_MODE_LABELS = parLangue({
  fr: { stripe: 'Carte (en ligne)', on_site: 'Payé au commerce', balance: 'Solde Fairide', simulated: 'Simulé', inconnu: 'Inconnu' },
  en: { stripe: 'Card (online)', on_site: 'Paid at the business', balance: 'Fairide balance', simulated: 'Simulated', inconnu: 'Unknown' },
  nl: { stripe: 'Kaart (online)', on_site: 'Betaald bij de zaak', balance: 'Fairide-saldo', simulated: 'Gesimuleerd', inconnu: 'Onbekend' }
});
export const REFUND_RESPONSIBILITY_LABELS = parLangue({
  fr: { restaurant: 'à la charge du commerce', driver: 'à la charge du livreur', fairide: 'à la charge de Fairide' },
  en: { restaurant: 'charged to the business', driver: 'charged to the courier', fairide: 'charged to Fairide' },
  nl: { restaurant: 'ten laste van de zaak', driver: 'ten laste van de koerier', fairide: 'ten laste van Fairide' }
});
export const SUBSCRIPTION_STATUS_LABELS = parLangue({
  fr: { none: 'aucun', trialing: 'mois offert en cours', active: 'actif', past_due: 'paiement en retard', paused: 'en pause', canceled: 'résilié', incomplete: 'incomplet', incomplete_expired: 'expiré', unpaid: 'impayé' },
  en: { none: 'none', trialing: 'free month running', active: 'active', past_due: 'payment overdue', paused: 'paused', canceled: 'cancelled', incomplete: 'incomplete', incomplete_expired: 'expired', unpaid: 'unpaid' },
  nl: { none: 'geen', trialing: 'gratis maand loopt', active: 'actief', past_due: 'betaling achterstallig', paused: 'gepauzeerd', canceled: 'opgezegd', incomplete: 'onvolledig', incomplete_expired: 'verlopen', unpaid: 'onbetaald' }
});
export const DELIVERY_MODE_LABELS = parLangue({
  fr: { fairide: 'livreurs Fairide', own: 'ses propres livreurs' },
  en: { fairide: 'Fairide couriers', own: 'its own couriers' },
  nl: { fairide: 'Fairide-koeriers', own: 'eigen koeriers' }
});
// Libellé d'un code, ou le code lui-même quand la table ne le connaît pas encore.
export const libelle = (table, code) => (code && table[code]) || code || '-';

