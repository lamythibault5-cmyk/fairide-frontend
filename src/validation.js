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

// Téléphone : au moins 8 chiffres une fois les séparateurs retirés (le serveur normalise en +32…).
export function telephonePlausible(v) {
  const c = String(v || '').replace(/\D/g, '');
  return c.length >= 8 && c.length <= 15;
}
