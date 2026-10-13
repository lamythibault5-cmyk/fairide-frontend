import Icone from './components/Icone';

// Les réactions aux messages de Fairide restent enregistrées sous leur emoji (valeur côté serveur, déjà en base) ;
// à l'écran, une icône en traits (2026-10-13). Partagé par la boîte de réception (InboxSection) et l'admin (AdminMessagesPage).
const ICONE_REACTION = { '👍': 'valider', '❤️': 'favoris', '✅': 'coche', '🙏': 'contrat', '😕': 'alerte' };
export function afficherReaction(r) {
  return ICONE_REACTION[r] ? <Icone nom={ICONE_REACTION[r]} taille={18} /> : r;
}
