// LE MOT-LOGO « fairride » (fondateur, 2026-10-25 : on écrivait « fairide » avec un seul r, les gens tapaient
// « fairride » et ne nous trouvaient pas ; le domaine fairride.be était déjà à nous).
//
// Version C de maquettes/fairride-deux-r/fairride-deux-r.html : un seul mot, comme le domaine, mais « ride » dans
// l'accent — on lit « fair ride » d'un coup et le double r n'a plus l'air d'une faute. Même police (Bricolage
// Grotesque, .wordmark), mêmes minuscules, même vélo à côté. « fair » prend la couleur du texte autour ; « ride » est
// iris sur fond clair et lime sur l'iris (variable --marque-ride, posée par les fonds iris dans styles.css).
//
// Toujours ce composant, jamais « fairride » écrit à la main dans un .wordmark : sinon le mot perd ses deux couleurs.
export default function MotMarque({ className = '', style, as: Balise = 'span' }) {
  return (
    <Balise className={`wordmark ${className}`.trim()} style={style}>
      fair<span className="wordmark-ride">ride</span>
    </Balise>
  );
}
