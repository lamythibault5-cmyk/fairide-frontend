/* UN AVIS DIT DE QUOI IL PARLE, ET LA RÉPONSE EST SIGNÉE PAR UNE PERSONNE (audit design 2, idée 11f, fondateur 2026-10-19).
 * Le serveur (GET /restaurants/:id/reviews) envoie avec chaque avis les plats de la commande (`dishes`, trois au plus,
 * sans émoji) et, pour une livraison, la commune (`commune`, jamais la rue), et pour le commerce le prénom qui signe ses
 * réponses (`signature`, réglé dans Avis › « Signer mes réponses » ; null = pas de signature). Affiché pareil sur la fiche
 * du commerce (clients) et dans l'écran Avis du commerce. */
export function ContexteAvis({ avis, className = 'small' }) {
  const texte = [(avis?.dishes || []).join(', '), avis?.commune].filter(Boolean).join(' · ');
  if (!texte) return null;
  return <span className={className} style={{ display: 'block', color: 'var(--ink-soft)' }}>{texte}</span>;
}

export function SignatureReponse({ signature, className = 'small' }) {
  const s = String(signature || '').trim();
  if (!s) return null;
  return <span className={className} style={{ display: 'block', marginTop: 2, color: 'var(--ink-soft)', fontWeight: 600 }}>— {s}</span>;
}
