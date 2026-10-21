import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import ErrorCard from '../ErrorCard';

/* LA CASE UNIQUE DE L'INSCRIPTION (fondateur, 12 oct. 2026 : « que des cases à cocher à l'inscription, et tout est
 * fait »). Une seule case signe trois textes : le contrat de partenariat, la déclaration professionnelle (vendeur,
 * produits conformes, AFSCA, autorisations, assurances, âge pour l'alcool) et la procédure allergènes. Plus de numéro
 * AFSCA, plus de pièce, plus de signature dessinée : Fairide se fie à cette déclaration et contrôle par sondage.
 *
 * Les textes viennent du serveur (GET /restaurants/engagements et /restaurants/contract-terms) : ce sont exactement
 * ceux qui sont hachés à la signature (routes/restaurants.js, signerEngagementsInscription). Ils sont repliés, à un
 * geste — les montrer avant la case suffit à un consentement éclairé ; les faire dérouler de force n'ajoutait rien.
 * Le français fait foi ; en anglais et en néerlandais on montre la traduction quand elle existe. */
export default function EngagementsInscription({ checked, onChange }) {
  const { t, language } = useLanguage();
  const [textes, setTextes] = useState(null);
  const [contrat, setContrat] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);
  useEffect(() => {
    setErreur(false);
    api('/restaurants/engagements').then(setTextes).catch(() => setErreur(true));
    api('/restaurants/contract-terms').then(setContrat).catch(() => setErreur(true));
  }, [essai]);
  const lignes = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || bloc?.text || [];
  // La case signe le contrat ET les engagements : elle reste grisée tant que les deux textes ne sont pas arrivés.
  // Avant, un réseau lent ou en panne cachait les deux « Lire… » et laissait cocher un contrat que la personne ne pouvait
  // pas ouvrir (audit du 19/10, shop-3). Même texte signé, même case unique.
  const prets = Boolean(textes && contrat);
  useEffect(() => { if (!prets && checked) onChange(false); }, [prets, checked, onChange]);

  return (
    <div className="engagements-inscription">
      {erreur && !prets && (
        <ErrorCard titre={t('auth.engagementsLoadError')} onRetry={() => setEssai((n) => n + 1)} />
      )}
      <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: prets ? 'pointer' : 'default', opacity: prets ? 1 : 0.6 }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={checked && prets} disabled={!prets} onChange={(e) => onChange(e.target.checked)} />
        <span className="small">{t('auth.engagementsCheck')}</span>
      </label>
      <div className="engagements-liens small">
        {contrat && (
          <details>
            <summary>{t('auth.engagementsContract')}</summary>
            {contrat.clauses.map((c) => (
              <p key={`${c.partie}-${c.titre}`} style={{ margin: '6px 0' }}><b>{c.titre}.</b> {c.corps}</p>
            ))}
            <p style={{ margin: '6px 0 0', opacity: 0.8 }}>{contrat.version}</p>
            {/* Les clauses ne sont qu'en français : le dire aussi ici, pas seulement sous les engagements (shop-3). */}
            {language !== 'fr' && <p style={{ margin: '6px 0 0', opacity: 0.8 }}>{t('conformite.frenchPrevails')}</p>}
          </details>
        )}
        {textes && (
          <details>
            <summary>{t('auth.engagementsRead')}</summary>
            <p style={{ margin: '6px 0 2px', fontWeight: 600 }}>{t('conformite.proTitle')}</p>
            <ul style={{ margin: '0 0 6px 18px' }}>{lignes(textes.professional).map((l) => <li key={l}>{l}</li>)}</ul>
            <p style={{ margin: '6px 0 2px', fontWeight: 600 }}>{t('conformite.allergenAttestTitle')}</p>
            <ul style={{ margin: '0 0 6px 18px' }}>{lignes(textes.allergens).map((l) => <li key={l}>{l}</li>)}</ul>
            {language !== 'fr' && <p style={{ margin: 0, opacity: 0.8 }}>{t('conformite.frenchPrevails')}</p>}
          </details>
        )}
      </div>
    </div>
  );
}
