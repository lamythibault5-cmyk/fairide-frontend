import { useId, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { vibrer } from '../../gestes';
import { eurosCourt, libellePromo } from '../../prixPlat';
import { CocheTrait } from './BandeauCommerce';

/* PLUSIEURS PLATS POUR UNE PROMO (2026-11-11). Un commerce voulait « 1 + 1 » sur plusieurs plats : le formulaire avait un
 * menu déroulant « Plat concerné », un seul plat, et il fallait refaire toute la promo pour chaque plat. Ici, la carte en
 * rangées à cocher, groupées par section comme sur la page Carte : toucher la rangée coche le plat, « Tout choisir »
 * coche la section entière (toutes les pizzas en 1 + 1 en un geste). Au-delà de 10 plats, un champ filtre par nom.
 * Un plat qui a déjà une promo active le dit sous son nom : elle sera remplacée (une seule promo active par plat,
 * routes/promotions.js côté serveur). Les plats retirés de la carte n'apparaissent pas. La coche est iris : le seul
 * lime de l'écran reste le bouton qui crée la promo. Styles : ecran-commerce.css, bloc « Plats d'une promo ». */

const SEUIL_RECHERCHE = 10;
// Recherche sans accents ni majuscules : « pates » trouve « Pâtes ».
const plier = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ChoixPlatsPromo({ menu, choisis, onChange, promoParPlat }) {
  const { t } = useLanguage();
  const ids = useId();
  const [filtre, setFiltre] = useState('');

  const plats = useMemo(() => (menu || []).filter((m) => !m.withdrawn), [menu]);
  // Les sections dans l'ordre de la carte (celui où elles apparaissent la première fois).
  const sections = useMemo(() => {
    const f = plier(filtre.trim());
    const ordre = [];
    const parNom = new Map();
    for (const m of plats) {
      if (f && !plier(m.name).includes(f)) continue;
      const nom = m.category || t('promosPage.otherSection');
      if (!parNom.has(nom)) { parNom.set(nom, []); ordre.push(nom); }
      parNom.get(nom).push(m);
    }
    return ordre.map((nom) => ({ nom, plats: parNom.get(nom) }));
  }, [plats, filtre, t]);

  function basculer(id) {
    vibrer('bascule');
    const s = new Set(choisis);
    if (s.has(id)) s.delete(id); else s.add(id);
    onChange(s);
  }
  function toute(section, cocher) {
    vibrer('bascule');
    const s = new Set(choisis);
    section.plats.forEach((m) => (cocher ? s.add(m.id) : s.delete(m.id)));
    onChange(s);
  }

  if (!plats.length) return <p className="ec-aide">{t('promosPage.noDishes')}</p>;

  return (
    <div className="ec-plats-promo">
      <div className="ec-plats-promo-tete">
        <p className="ec-feuille-titre" id={ids + '-titre'}>{t('promosPage.whichDishes')}</p>
        <span className="ec-plats-promo-compte" aria-live="polite">
          {choisis.size === 0 ? t('promosPage.noneChosen') : t(choisis.size > 1 ? 'promosPage.chosen_other' : 'promosPage.chosen_one', { n: choisis.size })}
        </span>
      </div>
      {plats.length > SEUIL_RECHERCHE && (
        <div className="field" style={{ marginBottom: 4 }}>
          <label htmlFor={ids + '-filtre'} className="sr-only">{t('promosPage.searchDish')}</label>
          <input id={ids + '-filtre'} type="search" value={filtre} onChange={(e) => setFiltre(e.target.value)}
            placeholder={t('promosPage.searchDish')} autoComplete="off" enterKeyHint="search" />
        </div>
      )}
      {sections.length === 0 && <p className="ec-aide">{t('promosPage.noDishFound')}</p>}
      <div role="group" aria-labelledby={ids + '-titre'}>
        {sections.map((section) => {
          const tous = section.plats.every((m) => choisis.has(m.id));
          return (
            <div key={section.nom} className="ec-plats-promo-section">
              <div className="ec-plats-promo-entete">
                <span>{section.nom}</span>
                {section.plats.length > 1 && (
                  <button type="button" className="ec-lien" onClick={() => toute(section, !tous)}>
                    {tous ? t('promosPage.unselectSection') : t('promosPage.selectSection')}
                  </button>
                )}
              </div>
              {section.plats.map((m) => {
                const coche = choisis.has(m.id);
                const deja = promoParPlat?.[m.id];
                return (
                  <button key={m.id} type="button" role="checkbox" aria-checked={coche} className="ec-choix-plat" onClick={() => basculer(m.id)}>
                    <span className="ec-choix-rond" aria-hidden="true">{coche && <CocheTrait taille={12} />}</span>
                    <span className="ec-ligne-texte">
                      <b>{m.name}</b>
                      {deja && <small>{t(coche ? 'promosPage.replacesPromo' : 'promosPage.hasPromo', { promo: libellePromo(deja, t) || deja.label })}</small>}
                    </span>
                    {m.price != null && <span className="ec-choix-prix">{eurosCourt(m.price)}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
