import { useEffect, useState } from 'react';
import { API_BASE } from '../../api';

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

export const ACCOUNTING_ENTRY_TYPE_LABELS = {
  order_commission: 'Commission restaurant',
  order_delivery_share: 'Part Fairide livraison',
  order_restaurant_due: 'Dû restaurant',
  order_driver_due: 'Dû livreur',
  order_payment: 'Paiement client',
  refund: 'Remboursement',
  payout_restaurant: 'Virement restaurant',
  payout_driver: 'Virement livreur'
};

export const INVOICE_STATUS_LABELS = {
  brouillon: { label: 'Brouillon', color: 'inherit' },
  emise: { label: 'Émise', color: 'var(--gold-deep)' },
  envoyee: { label: 'Envoyée', color: 'var(--teal-deep)' },
  payee: { label: 'Payée', color: 'var(--teal-deep)' },
  en_retard: { label: 'En retard', color: 'var(--red)' },
  annulee: { label: 'Annulée', color: 'var(--red)' }
};

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
    throw new Error(data.error || 'Échec du téléchargement.');
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
