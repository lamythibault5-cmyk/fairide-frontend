/* LA CONNEXION DU SITE EN DEUX MOITIÉS (fondateur, 2026-10-16, section 2 de mockups/site-ordinateur.html). Sous l'en-tête
   des visiteurs, qui ne change pas : l'iris à gauche prolonge l'en-tête (un titre et le vélo de la marque qui attend sur sa
   route) ; le formulaire est posé sur une feuille blanche à droite, sans carte autour. Sur téléphone, PAS de second bandeau
   iris sous celui de l'en-tête (fondateur, 2026-10-16 : « double bannière, trop lourd ») : le titre en encre sur le blanc,
   le formulaire juste dessous (site-cadre.css, partie 6). La route des étapes à vélo de l'inscription est retirée le même
   jour (« trop appli ») : la barre d'étape du formulaire suffit. Styles : site-cadre.css, partie 6.
   `.auth-box` reste sur le conteneur du formulaire (scroll-margin-top, site-cadre.css).
   Sorti de pages/Auth.jsx le 2026-10-19 : le nouveau mot de passe (ResetPassword.jsx) prend le même cadre sur le site. Auth.jsx
   est chargé à la demande ; ResetPassword ne l'est pas — l'importer depuis Auth.jsx aurait mis toute la connexion dans le
   premier chargement de chaque visiteur. */
export default function CadreConnexion({ decorClass = '', titre, sous, long = false, scene = true, children }) {
  return (
    <div className={`decor-page auth-decor auth-site${long ? ' auth-site--long' : ''} ${decorClass}`}>
      <section className="auth-site-iris sur-iris">
        <div className="auth-site-titre">
          <h1>{titre}</h1>
          {sous && <p>{sous}</p>}
        </div>
        {scene && <div className="auth-site-scene"><SceneVelo /></div>}
      </section>
      <div className="auth-site-feuille">
        <div className="auth-box">{children}</div>
      </div>
    </div>
  );
}

// Le vélo de la marque qui attend sur sa route pointillée, à côté d'un repère (EtatVide.jsx, mais sur l'iris : vélo lime).
function SceneVelo() {
  return (
    <svg viewBox="0 0 280 140" aria-hidden="true">
      <line x1="14" y1="123" x2="266" y2="123" stroke="rgba(255,255,255,.45)" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
      <g transform="translate(214 74) scale(1.75)" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
      </g>
      <g transform="translate(70 68) scale(1.25)">
        <g fill="none" stroke="#C8F03C" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
        <g fill="#C8F03C"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
      </g>
    </svg>
  );
}
