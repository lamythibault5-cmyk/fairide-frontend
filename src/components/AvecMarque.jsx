// LE NOM DANS UN TITRE, EN MOT-LOGO (2026-10-13, retour du fondateur : « Fairide doit être dans la bonne police »).
//
// Dans un titre (« Pourquoi Fairide ? », « Rejoins Fairide… »), le nom s'affichait dans la police des titres, comme un mot
// quelconque, alors qu'à deux centimètres le logo l'écrit en Bricolage Grotesque, en minuscules. Ce composant remplace
// « Fairide » par le mot-logo (.wordmark) et laisse le reste du texte traduit tel quel — la phrase reste dans les trois
// langues, seul le nom change d'habit. Réservé aux TITRES : dans une phrase courante, « Fairide » reste dans la police du
// texte, comme les autres noms propres (et .wordmark ne s'étend jamais à un titre entier — voir CLAUDE.md).
export default function AvecMarque({ children }) {
  if (typeof children !== 'string') return children;
  const morceaux = children.split(/\b(Fairide)\b/);
  if (morceaux.length === 1) return children;
  return morceaux.map((m, i) => (m === 'Fairide' ? <span key={i} className="wordmark mot-marque">fairide</span> : m));
}
