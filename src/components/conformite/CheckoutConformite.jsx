import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

/* Ce que la loi demande au panier, rassemblé en un bloc (backlog de conformité du 23/09/2026).
 *
 *   A1 — champ « allergie ou intolérance », SÉPARÉ des instructions de livraison : le commerce doit
 *        confirmer qu'il peut respecter la demande avant de préparer (routes/orders.js, accept). Le
 *        numéro à appeler avant de commander est rappelé, parce que c'est lui qui rend le modèle
 *        défendable (FAQ AFSCA : la réponse doit arriver avant le choix).
 *   C3 — déclaration d'âge, seulement si le panier contient de l'alcool, avec l'âge exigé.
 *   C1 — acceptation des CGU, seulement si le compte n'a pas accepté la version en vigueur.
 *   C2 — comment les frais sont calculés, et l'absence de droit de rétractation (CDE VI.53).
 *
 * Contrôlé par Checkout.jsx (`valeur` / `onChange`) : c'est lui qui envoie ces champs avec la commande.
 * Le serveur revérifie tout : ce bloc ne fait qu'éviter au client un aller-retour d'erreur. */
export default function CheckoutConformite({ restaurant, lignes, valeur, onChange }) {
  const { token } = useAuth();
  const { t } = useLanguage();
  const id = useId();
  const maj = (champs) => onChange({ ...valeur, ...champs });

  // Version des CGU en vigueur, et si ce compte l'a déjà acceptée (GET /auth/terms).
  useEffect(() => {
    let annule = false;
    api('/auth/terms', { token })
      .then((r) => { if (!annule) maj({ termsVersion: r.version, termsNeeded: !r.accepted }); })
      .catch(() => { if (!annule) maj({ termsNeeded: true }); });
    return () => { annule = true; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const menu = restaurant?.menu || [];
  const platsAlcool = lignes.map((l) => menu.find((m) => m.id === l.itemId)).filter((m) => m && m.isAlcohol);
  // Âge exigé : le plus élevé des plats, 18 par défaut (politique Fairide, voir alcool.js côté serveur).
  const ageRequis = platsAlcool.length ? Math.max(18, ...platsAlcool.map((m) => m.minAge || 18)) : null;
  const telephone = restaurant?.allergenContactPhone || '';

  return (
    <div className="checkout-conformite" style={{ marginTop: 12 }}>
      <details open={!!valeur.allergyRequest} style={{ marginBottom: 10 }}>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>{t('conformite.allergyToggle')}</summary>
        <div className="field" style={{ marginTop: 6 }}>
          <label htmlFor={`${id}-allergie`} className="small">{t('conformite.allergyLabel')}</label>
          <textarea id={`${id}-allergie`} rows={2} maxLength={500} value={valeur.allergyRequest || ''}
            onChange={(e) => maj({ allergyRequest: e.target.value })} placeholder={t('conformite.allergyPlaceholder')} />
        </div>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.allergyHow')}</p>
        {telephone && <p className="small" style={{ margin: '4px 0 0' }}>{t('conformite.allergyCallFirst', { phone: telephone })}</p>}
      </details>

      {ageRequis && (
        <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!valeur.ageDeclaration} onChange={(e) => maj({ ageDeclaration: e.target.checked })} />
          <span className="small">{t('conformite.ageDeclaration', { age: ageRequis })}</span>
        </label>
      )}

      {valeur.termsNeeded && (
        <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={!!valeur.acceptTerms} onChange={(e) => maj({ acceptTerms: e.target.checked })} />
          <span className="small">
            {t('conformite.termsAcceptPrefix')} <Link to="/cgv" target="_blank" rel="noopener">{t('conformite.termsLink')}</Link>{valeur.termsVersion ? ` (${valeur.termsVersion})` : ''}.
          </span>
        </label>
      )}

      <details style={{ marginBottom: 8 }}>
        <summary className="small" style={{ cursor: 'pointer' }}>{t('conformite.feesHowTitle')}</summary>
        <p className="small" style={{ margin: '6px 0 0' }}>{t('conformite.feesHowBody')}</p>
      </details>
      <p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>
        {t('conformite.noWithdrawal')} <Link to="/cgv">{t('conformite.cancellationLink')}</Link>
      </p>
    </div>
  );
}
