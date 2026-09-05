import { useEffect, useState } from 'react';
import { API_BASE } from '../../api';
import { getLanguage, getLocale } from '../../context/LanguageContext';

// Un compte de test se reconnaît au même motif que le contournement de vérification à l'inscription
// (voir routes/auth.js, isQaTestAccount) : un alias "+qa" dans l'adresse email (ex: toi+qa1@gmail.com).
// Aucun champ base de données dédié — dérivé à la volée de l'email déjà présent dans chaque liste admin.
export function isTestAccount(email) {
  return /\+qa/i.test(email || '');
}

export function TestBadge() {
  return <span className="pill test-account-pill" title={{ fr: "Compte de test (+qa dans l'email)", en: 'Test account (+qa in the email)', nl: 'Testaccount (+qa in het e-mailadres)' }[getLanguage()]}>🧪 Test</span>;
}

// Filtre instantané côté client (aucun aller-retour serveur), une fois la liste complète déjà chargée.
// `list` peut être null (pas encore chargé) : renvoyé tel quel pour ne pas casser les affichages
// "Chargement...".
export function filterBySearch(list, search, getFields) {
  if (!list) return list;
  const q = search.trim().toLowerCase();
  if (!q) return list;
  return list.filter((item) => getFields(item).some((v) => v && String(v).toLowerCase().includes(q)));
}

export function money(n) {
  return `${Number(n || 0).toFixed(2)}€`;
}

export function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------------------------
// Libellés de l'ERP admin dans les trois langues. Les tables exportées gardent leur forme d'objet
// (LABELS[cle], Object.entries(LABELS)…) : ce sont des Proxy qui lisent la table de la langue
// courante à chaque accès, donc un changement de langue se voit au rendu suivant sans toucher aux
// pages qui les consomment.
// ---------------------------------------------------------------------------------------------
function parLangue(tables) {
  const courante = () => tables[getLanguage()] || tables.fr;
  return new Proxy({}, {
    get: (_, k) => (k === Symbol.iterator ? undefined : courante()[k]),
    has: (_, k) => k in courante(),
    ownKeys: () => Reflect.ownKeys(courante()),
    getOwnPropertyDescriptor: (_, k) => (k in courante() ? { value: courante()[k], enumerable: true, configurable: true, writable: false } : undefined)
  });
}
// Couples { label, color } : la couleur est commune, seul le libellé change.
function avecCouleurs(couleurs, libelles) {
  const out = {};
  for (const lang of Object.keys(libelles)) {
    out[lang] = {};
    for (const k of Object.keys(couleurs)) out[lang][k] = { label: libelles[lang][k], color: couleurs[k] };
  }
  return parLangue(out);
}

export const ORDER_STATUS_LABELS = parLangue({
  fr: { nouveau: 'Nouvelle', preparation: 'En préparation', pret: 'Prête', livraison: 'En livraison', livre: 'Livrée', refuse: 'Refusée', annule: 'Annulée' },
  en: { nouveau: 'New', preparation: 'Being prepared', pret: 'Ready', livraison: 'Out for delivery', livre: 'Delivered', refuse: 'Refused', annule: 'Cancelled' },
  nl: { nouveau: 'Nieuw', preparation: 'In bereiding', pret: 'Klaar', livraison: 'In levering', livre: 'Geleverd', refuse: 'Geweigerd', annule: 'Geannuleerd' }
});

export const ORDER_STATUSES = ['nouveau', 'preparation', 'pret', 'livraison', 'livre', 'refuse', 'annule'];

export const BUSINESS_STATUS_LABELS = avecCouleurs(
  { prospect: 'inherit', onboarding: 'var(--gold-deep)', actif: 'var(--teal-deep)', suspendu: 'var(--red)' },
  { fr: { prospect: '🔎 Prospect', onboarding: '🕐 Onboarding', actif: '✅ Actif', suspendu: '🚫 Suspendu' },
    en: { prospect: '🔎 Prospect', onboarding: '🕐 Onboarding', actif: '✅ Active', suspendu: '🚫 Suspended' },
    nl: { prospect: '🔎 Prospect', onboarding: '🕐 Onboarding', actif: '✅ Actief', suspendu: '🚫 Geschorst' } }
);

export const ACCOUNTING_ENTRY_TYPE_LABELS = parLangue({
  fr: { order_commission: 'Commission restaurant (HT)', order_commission_vat: 'TVA sur commission', order_delivery_share: 'Part Fairide livraison (HT)', order_delivery_share_vat: 'TVA sur part livraison', order_restaurant_due: 'Dû restaurant', order_driver_due: 'Dû livreur', order_payment: 'Paiement client', refund: 'Remboursement', payout_restaurant: 'Virement restaurant', payout_driver: 'Virement livreur', stripe_fee: 'Frais Stripe' },
  en: { order_commission: 'Restaurant commission (excl. VAT)', order_commission_vat: 'VAT on commission', order_delivery_share: 'Fairide delivery share (excl. VAT)', order_delivery_share_vat: 'VAT on delivery share', order_restaurant_due: 'Due to restaurant', order_driver_due: 'Due to courier', order_payment: 'Customer payment', refund: 'Refund', payout_restaurant: 'Restaurant transfer', payout_driver: 'Courier transfer', stripe_fee: 'Stripe fee' },
  nl: { order_commission: 'Restaurantcommissie (excl. btw)', order_commission_vat: 'Btw op commissie', order_delivery_share: 'Fairide-aandeel levering (excl. btw)', order_delivery_share_vat: 'Btw op aandeel levering', order_restaurant_due: 'Verschuldigd restaurant', order_driver_due: 'Verschuldigd koerier', order_payment: 'Klantbetaling', refund: 'Terugbetaling', payout_restaurant: 'Overschrijving restaurant', payout_driver: 'Overschrijving koerier', stripe_fee: 'Stripe-kosten' }
});

export const INVOICE_STATUS_LABELS = avecCouleurs(
  { brouillon: 'inherit', emise: 'var(--gold-deep)', envoyee: 'var(--teal-deep)', payee: 'var(--teal-deep)', en_retard: 'var(--red)', annulee: 'var(--red)' },
  { fr: { brouillon: 'Brouillon', emise: 'Émise', envoyee: 'Envoyée', payee: 'Payée', en_retard: 'En retard', annulee: 'Annulée' },
    en: { brouillon: 'Draft', emise: 'Issued', envoyee: 'Sent', payee: 'Paid', en_retard: 'Overdue', annulee: 'Cancelled' },
    nl: { brouillon: 'Ontwerp', emise: 'Uitgegeven', envoyee: 'Verzonden', payee: 'Betaald', en_retard: 'Achterstallig', annulee: 'Geannuleerd' } }
);

export const CRM_STAGES = ['prospect', 'contacte', 'interesse', 'demo', 'onboarding', 'actif', 'perdu'];

export const CRM_STAGE_LABELS = parLangue({
  fr: { prospect: 'Prospect', contacte: 'Contacté', interesse: 'Intéressé', demo: 'Démo', onboarding: 'Onboarding', actif: 'Actif', perdu: 'Perdu' },
  en: { prospect: 'Prospect', contacte: 'Contacted', interesse: 'Interested', demo: 'Demo', onboarding: 'Onboarding', actif: 'Active', perdu: 'Lost' },
  nl: { prospect: 'Prospect', contacte: 'Gecontacteerd', interesse: 'Geïnteresseerd', demo: 'Demo', onboarding: 'Onboarding', actif: 'Actief', perdu: 'Verloren' }
});

const PRIORITE_COULEURS = { low: 'inherit', medium: 'var(--gold-deep)', high: 'var(--red)' };
const PRIORITE_LIBELLES = {
  fr: { low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' },
  en: { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' },
  nl: { low: 'Laag', medium: 'Gemiddeld', high: 'Hoog', urgent: 'Dringend' }
};
export const CRM_PRIORITY_LABELS = avecCouleurs(PRIORITE_COULEURS, PRIORITE_LIBELLES);

export const CRM_NOTE_CHANNEL_LABELS = parLangue({
  fr: { call: '📞 Appel', email: '✉️ Email', meeting: '🤝 Rendez-vous' },
  en: { call: '📞 Call', email: '✉️ Email', meeting: '🤝 Meeting' },
  nl: { call: '📞 Oproep', email: '✉️ E-mail', meeting: '🤝 Afspraak' }
});

export const TICKET_CATEGORIES = ['commande', 'paiement', 'compte', 'technique', 'partenariat', 'autre'];
export const TICKET_CATEGORY_LABELS = parLangue({
  fr: { commande: 'Commande', paiement: 'Paiement', compte: 'Compte', technique: 'Technique', partenariat: 'Partenariat', autre: 'Autre' },
  en: { commande: 'Order', paiement: 'Payment', compte: 'Account', technique: 'Technical', partenariat: 'Partnership', autre: 'Other' },
  nl: { commande: 'Bestelling', paiement: 'Betaling', compte: 'Account', technique: 'Technisch', partenariat: 'Partnerschap', autre: 'Andere' }
});
export const TICKET_PRIORITY_LABELS = avecCouleurs({ ...PRIORITE_COULEURS, urgent: 'var(--red)' }, PRIORITE_LIBELLES);
export const TICKET_STATUS_LABELS = avecCouleurs(
  { ouvert: 'var(--gold-deep)', en_cours: 'var(--teal-deep)', en_attente: 'inherit', resolu: 'var(--teal-deep)', ferme: 'inherit' },
  { fr: { ouvert: 'Ouvert', en_cours: 'En cours', en_attente: 'En attente', resolu: 'Résolu', ferme: 'Fermé' },
    en: { ouvert: 'Open', en_cours: 'In progress', en_attente: 'Pending', resolu: 'Resolved', ferme: 'Closed' },
    nl: { ouvert: 'Open', en_cours: 'In behandeling', en_attente: 'In wacht', resolu: 'Opgelost', ferme: 'Gesloten' } }
);
export const TICKET_STATUSES = ['ouvert', 'en_cours', 'en_attente', 'resolu', 'ferme'];

export const DOCUMENT_TYPES = ['contrat', 'attestation', 'piece_identite', 'assurance', 'facture', 'justificatif', 'conditions_commerciales', 'autre'];
export const DOCUMENT_TYPE_LABELS = parLangue({
  fr: { contrat: 'Contrat', attestation: 'Attestation', piece_identite: "Pièce d'identité", assurance: 'Assurance', facture: 'Facture', justificatif: 'Justificatif', conditions_commerciales: 'Conditions commerciales', autre: 'Autre' },
  en: { contrat: 'Contract', attestation: 'Certificate', piece_identite: 'ID document', assurance: 'Insurance', facture: 'Invoice', justificatif: 'Supporting document', conditions_commerciales: 'Commercial terms', autre: 'Other' },
  nl: { contrat: 'Contract', attestation: 'Attest', piece_identite: 'Identiteitsbewijs', assurance: 'Verzekering', facture: 'Factuur', justificatif: 'Bewijsstuk', conditions_commerciales: 'Handelsvoorwaarden', autre: 'Andere' }
});
export const DOCUMENT_VERIFICATION_LABELS = avecCouleurs(
  { en_attente: 'var(--gold-deep)', valide: 'var(--teal-deep)', rejete: 'var(--red)' },
  { fr: { en_attente: '🕐 En attente', valide: '✅ Validé', rejete: '🚫 Rejeté' },
    en: { en_attente: '🕐 Pending', valide: '✅ Validated', rejete: '🚫 Rejected' },
    nl: { en_attente: '🕐 In wacht', valide: '✅ Gevalideerd', rejete: '🚫 Afgewezen' } }
);
export const DOCUMENT_EXPIRY_LABELS = avecCouleurs(
  { expired: 'var(--red)', expiring_soon: 'var(--gold-deep)', valid: 'inherit' },
  { fr: { expired: '⚠️ Expiré', expiring_soon: '🕐 Expire bientôt', valid: '✅ Valide' },
    en: { expired: '⚠️ Expired', expiring_soon: '🕐 Expiring soon', valid: '✅ Valid' },
    nl: { expired: '⚠️ Verlopen', expiring_soon: '🕐 Verloopt binnenkort', valid: '✅ Geldig' } }
);
const CIBLES = {
  fr: { restaurant: 'Restaurant', driver: 'Livreur', client: 'Client', order: 'Commande', crm_prospect: 'Prospect CRM', ticket: 'Ticket', document: 'Document', invoice: 'Facture' },
  en: { restaurant: 'Restaurant', driver: 'Courier', client: 'Customer', order: 'Order', crm_prospect: 'CRM prospect', ticket: 'Ticket', document: 'Document', invoice: 'Invoice' },
  nl: { restaurant: 'Restaurant', driver: 'Koerier', client: 'Klant', order: 'Bestelling', crm_prospect: 'CRM-prospect', ticket: 'Ticket', document: 'Document', invoice: 'Factuur' }
};
export const DOCUMENT_TARGET_TYPE_LABELS = parLangue(CIBLES);

export const TASK_PRIORITY_LABELS = avecCouleurs(PRIORITE_COULEURS, PRIORITE_LIBELLES);
export const TASK_STATUSES = ['a_faire', 'en_cours', 'fait', 'annulee'];
export const TASK_STATUS_LABELS = avecCouleurs(
  { a_faire: 'var(--gold-deep)', en_cours: 'var(--teal-deep)', fait: 'var(--teal-deep)', annulee: 'inherit' },
  { fr: { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait', annulee: 'Annulée' },
    en: { a_faire: 'To do', en_cours: 'In progress', fait: 'Done', annulee: 'Cancelled' },
    nl: { a_faire: 'Te doen', en_cours: 'In behandeling', fait: 'Gedaan', annulee: 'Geannuleerd' } }
);
export const TASK_DUE_STATE_LABELS = avecCouleurs(
  { overdue: 'var(--red)', due_soon: 'var(--gold-deep)' },
  { fr: { overdue: '⚠️ En retard', due_soon: '🕐 Bientôt' }, en: { overdue: '⚠️ Overdue', due_soon: '🕐 Soon' }, nl: { overdue: '⚠️ Te laat', due_soon: '🕐 Binnenkort' } }
);
export const TASK_TARGET_TYPE_LABELS = parLangue(CIBLES);

const REGLES = {
  fr: {
    crm_prospect_inactive: { label: 'Prospects CRM inactifs', description: "Crée une tâche de relance si un prospect CRM (non converti, non perdu) est sans activité depuis N jours.", params: [{ key: 'days', label: 'Jours sans activité', type: 'number' }] },
    invoice_marked_overdue: { label: 'Factures en retard', description: 'Crée une tâche de relance pour chaque facture de commission actuellement marquée "en retard" par un admin.', params: [] },
    document_expiring: { label: "Documents proches d'expiration", description: "Crée une tâche de vérification pour chaque document expirant bientôt (seuil réglé dans Paramètres → Tarification).", params: [] },
    order_no_driver: { label: 'Commandes sans livreur', description: "Alerte les opérations si une commande en préparation/prête n'a toujours pas de livreur après N minutes.", params: [{ key: 'minutes', label: 'Minutes sans livreur', type: 'number' }] },
    restaurant_cancellation_rate: { label: "Taux d'annulation restaurant", description: "Alerte si le taux d'annulation d'un restaurant dépasse un seuil sur une fenêtre glissante.", params: [{ key: 'thresholdRate', label: 'Seuil (0 à 1)', type: 'number', step: '0.01' }, { key: 'minOrders', label: 'Commandes minimum', type: 'number' }, { key: 'windowDays', label: 'Fenêtre (jours)', type: 'number' }] },
    large_refund_review: { label: 'Remboursements élevés', description: "Crée une tâche de vérification (PAS un blocage) pour tout remboursement dépassant un montant. Une vraie validation à deux mains est prévue en phase Approbations.", params: [{ key: 'minAmount', label: 'Montant minimum (€)', type: 'number' }] }
  },
  en: {
    crm_prospect_inactive: { label: 'Inactive CRM prospects', description: 'Creates a follow-up task if a CRM prospect (not converted, not lost) has had no activity for N days.', params: [{ key: 'days', label: 'Days without activity', type: 'number' }] },
    invoice_marked_overdue: { label: 'Overdue invoices', description: 'Creates a follow-up task for each commission invoice currently marked "overdue" by an admin.', params: [] },
    document_expiring: { label: 'Documents about to expire', description: 'Creates a verification task for each document expiring soon (threshold set in Settings → Pricing).', params: [] },
    order_no_driver: { label: 'Orders without courier', description: 'Alerts operations if an order being prepared/ready still has no courier after N minutes.', params: [{ key: 'minutes', label: 'Minutes without courier', type: 'number' }] },
    restaurant_cancellation_rate: { label: 'Restaurant cancellation rate', description: "Alerts if a restaurant's cancellation rate exceeds a threshold over a rolling window.", params: [{ key: 'thresholdRate', label: 'Threshold (0 to 1)', type: 'number', step: '0.01' }, { key: 'minOrders', label: 'Minimum orders', type: 'number' }, { key: 'windowDays', label: 'Window (days)', type: 'number' }] },
    large_refund_review: { label: 'Large refunds', description: 'Creates a verification task (NOT a block) for any refund above an amount. A real two-person approval is planned in the Approvals phase.', params: [{ key: 'minAmount', label: 'Minimum amount (€)', type: 'number' }] }
  },
  nl: {
    crm_prospect_inactive: { label: 'Inactieve CRM-prospects', description: 'Maakt een opvolgtaak aan als een CRM-prospect (niet omgezet, niet verloren) al N dagen geen activiteit heeft.', params: [{ key: 'days', label: 'Dagen zonder activiteit', type: 'number' }] },
    invoice_marked_overdue: { label: 'Achterstallige facturen', description: 'Maakt een opvolgtaak aan voor elke commissiefactuur die momenteel door een admin als "achterstallig" is gemarkeerd.', params: [] },
    document_expiring: { label: 'Documenten die bijna verlopen', description: 'Maakt een controletaak aan voor elk document dat binnenkort verloopt (drempel ingesteld in Instellingen → Tarieven).', params: [] },
    order_no_driver: { label: 'Bestellingen zonder koerier', description: 'Waarschuwt operations als een bestelling in bereiding/klaar na N minuten nog geen koerier heeft.', params: [{ key: 'minutes', label: 'Minuten zonder koerier', type: 'number' }] },
    restaurant_cancellation_rate: { label: 'Annuleringsgraad restaurant', description: 'Waarschuwt als de annuleringsgraad van een restaurant een drempel overschrijdt over een glijdend venster.', params: [{ key: 'thresholdRate', label: 'Drempel (0 tot 1)', type: 'number', step: '0.01' }, { key: 'minOrders', label: 'Minimum bestellingen', type: 'number' }, { key: 'windowDays', label: 'Venster (dagen)', type: 'number' }] },
    large_refund_review: { label: 'Hoge terugbetalingen', description: 'Maakt een controletaak aan (GEEN blokkering) voor elke terugbetaling boven een bedrag. Een echte goedkeuring met twee personen is voorzien in de fase Goedkeuringen.', params: [{ key: 'minAmount', label: 'Minimumbedrag (€)', type: 'number' }] }
  }
};
export const AUTOMATION_RULES_META = parLangue(REGLES);

export function pct(n, digits = 0) {
  if (n === null || n === undefined) return '—';
  return `${(Number(n) * 100).toFixed(digits)}%`;
}

// Une valeur brute peut être soit un nombre nu, soit { value, changePct } (voir GET /admin/dashboard) —
// évite de dupliquer ce petit if partout où le dashboard consomme ses KPI.
export function kpiValue(kpi) {
  return typeof kpi === 'object' && kpi !== null ? kpi.value : kpi;
}

// CSV minimal, sans dépendance : échappe guillemets/virgules/retours à la ligne (RFC 4180), BOM UTF-8
// pour qu'Excel détecte l'encodage correctement à l'ouverture.
export function toCsv(rows, columns) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escape(c.get(row))).join(','));
  return '﻿' + [header, ...lines].join('\n');
}

// Retarde la valeur retournée de `delayMs` après la dernière frappe — évite un appel API à chaque
// caractère tapé dans un champ de recherche.
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// Téléchargement d'un PDF généré côté serveur (factures, notes de crédit, relevés livreurs) — même
// pattern d'authentification par blob que ClientInvoicesPage.jsx (download Stripe en masse), mais ici un
// PDF unique par appel plutôt qu'un zip.
export async function downloadPdf(path, token, filename) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || { fr: 'Échec du téléchargement.', en: 'Download failed.', nl: 'Downloaden mislukt.' }[getLanguage()]);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
