// Les icônes de l'interface, en traits.
//
// POURQUOI PAS DES EMOJIS. L'application en comptait 461 en guise d'icônes. Un emoji n'est pas
// dessiné par nous : c'est la police du système qui le rend, donc le même 🔒 est un cadenas doré
// bombé sur Windows, gris et plat sur macOS, vert sur Android. Ils n'ont ni épaisseur de trait ni
// taille optique communes — côte à côte dans une liste, certains pèsent trois fois plus que leurs
// voisins — et ils ignorent la couleur du texte, donc une barre d'onglets ne peut pas marquer
// l'onglet actif en inversant sa couleur. Un tracé monochrome règle les quatre à la fois.
//
// UN SEUL FICHIER, PAS UNE BIBLIOTHÈQUE. Le CLAUDE.md rappelle que l'absence de dépendances est un
// choix et non un oubli ; une quarantaine de tracés de vingt lignes ne justifie pas un paquet de
// plus à suivre.
//
// LES RÉGLAGES SONT CEUX DE PasswordInput.jsx, qui a ouvert la voie : grille de 24, trait de 1,8,
// bouts et jointures arrondis, `currentColor`. La couleur vient donc toujours du texte autour, ce
// qui fait qu'une icône posée sur un onglet actif en iris devient blanche sans rien changer ici.
//
// aria-hidden PAR DÉFAUT : une icône double toujours un libellé (visible, ou porté par title et
// aria-label sur les onglets). Elle n'est jamais la seule chose qui nomme une destination, donc
// l'annoncer une seconde fois ne ferait que bavarder.

const TRACES = {
  // — Navigation —
  restaurants: <><path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" /><path d="M6 12v9" /><path d="M17 3c-1.7 0-3 2.2-3 5s1.3 4 3 4 3 0 3 0V3Z" /><path d="M17 12v9" /></>,
  recherche: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  commandes: <><path d="M3 8h18l-1.3 11a2 2 0 0 1-2 1.8H6.3a2 2 0 0 1-2-1.8L3 8Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  favoris: <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20Z" />,
  carte: <><path d="M9 4 3 7v13l6-3 6 3 6-3V4l-6 3-6-3Z" /><path d="M9 4v13" /><path d="M15 7v13" /></>,
  compte: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  commerce: <><path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" /><path d="M3 9 5 4h14l2 5" /><path d="M9 21v-6h6v6" /></>,
  reservations: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>,
  apercu: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  masque: <><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.3 18.3 0 0 1-2.9 3.8M6.6 6.6A18.3 18.3 0 0 0 2 12s3.6 7 10 7a10.8 10.8 0 0 0 4.2-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></>,
  dossier: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8.5" cy="11" r="2" /><path d="M5 16c.6-1.5 2-2.2 3.5-2.2S11.4 14.5 12 16" /><path d="M15 10h4" /><path d="M15 14h4" /></>,
  scooter: <><circle cx="5.5" cy="17.5" r="2.5" /><circle cx="18.5" cy="17.5" r="2.5" /><path d="M8 17.5h8" /><path d="M18.5 17.5 16 7h-3" /><path d="M5.5 15V12h6l3.5 5.5" /></>,
  sac: <><path d="M5 8h14l-1 12a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,

  // — Argent —
  euro: <><circle cx="12" cy="12" r="9" /><path d="M16 9.2A4.3 4.3 0 0 0 13 8c-2.2 0-4 1.8-4 4s1.8 4 4 4a4.3 4.3 0 0 0 3-1.2" /><path d="M7.5 11h5" /><path d="M7.5 13.5h5" /></>,
  carteBancaire: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M6 15h4" /></>,
  // Portefeuille : un rabat en haut et une poche à droite, pour ne pas se confondre avec
  // carteBancaire, dont la rangée est souvent juste à côté dans Mon compte.
  solde: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5" /><rect x="3" y="7.5" width="18" height="12.5" rx="2.5" /><path d="M21 12h-4a2 2 0 0 0 0 4h4" /></>,
  banque: <><path d="m3 10 9-6 9 6" /><path d="M5 10v9" /><path d="M10 10v9" /><path d="M14 10v9" /><path d="M19 10v9" /><path d="M3 20h18" /></>,
  etiquette: <><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  // Les deux encoches sur les flancs font le ticket : une simple boîte fendue se lisait comme un
  // nœud papillon à 20px.
  ticket: <><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4V7.5Z" /><path d="M13 9.5v5" /></>,
  cadeau: <><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M3 13h18" /><path d="M12 9v12" /><path d="M12 9S9.5 9 8.3 7.8a2 2 0 1 1 3-2.6C12.4 6.4 12 9 12 9Z" /><path d="M12 9s2.5 0 3.7-1.2a2 2 0 1 0-3-2.6C11.6 6.4 12 9 12 9Z" /></>,

  // — Compte et sécurité —
  courrier: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  cadenas: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  cle: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9" /><path d="m17 6 2 2" /><path d="m14.5 8.5 2 2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></>,
  bouclier: <><path d="M12 3 5 6v5.5c0 4.3 3 7.6 7 9.5 4-1.9 7-5.2 7-9.5V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  antenne: <><circle cx="12" cy="12" r="2" /><path d="M8.4 8.4a5 5 0 0 0 0 7.2" /><path d="M15.6 15.6a5 5 0 0 0 0-7.2" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8" /><path d="M18.4 18.4a9 9 0 0 0 0-12.8" /></>,

  // — Documents et outils —
  document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>,
  contrat: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5" /><path d="M9 16c1.2-2.5 2-2.5 3 0s1.8 2.5 3 0" /></>,
  guide: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13v4H6a2 2 0 0 1-2-2Z" /><path d="M9 7h6" /></>,
  imprimante: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7v-7Z" /></>,
  stats: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  boussole: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>,
  bouee: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" /><path d="m5.6 5.6 3.8 3.8" /><path d="m14.6 14.6 3.8 3.8" /><path d="m18.4 5.6-3.8 3.8" /><path d="m9.4 14.6-3.8 3.8" /></>,
  lien: <><path d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5" /><path d="M14 11a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 19.7l1.5-1.5" /></>,
  // Six pattes qui DÉPASSENT du corps, sinon le corps et les traits se fondaient en une étoile.
  bogue: <><path d="M8 9a4 4 0 0 1 8 0v5a4 4 0 0 1-8 0V9Z" /><path d="M12 9v9" /><path d="M8 11H4.5" /><path d="M8 15H4.5" /><path d="M16 11h3.5" /><path d="M16 15h3.5" /><path d="M9.5 6 8 4" /><path d="m14.5 6 1.5-2" /></>,

  // — États —
  etoile: <path d="m12 4 2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4-3.9 5.5-.8L12 4Z" />,
  horloge: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l3.5 2" /></>,
  interdit: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  position: <><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  cloche: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  // « Intérieur » au paiement : une maison, distincte de `commerce` par son toit en pointe.
  maison: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M10 21v-6h4v6" /></>,
  // « Terrasse » : le soleil, en face de la maison.
  soleil: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.9 4.9 6.3 6.3" /><path d="m17.7 17.7 1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m4.9 19.1 1.4-1.4" /><path d="m17.7 6.3 1.4-1.4" /></>,
  // « Sonner », pour les consignes de livraison — la cloche est déjà prise par les notifications.
  sonnette: <><rect x="6" y="3" width="12" height="18" rx="4" /><circle cx="12" cy="9" r="2" /><path d="M10 15h4" /></>,
  // « Déposer devant la porte ».
  porte: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="15" cy="12" r="1" /></>,
  // « Laisser au concierge » : un immeuble.
  immeuble: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M9 7h2" /><path d="M13 7h2" /><path d="M9 11h2" /><path d="M13 11h2" /><path d="M10 21v-5h4v5" /></>,
  // « M'appeler à l'arrivée ».
  telephone: <path d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2L21 14.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z" />,
  // Paiement en ligne / sur place : la carte bancaire existe déjà (carteBancaire), voici l'espèce.
  billet: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01" /><path d="M18 12h.01" /></>,
  // Un message du commerce, au paiement.
  bulle: <path d="M21 12a8 8 0 0 1-8 8H4l2.2-2.6A8 8 0 1 1 21 12Z" />,
  // Le son : un haut-parleur, et sa variante barrée quand la musique est coupée.
  son: <><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18 6.7a7.5 7.5 0 0 1 0 10.6" /></>,
  sonCoupe: <><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" /><path d="m16 10 4 4" /><path d="m20 10-4 4" /></>,
  // Piste tirée au sort dans le menu de musique.
  melanger: <><path d="M3 7h3l3 4.5" /><path d="M3 17h3l8-12h4" /><path d="M14 19h4" /><path d="m16 3 2 2-2 2" /><path d="m16 17 2 2-2 2" /></>,
  // L'astuce « tourne ton téléphone » : un appareil en portrait, avec sa flèche de rotation.
  mobile: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  // Modifier son pseudo sur le podium.
  crayon: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 6.5 3 3" /></>,
  // L'explication repliée derrière une bulle d'aide.
  ampoule: <><path d="M9.5 18h5" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9V15h7v-1.1A6 6 0 0 0 12 3Z" /></>,
  // Le but d'un jeu, dans sa fiche de règles.
  cible: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" /></>,
  // « Juste pour tout le monde », sur l'accueil. Le dessin vient de l'ancien IconFair de
  // landing/FeatureIcons.jsx, ramené à la grille de 24 et au trait de 1,8 — il vivait sur une
  // grille de 48 avec un trait de 2,4, et posé à côté d'une icône de la barre du bas la différence
  // d'épaisseur se voyait. Les plateaux sont des triangles pointe en haut : à 20px, deux vraies
  // coupes suspendues se refermaient en deux taches.
  balance: <><path d="M12 4v17" /><path d="M4 8.5h16" /><path d="m4 8.5-2.2 6h4.4Z" /><path d="m20 8.5-2.2 6h4.4Z" /><path d="M8 21h8" /><circle cx="12" cy="4" r="1.2" /></>,

  // — Console admin —
  // Ajoutées quand la console a quitté ses 27 emojis (voir pages/admin/adminModules.js). Mêmes
  // réglages que le reste du fichier, pour qu'une icône admin posée à côté d'une icône client
  // pèse exactement pareil.
  // Deux silhouettes : « Clients », « Équipe ». La seconde, en retrait, se distingue de `compte`.
  personnes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  coche: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="m8 12 3 3 5-6" /></>,
  eclair: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  // Trois curseurs plutôt qu'un engrenage : un engrenage à 20px devient une tache dentelée.
  reglages: <><path d="M4 6h10" /><path d="M18 6h2" /><circle cx="16" cy="6" r="2" /><path d="M4 12h4" /><path d="M12 12h8" /><circle cx="10" cy="12" r="2" /><path d="M4 18h12" /><circle cx="18" cy="18" r="2" /></>,
  megaphone: <><path d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1Z" /><path d="M19 9a4 4 0 0 1 0 6" /></>,
  alerte: <><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4.5" /><path d="M12 17.5h.01" /></>,
  tendance: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  mallette: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M3 13h18" /></>,
  grille: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>
};

export default function Icone({ nom, taille = 20, className }) {
  const trace = TRACES[nom];
  // Un nom inconnu ne casse pas la page : il ne dessine rien. Une icône manquante est un défaut
  // d'apparence, jamais une raison de faire tomber l'écran qui la contenait.
  if (!trace) return null;
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {trace}
    </svg>
  );
}
