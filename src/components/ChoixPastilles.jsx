// Un choix parmi plusieurs, en pastilles plutôt qu'en liste déroulante native.
//
// POURQUOI PAS UN <select>. Sur téléphone, une liste déroulante native ouvre la roue du système :
// elle recouvre la moitié de l'écran, ne ressemble à rien d'autre dans l'application, et cache la
// question au moment même où on y répond. Le fondateur l'a d'ailleurs refusée une première fois
// sur la carte, où le motif retenu — des pastilles posées à plat — vit depuis dans MapPage.jsx.
// Il y avait encore cinq listes natives dans le paiement, sur le chemin le plus important du site.
//
// Le second défaut est qu'un <select> CACHE le choix : on ne voit que la valeur retenue, jamais
// les autres. Quatre consignes de livraison tiennent sur deux lignes de pastilles ; les voir
// toutes, c'est comprendre d'un coup d'œil qu'on peut demander de déposer devant la porte.
//
// Au-delà de `seuilDefilement` options — des créneaux horaires, des dates — la rangée défile
// horizontalement au lieu de s'empiler sur dix lignes.
export default function ChoixPastilles({ options, valeur, onChange, libelle, seuilDefilement = 8 }) {
  const defile = options.length > seuilDefilement;
  return (
    <div
      className={`choix-pastilles${defile ? ' choix-pastilles-defile' : ''}`}
      role="group"
      aria-label={libelle}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`cuisine-chip${o.value === valeur ? ' active' : ''}`}
          // aria-pressed et non role="radio" : un groupe de radios impose une navigation aux
          // flèches que rien n'implémente ici. Un bouton pressé se comprend sans cela.
          aria-pressed={o.value === valeur}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.icone}
          <span>{o.label}</span>
          {o.note && <span className="choix-pastille-note">{o.note}</span>}
        </button>
      ))}
    </div>
  );
}
