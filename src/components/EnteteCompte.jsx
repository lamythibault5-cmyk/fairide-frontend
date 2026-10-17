import { Link, useLocation } from 'react-router-dom';
import { etatFeuille } from '../feuilles';
import Icone from './Icone';
import { useLanguage } from '../context/LanguageContext';

/* L'EN-TÊTE DE MON COMPTE, SUR LE BANDEAU IRIS (fondateur, 2026-10-16 : « Proposition » de Mon compte dans
 * mockups/tous-les-ecrans.html). Les initiales dans un rond lime, le nom en titre et l'e-mail dessous, puis les trois
 * raccourcis du rôle en tuiles sur l'iris ; le vélo de la marque est garé au bord. Tout ce qui suit monte dans la feuille
 * blanche (.compte-feuille, Account.jsx). Le style est dans ecran-compte.css, importé par Account.jsx ; sur le site large
 * (site-compte.css, 1100 px et plus, hors app), l'identité et les raccourcis tiennent sur une ligne, en pastilles.
 *
 * Les raccourcis ne créent aucune destination : ce sont des pages qui existent déjà (voir Account.jsx, `raccourcis`). */
export default function EnteteCompte({ nom, email, initiales, raccourcis }) {
  const { t } = useLanguage();
  const location = useLocation();
  return (
    <div className="compte-bandeau">
      <div className="compte-tete">
        <span className="compte-avatar" aria-hidden="true">{initiales}</span>
        <span className="compte-tete-texte">
          {/* LE NOM EST LE TITRE DE LA PAGE : il confirme d'un coup d'œil sous quel compte on est. L'e-mail dessous,
              sauf quand il est déjà le titre (compte sans nom). */}
          <h1 className="compte-nom">{nom || email}</h1>
          {nom && email && <span className="compte-email">{email}</span>}
        </span>
      </div>
      <nav className="compte-raccourcis" aria-label={t('ecranCompte.raccourcis')}>
        {raccourcis.map((r) => (
          // Favoris, Mes commandes, Mes factures… s'ouvrent en feuille par-dessus Mon compte (feuilles.js).
          <Link key={r.to} to={r.to} state={etatFeuille(r.to, location)} className="compte-raccourci">
            <Icone nom={r.icone} taille={24} />
            <span>{r.libelle}</span>
          </Link>
        ))}
      </nav>
      <span className="compte-velo" aria-hidden="true"><VeloGare /></span>
    </div>
  );
}

// Le vélo de la marque (BrandMark.jsx, sans tuile), lime sur l'iris : même tracé que la route de l'accueil (EcransBienvenue.jsx).
function VeloGare() {
  return (
    <svg viewBox="-3 5 82 42" width="32" height="17">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}
