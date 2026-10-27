import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

/* HALAL, VÉGÉTARIEN, VEGAN, SANS GLUTEN, BIO — DÉCLARÉS PAR LE COMMERCE (comparaison avec Uber Eats, 15 oct. 2026 ; backend
 * migrations 042 et 094, PATCH /restaurants/:id/menu/:itemId/diet).
 *
 * Fondateur : c'est le commerce qui coche, et qui en répond — rien n'est déduit des allergènes, pas encore fiables. Ce que
 * TOUTE la carte est se dit une fois, dans « Toute ta carte est… ? » (RegimesCommerce.jsx, Mon commerce › Ce que tu vends,
 * 2026-10-27) : la colonne est alors cochée pour tous les plats, sans case à toucher (avant : une case « tout halal » ici).
 * Les clients ne voient pas encore ces mentions plat par plat (MENTIONS_ALIMENTAIRES, dietary.js).
 * « Sans gluten » est une mention réglementée (règlement UE 828/2014) : la règle est écrite juste au-dessus des cases.
 * La carte est verrouillée (MENU_LOCKED), mais ces mentions passent comme les allergènes : elles ne changent ni prix ni
 * plat, et ne rouvrent pas la signature de la carte. Chaque case s'enregistre seule, au clic. */
// [champ du plat, libellé, ce qui coche toute la colonne pour tout le commerce]. Un plat vegan est aussi végétarien.
const MENTIONS = [['halal', 'dietHalal', ['halalAll']], ['vegetarian', 'dietVegetarian', ['vegetarianAll', 'veganAll']], ['vegan', 'dietVegan', ['veganAll']],
  ['glutenFree', 'dietGlutenFree', ['glutenFreeAll']], ['organic', 'dietOrganic', []]];

export default function MentionsAlimentaires({ restaurant, restoId, token, onChange }) {
  const { t } = useLanguage();
  const toast = useToast();
  // Valeurs locales par plat, pour que la case réponde tout de suite ; la carte du tableau de bord est rechargée ensuite.
  // `halalDeclared` : la case du plat lui-même (audit du 19/10, shop-322). `halal` vaut aussi « tout l'établissement » : sous
  // une case générale, chaque plat paraissait décoché, et décocher le tout montrait des plats décochés que les clients
  // voyaient encore halal. Repli sur l'ancien calcul pour une fiche qui n'aurait pas encore le champ.
  const [plats, setPlats] = useState(() => Object.fromEntries((restaurant.menu || []).map((m) => [m.id, { halal: m.halalDeclared ?? (!!m.halal && !restaurant.halalAll), vegetarian: !!m.vegetarian, glutenFree: !!m.glutenFree, vegan: !!m.vegan, organic: !!m.organic }])));
  const [occupe, setOccupe] = useState(null);

  async function basculer(id, cle, valeur) {
    setOccupe(`${id}:${cle}`);
    // Vegan coche aussi végétarien ; décocher végétarien décoche vegan.
    const lie = cle === 'vegan' && valeur ? { vegetarian: true } : cle === 'vegetarian' && !valeur ? { vegan: false } : {};
    const avant = plats[id];
    setPlats((p) => ({ ...p, [id]: { ...p[id], [cle]: valeur, ...lie } }));
    try {
      await api(`/restaurants/${restoId}/menu/${id}/diet`, { method: 'PATCH', token, body: { [cle]: valeur, ...lie } });
      onChange?.();
    } catch (e) {
      setPlats((p) => ({ ...p, [id]: avant }));
      toast(e.message, 'erreur');
    } finally { setOccupe(null); }
  }

  const menu = (restaurant.menu || []).filter((m) => !m.withdrawn);
  if (!menu.length) return null;
  return (
    <details className="card" style={{ marginBottom: 14 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('menuPage.dietTitle')}</summary>
      <p className="small" style={{ margin: '8px 0' }}>{t('menuPage.dietIntro')}</p>
      <p className="small" style={{ margin: '0 0 6px', fontWeight: 600 }}>{t('menuPage.dietToutLeCommerce')}</p>
      <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-soft)' }}>{t('menuPage.dietGlutenRule')}</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', padding: '4px 6px' }}>{t('menuPage.dietDish')}</th>
              {MENTIONS.map(([cle, lib]) => <th key={cle} scope="col" style={{ padding: '4px 6px' }}>{t(`menuPage.${lib}`)}</th>)}
            </tr>
          </thead>
          <tbody>
            {menu.map((m) => (
              <tr key={m.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '4px 6px' }}>{m.name}</td>
                {MENTIONS.map(([cle, lib, tout]) => {
                  const inclus = tout.some((d) => restaurant[d] === true);
                  return (
                    <td key={cle} style={{ textAlign: 'center', padding: '4px 6px' }}>
                      <input type="checkbox" style={{ width: 'auto' }} aria-label={`${t(`menuPage.${lib}`)} : ${m.name}`}
                        checked={inclus || !!plats[m.id]?.[cle]} disabled={inclus || occupe === `${m.id}:${cle}`}
                        onChange={(e) => basculer(m.id, cle, e.target.checked)} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
