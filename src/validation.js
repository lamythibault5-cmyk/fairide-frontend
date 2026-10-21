// Règles de validation des formulaires publics, partagées entre l'inscription (Auth.jsx), le formulaire de
// contact (ContactSection.jsx) et les fiches d'entreprise. Ce sont les mêmes règles que le serveur
// (routes/auth.js, routes/contact.js, couriers.js) : ici elles évitent un aller-retour pour apprendre
// qu'un code postal a trois chiffres ; là-bas elles font foi.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailValide(v) {
  const s = String(v || '').trim();
  return s.length <= 200 && EMAIL_RE.test(s);
}

// Code postal belge : quatre chiffres (1000 à 9999).
export function codePostalValide(v) {
  return /^[1-9]\d{3}$/.test(String(v || '').trim());
}

// Numéro d'entreprise belge (BCE) : 10 chiffres commençant par 0 ou 1, clé de contrôle modulo 97 sur les
// 8 premiers. Accepte les points, espaces et le préfixe « BE » d'un numéro de TVA.
// Pourquoi un numéro d'entreprise est refusé (fondateur, 2026-10-06) : 'longueur' (pas 10 chiffres, avec le nombre tapé),
// 'prefixe' (un numéro BCE commence par 0 ou 1), 'cle' (les deux derniers chiffres ne sont pas la clé de contrôle des huit
// premiers : une faute de frappe quelque part), ou null s'il est bon.
export function raisonBce(v) {
  const c = String(v || '').replace(/^\s*BE/i, '').replace(/\D/g, '');
  if (c.length !== 10) return { raison: 'longueur', chiffres: c.length };
  if (!/^[01]/.test(c)) return { raison: 'prefixe' };
  if (97 - (Number(c.slice(0, 8)) % 97) !== Number(c.slice(8))) return { raison: 'cle' };
  return null;
}
export function bceValide(v) {
  const c = String(v || '').replace(/^\s*BE/i, '').replace(/\D/g, '');
  if (c.length !== 10 || !/^[01]/.test(c)) return false;
  return 97 - (Number(c.slice(0, 8)) % 97) === Number(c.slice(8));
}

// Téléphone lisible à l'écran (audit design, 2026-10-19 : « +32470123456 » ici, « +32 471 23 45 67 » là). Le serveur stocke
// +32… sans espace ; on l'affiche comme on le dicte : mobile belge « +32 470 12 34 56 », Bruxelles « +32 2 123 45 67 », autre
// fixe belge « +32 71 12 34 56 ». Un numéro étranger ou inattendu reste tel quel. Le lien tel: garde la forme brute.
export function telephoneLisible(v) {
  const brut = String(v || '').trim();
  const c = brut.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^0(?=\d{8,9}$)/, '+32');
  const m = c.match(/^\+32(\d+)$/);
  if (!m) return brut;
  const n = m[1];
  if (/^4\d{8}$/.test(n)) return `+32 ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7)}`;
  if (/^2\d{7}$/.test(n)) return `+32 2 ${n.slice(1, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
  if (/^\d{8}$/.test(n)) return `+32 ${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6)}`;
  return brut;
}

// Téléphone au format international « +32470123456 » (même règle que telephoneLisible et que phone.js du serveur) : pour
// les liens WhatsApp et SMS, qui refusent « 0470 12 34 56 » (audit du 19/10, admin-67). '' si ce n'est pas un numéro.
export function telephoneE164(v) {
  const c = String(v || '').trim().replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^0(?=\d{8,9}$)/, '+32');
  return /^\+\d{8,15}$/.test(c) ? c : '';
}
// Mobile belge (+324…) : le seul à qui un WhatsApp ou un SMS a un sens.
export function estMobileBelge(e164) {
  return /^\+324\d{8}$/.test(String(e164 || ''));
}

// Téléphone : au moins 8 chiffres une fois les séparateurs retirés (le serveur normalise en +32…).
export function telephonePlausible(v) {
  const c = String(v || '').replace(/\D/g, '');
  return c.length >= 8 && c.length <= 15;
}
