import { useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

/* HALAL, SANS GLUTEN, VEGAN, BIO — DÉCLARÉS PAR LE COMMERCE (comparaison avec Uber Eats, 15 oct. 2026 ; backend
 * migration 042, PATCH /restaurants/:id/menu/:itemId/diet et PATCH /restaurants/:id/diet).
 *
 * Fondateur : c'est le commerce qui coche, et qui en répond — rien n'est déduit des allergènes, pas encore fiables. Le
 * halal se certifie le plus souvent pour toute la cuisine : une case le dit pour tout l'établissement, les plats suivent.
 * « Sans gluten » est une mention réglementée (règlement UE 828/2014) : la règle est écrite juste au-dessus des cases.
 * La carte est verrouillée (MENU_LOCKED), mais ces mentions passent comme les allergènes : elles ne changent ni prix ni
 * plat, et ne rouvrent pas la signature de la carte. Chaque case s'enregistre seule, au clic. */
const MENTIONS = [['halal', 'dietHalal'], ['glutenFree', 'dietGlutenFree'], ['vegan', 'dietVegan'], ['organic', 'dietOrganic']];

export default function MentionsAlimentaires({ restaurant, restoId, token, onChange }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [toutHalal, setToutHalal] = useState(!!restaurant.halalAll);
  // Valeurs locales par plat, pour que la case réponde tout de suite ; la carte du tableau de bord est rechargée ensuite.
  // `halalDeclared` : la case du plat lui-même (audit du 19/10, shop-322). `halal` vaut aussi « tout l'établissement » : sous
  // une case générale, chaque plat paraissait décoché, et décocher le tout montrait des plats décochés que les clients
  // voyaient encore halal. Repli sur l'ancien calcul pour une fiche qui n'aurait pas encore le champ.
  const [plats, setPlats] = useState(() => Object.fromEntries((restaurant.menu || []).map((m) => [m.id, { halal: m.halalDeclared ?? (!!m.halal && !restaurant.halalAll), glutenFree: !!m.glutenFree, vegan: !!m.vegan, organic: !!m.organic }])));
  const [occupe, setOccupe] = useState(null);

  async function basculerTout(valeur) {
    setOccupe('tout'); setToutHalal(valeur);
    try {
      await api(`/restaurants/${restoId}/diet`, { method: 'PATCH', token, body: { halalAll: valeur } });
      onChange?.();
    } catch (e) { setToutHalal(!valeur); toast(e.message, 'erreur'); } finally { setOccupe(null); }
  }
  async function basculer(id, cle, valeur) {
    setOccupe(`${id}:${cle}`);
    setPlats((p) => ({ ...p, [id]: { ...p[id], [cle]: valeur } }));
    try {
      await api(`/restaurants/${restoId}/menu/${id}/diet`, { method: 'PATCH', token, body: { [cle]: valeur } });
      onChange?.();
    } catch (e) {
      setPlats((p) => ({ ...p, [id]: { ...p[id], [cle]: !valeur } }));
      toast(e.message, 'erreur');
    } finally { setOccupe(null); }
  }

  const menu = (restaurant.menu || []).filter((m) => !m.withdrawn);
  if (!menu.length) return null;
  return (
    <details className="card" style={{ marginBottom: 14 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{t('menuPage.dietTitle')}</summary>
      <p className="small" style={{ margin: '8px 0' }}>{t('menuPage.dietIntro')}</p>
      <label className="row small" style={{ gap: 8, alignItems: 'center', margin: '0 0 6px', fontWeight: 600 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={toutHalal} disabled={occupe === 'tout'} onChange={(e) => basculerTout(e.target.checked)} />
        {t('menuPage.dietHalalAll')}
      </label>
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
                {MENTIONS.map(([cle, lib]) => {
                  const inclus = cle === 'halal' && toutHalal;
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
