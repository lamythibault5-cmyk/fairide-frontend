import Icone from './Icone';
import { useLanguage } from '../context/LanguageContext';

/* MON COMPTE SUR ORDINATEUR, EN DEUX COLONNES (fondateur, 2026-10-16 : « Proposition » de la section 7 de
 * mockups/site-ordinateur.html). Les rubriques à gauche, le contenu de celle qu'on a choisie à droite, sans quitter la page.
 *
 * Deux pièces, et aucune ne change ce qu'une rangée fait :
 * - NavCompte : la colonne des rubriques (Messages, Mon profil, Solde et avantages, la rubrique du rôle, Mes casquettes,
 *   Assistance), puis « Se déconnecter ». Une rubrique n'existe ici que si Account.jsx l'affiche pour ce rôle.
 * - RubriqueCompte : l'enveloppe d'une rubrique (son titre et sa carte de rangées). Elle porte `data-active` quand c'est
 *   la rubrique choisie.
 *
 * Tout le reste est dans site-compte.css, et SEULEMENT sur le site large (html:not(.appli), 1100 px et plus) : ailleurs la
 * colonne des rubriques est masquée et les enveloppes sont en `display: contents`. Sur un téléphone, et dans l'app, la
 * page reste donc exactement celle d'avant — le bandeau, puis toutes les rubriques l'une sous l'autre dans la feuille ;
 * dans l'app, chaque rangée s'ouvre toujours dans une feuille (LigneCompte.jsx). On a préféré ce double rendu par la CSS
 * à un matchMedia en JavaScript : rien ne bouge au redimensionnement, et l'app n'exécute aucun code de plus. */
export function NavCompte({ rubriques, active, onChoisir, onDeconnexion }) {
  const { t } = useLanguage();
  return (
    <nav className="compte-nav" aria-label={t('siteCompte.navAria')}>
      {rubriques.map((r) => (
        <button key={r.cle} type="button" data-cat={r.cle} className={`compte-nav-bouton${r.cle === active ? ' on' : ''}`}
          aria-current={r.cle === active ? 'true' : undefined} onClick={() => onChoisir(r.cle)}>
          <Icone nom={r.icone} taille={20} />
          <span className="compte-nav-texte">{r.titre}</span>
          {r.compteur > 0 && <span className="compte-nav-compteur" aria-label={t('inbox.rowSubUnread', { n: r.compteur })}>{r.compteur}</span>}
        </button>
      ))}
      <button type="button" className="compte-nav-bouton compte-nav-sortie" onClick={onDeconnexion}>
        <Icone nom="porte" taille={20} />
        <span className="compte-nav-texte">{t('nav.logout')}</span>
      </button>
    </nav>
  );
}

export function RubriqueCompte({ cle, active, children }) {
  return <div className="compte-categorie" data-cat={cle} data-active={cle === active ? '' : undefined}>{children}</div>;
}
