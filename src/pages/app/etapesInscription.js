// Les écrans de l'inscription dans l'application (InscriptionAppli.jsx), par type de compte. À part pour que l'accueil
// (Bienvenue.jsx) puisse les compter sans importer le composant entier.
export const ETAPES = {
  client: ['email', 'nom', 'tel', 'adresse', 'fin'],
  // Inscription express (2026-10-22, version A de maquettes/inscription-livreur) : le compte seulement. Statut, numéro d'entreprise,
  // véhicule et adresse se donnent dans le dossier (DossierAppli.jsx, « Ton activité », « Tes courses »), une fois, pas deux.
  driver: ['email', 'nom', 'tel', 'fin'],
  restaurant: ['email', 'nom', 'tel', 'commerce', 'type', 'entreprise', 'horaires', 'services', 'adresse', 'fin']
};

// Le nombre d'écrans de l'inscription, code compris : l'accueil en tient compte pour que les deux partagent une seule route
// (fondateur, 2026-10-30, maquettes/progression).
export const ecransInscription = (role) => (ETAPES[role] || ETAPES.client).length + 1;
