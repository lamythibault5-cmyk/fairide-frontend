import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import useAdminOverview from '../../hooks/useAdminOverview';
import useAdminRole from '../../hooks/useAdminRole';
import { hubByKey, hubModules, moduleBadge, moduleByKey } from '../../pages/admin/adminModules';

// En-tête commun des applications de l'ERP : le nom du pôle en grand avec les actions de l'écran à
// droite, puis une rangée d'onglets — les applications sœurs du pôle (voir ADMIN_HUBS).
//
// POURQUOI DES ONGLETS ET PLUS UN FIL D'ARIANE. « Applications › Livreurs » ne disait rien de
// l'existence de « Dossiers livreurs » ni de « Logistique », rangés dans une autre famille de la barre
// latérale : on passait de l'un à l'autre en redescendant une liste de vingt-sept lignes. Les
// onglets montrent les voisines d'un coup d'œil, avec leur compteur. Un pôle d'une seule application
// visible (rôle restreint) n'affiche pas d'onglets du tout : une rangée d'un seul bouton est du bruit.
//
// L'icône et la phrase de description sous le titre sont parties : le nom du pôle et l'onglet allumé
// suffisent à dire où l'on est. La description et l'aide restent derrière « En savoir plus ».
export default function AdminPageHeader({ module, title, actions, children }) {
  const { t: tr } = useLanguage();
  const [aide, setAide] = useState(false);
  const { overview } = useAdminOverview();
  const { role } = useAdminRole();
  const mod = moduleByKey(module);
  const hub = mod ? hubByKey(mod.hub) : null;
  const soeurs = hub ? hubModules(hub, role) : [];
  const avecOnglets = soeurs.length > 1;
  const nomModule = mod ? tr(`adminModules.${mod.key}`) : '';
  // Avec des onglets, le grand titre est le pôle : l'onglet allumé nomme déjà l'application, la
  // répéter en titre juste dessous se lisait deux fois. Sans onglets, c'est l'application.
  const grandTitre = avecOnglets ? tr(`adminHubs.${hub.key}`) : (title || nomModule);
  // Un titre propre à l'écran (la carte d'un restaurant) reste lisible sous les onglets.
  const sousTitre = avecOnglets && title && title !== nomModule ? title : null;
  const cleAide = mod ? `adminModules.${mod.key}_help` : '';
  const conseils = mod ? tr(cleAide) : '';
  const aAide = !!conseils && conseils !== cleAide;
  return (
    <header className="admin-page-header">
      <div className="admin-page-header-row">
        <h2 className="admin-page-title">{grandTitre}</h2>
        {actions && <div className="admin-page-header-actions">{actions}</div>}
      </div>
      {avecOnglets && (
        <nav className="admin-hub-tabs" aria-label={tr(`adminHubs.${hub.key}`)}>
          {soeurs.map((m) => {
            const b = moduleBadge(m, overview);
            return (
              // Allumé d'après l'application de l'écran et non d'après l'adresse : les rapports
              // (/admin/reports) se déclarent « dashboard » et doivent allumer l'onglet Tableau de bord.
              <Link key={m.key} to={m.path} aria-current={m.key === mod.key ? 'page' : undefined} className={`admin-hub-tab${m.key === mod.key ? ' active' : ''}`}>
                {tr(`adminModules.${m.key}`)}
                {b && <span className={`admin-hub-tab-count tone-${b.tone}`}>{b.count}</span>}
              </Link>
            );
          })}
        </nav>
      )}
      {(sousTitre || aAide) && (
        <div className="admin-page-subline">
          {sousTitre && <h3>{sousTitre}</h3>}
          {aAide && (
            <button type="button" className="admin-help-toggle" onClick={() => setAide((v) => !v)} aria-expanded={aide}>{aide ? tr('adminHome.helpLess') : tr('adminHome.helpMore')}</button>
          )}
        </div>
      )}
      {aide && aAide && <div className="admin-help-box">{mod ? `${tr(`adminModules.${mod.key}_desc`)}\n\n` : ''}{conseils}</div>}
      {children}
    </header>
  );
}
