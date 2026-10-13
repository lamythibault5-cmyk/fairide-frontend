import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

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
  useEffect(() => {
    api('/restaurants/engagements').then(setTextes).catch(() => setTextes(null));
    api('/restaurants/contract-terms').then(setContrat).catch(() => setContrat(null));
  }, []);
  const lignes = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || bloc?.text || [];

  return (
    <div className="engagements-inscription">
      <label className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
