// Un compte de test se reconnaît au même motif que le contournement de vérification à l'inscription
// (voir routes/auth.js, isQaTestAccount) : un alias "+qa" dans l'adresse email (ex: toi+qa1@gmail.com).
// Aucun champ base de données dédié — dérivé à la volée de l'email déjà présent dans chaque liste admin.
export function isTestAccount(email) {
  return /\+qa/i.test(email || '');
}

export function TestBadge() {
  return <span className="pill test-account-pill" title="Compte de test (+qa dans l'email)">🧪 Test</span>;
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
  return new Date(ts).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const ORDER_STATUS_LABELS = {
  nouveau: 'Nouvelle',
  preparation: 'En préparation',
  pret: 'Prête',
  livraison: 'En livraison',
  livre: 'Livrée',
  refuse: 'Refusée',
  annule: 'Annulée'
};

export const ORDER_STATUSES = ['nouveau', 'preparation', 'pret', 'livraison', 'livre', 'refuse', 'annule'];

export const BUSINESS_STATUS_LABELS = {
  prospect: { label: '🔎 Prospect', color: 'inherit' },
  onboarding: { label: '🕐 Onboarding', color: 'var(--gold-deep)' },
  actif: { label: '✅ Actif', color: 'var(--teal-deep)' },
  suspendu: { label: '🚫 Suspendu', color: 'var(--red)' }
};
