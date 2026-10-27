// Mon compte sur ordinateur (RubriquesCompte.jsx) : à part, pour que ce fichier de composants n'exporte que des composants.

/* La rubrique où se trouve une rangée qu'un lien ouvre (?ouvrir=…, voir les liens vers /account) : sur ordinateur, c'est
   elle qu'on montre en arrivant, sinon la rangée dépliée resterait dans une rubrique cachée. Tout ce qui n'est pas listé
   ici (cartes, terminal, contrat, paiement, abonnement, services, activité…) appartient à la rubrique du rôle. */
const RUBRIQUE_DE = {
  messages: 'messages',
  infos: 'profil', connexion: 'profil', mdp: 'profil', langue: 'profil', notifs: 'profil', nouvelles: 'profil', donnees: 'profil', documents: 'profil', geo: 'profil',
  // Les cartes du client sont dans son portefeuille depuis le 2026-10-27 (maquettes/compte).
  solde: 'solde', convertir: 'solde', parrainage: 'solde', cartes: 'solde'
};
export function rubriqueDe(section) {
  if (!section) return 'profil';
  return RUBRIQUE_DE[section] || 'role';
}
