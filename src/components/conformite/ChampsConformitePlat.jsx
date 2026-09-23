import { useId } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { CODES_ALLERGENES } from '../../allergenes';

/* Champs de conformité d'un plat, dans l'éditeur du restaurateur (backlog de conformité du 23/09/2026).
 *
 *   A1 — les 14 allergènes réglementaires, OU « aucun des 14 » : les deux sont exclusifs, et un plat
 *        sans l'un ni l'autre est « non déclaré » (masqué aux clients passé la date bascule).
 *   A2 — le taux de TVA appliqué : la signature de la carte l'exige pour chaque plat.
 *   A4 — alcool et âge minimum : sans autorisation accises vérifiée, le serveur refuse de marquer un
 *        plat « alcool » (ALCOOL_SANS_AUTORISATION) — l'erreur s'affiche à l'enregistrement.
 * `valeur` : { allergens: number[], allergensDeclaredNone, vatRate, isAlcohol, minAge }. */
export default function ChampsConformitePlat({ valeur, onChange }) {
  const { t } = useLanguage();
  const id = useId();
  const maj = (champs) => onChange({ ...valeur, ...champs });
  const codes = new Set(valeur.allergens || []);
  const basculer = (c) => {
    const n = new Set(codes);
    if (n.has(c)) n.delete(c); else n.add(c);
    maj({ allergens: [...n].sort((a, b) => a - b), allergensDeclaredNone: n.size ? false : valeur.allergensDeclaredNone });
  };
  return (
    <fieldset className="field champs-conformite-plat">
      <legend className="titre-groupe">{t('conformite.dishAllergensTitle')}</legend>
      <div className="grille-allergenes">
        {CODES_ALLERGENES.map((c) => (
          <label key={c} className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={codes.has(c)} onChange={() => basculer(c)} />
            <span className="small">{t(`conformite.allergen${c}`)}</span>
          </label>
        ))}
      </div>
      <label className="row" style={{ gap: 6, cursor: 'pointer', marginTop: 6 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={!!valeur.allergensDeclaredNone && codes.size === 0}
          onChange={(e) => maj({ allergensDeclaredNone: e.target.checked, allergens: e.target.checked ? [] : valeur.allergens })} />
        <span className="small">{t('conformite.dishAllergensNone')}</span>
      </label>
      {!codes.size && !valeur.allergensDeclaredNone && <p className="small" style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{t('conformite.dishAllergensUndeclared')}</p>}

      <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor={`${id}-tva`} className="small">{t('conformite.dishVat')}</label>
          <select id={`${id}-tva`} value={valeur.vatRate ?? ''} onChange={(e) => maj({ vatRate: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">—</option>
            {[6, 12, 21, 0].map((r) => <option key={r} value={r}>{r} %</option>)}
          </select>
        </div>
        <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={!!valeur.isAlcohol} onChange={(e) => maj({ isAlcohol: e.target.checked, minAge: e.target.checked ? (valeur.minAge || 18) : null })} />
          <span className="small">{t('conformite.dishAlcohol')}</span>
        </label>
        {valeur.isAlcohol && (
          <div>
            <label htmlFor={`${id}-age`} className="small">{t('conformite.dishMinAge')}</label>
            <select id={`${id}-age`} value={valeur.minAge || 18} onChange={(e) => maj({ minAge: Number(e.target.value) })}>
              <option value={18}>18</option>
              <option value={16}>16</option>
            </select>
          </div>
        )}
      </div>
      {valeur.isAlcohol && <p className="small" style={{ margin: '4px 0 0', color: 'var(--ink-soft)' }}>{t('conformite.dishAlcoholHelp')}</p>}
    </fieldset>
  );
}
