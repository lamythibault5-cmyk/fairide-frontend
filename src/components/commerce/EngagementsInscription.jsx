import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';

/* LA CASE DES ENGAGEMENTS, À L'INSCRIPTION (fondateur, 12 oct. 2026 : « que des cases à cocher à l'inscription, et tout
 * est fait »). Une seule case, sous les deux textes que le commerce signe : la déclaration professionnelle (vendeur,
 * produits conformes à la loi, enregistrement AFSCA, autorisations, assurances) et la procédure allergènes. Plus de
 * numéro AFSCA ni de pièce à fournir : Fairide se fie à cette déclaration, et contrôle par sondage.
 *
 * Les textes viennent du serveur (GET /restaurants/engagements) : ce sont exactement ceux qui sont hachés à la
 * signature (routes/restaurants.js, signerEngagementsInscription). Le français fait foi ; en anglais et en néerlandais
 * on montre la traduction. Si le serveur ne répond pas, la case reste cochable avec le résumé — rien n'est signé sans
 * réponse du serveur de toute façon, et le panneau « Ma carte et mes engagements » rattrapera ce qui manque. */
export default function EngagementsInscription({ checked, onChange, error }) {
  const { t, language } = useLanguage();
  const [textes, setTextes] = useState(null);
  useEffect(() => { api('/restaurants/engagements').then(setTextes).catch(() => setTextes(null)); }, []);
  const lignes = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || bloc?.text || [];

  return (
    <div style={{ margin: '4px 0 12px' }}>
      <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 'auto', marginTop: 3 }} checked={checked} onChange={(e) => onChange(e.target.checked)} aria-invalid={error ? true : undefined} />
        <span className="small">{t('auth.engagementsCheck')}</span>
      </label>
      {textes && (
        <details className="small" style={{ margin: '6px 0 0 26px' }}>
          <summary>{t('auth.engagementsRead')}</summary>
          <p style={{ margin: '6px 0 2px', fontWeight: 600 }}>{t('conformite.proTitle')}</p>
          <ul style={{ margin: '0 0 6px 18px' }}>{lignes(textes.professional).map((l) => <li key={l}>{l}</li>)}</ul>
          <p style={{ margin: '6px 0 2px', fontWeight: 600 }}>{t('conformite.allergenAttestTitle')}</p>
          <ul style={{ margin: '0 0 6px 18px' }}>{lignes(textes.allergens).map((l) => <li key={l}>{l}</li>)}</ul>
          {language !== 'fr' && <p style={{ margin: 0, opacity: 0.8 }}>{t('conformite.frenchPrevails')}</p>}
        </details>
      )}
      {error && <p className="small" style={{ color: 'var(--red)', margin: '4px 0 0 26px' }}>{error}</p>}
    </div>
  );
}
