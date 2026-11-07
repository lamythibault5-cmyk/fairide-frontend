import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

/* LES TEXTES À SIGNER, numérotés : contrat de partenariat, procédure allergènes, déclaration de vendeur professionnel. Chacun
 * en une ligne qui dit ce qu'il engage, le texte entier à un toucher. Sortie telle quelle de « Tes engagements »
 * (EngagementsPage.jsx) le 2026-11-07 pour servir aussi au lien « C'est bon » (ValiderCarte.jsx ; fondateur, maquettes/un-seul-lien,
 * version A : la carte et les engagements signés sur la même page, sans connexion). Les deux pages montrent ainsi les mêmes
 * textes ; la case, le nom et le bouton restent à chaque page.
 *
 * `aSigner` : les clés à montrer, dans l'ordre ('contrat', 'allergenes', 'pro'). `contrat` : la forme de GET
 * /restaurants/:id/contract ; `conf` : celle de GET /restaurants/:id/compliance (le lien renvoie les mêmes morceaux).
 * `champsAllergenes` : les champs du numéro allergènes, tenus par la page. `onPdf` : ouvre le PDF du contrat (page connectée
 * seulement ; le lien montre le texte entier, sans PDF). */
export default function ListeEngagements({ aSigner, contrat, conf, champsAllergenes = null, onPdf = null }) {
  const { t, language } = useLanguage();
  const [ouvert, setOuvert] = useState(null);
  const traduit = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || null;
  const pro = conf?.professional;
  const s = contrat?.summary;
  const textes = {
    contrat: {
      icone: 'contrat', titre: t('engagementsCommerce.contrat'),
      resume: s ? t('engagementsCommerce.contratResume', { pct: s.commissionPct }) : '',
      note: contrat?.acceptedVersion && contrat.acceptedVersion !== contrat.version ? t('engagementsCommerce.contratNouveau', { version: contrat.version }) : '',
      lire: (
        <>
          {Array.isArray(contrat?.changes) && contrat.changes.length > 0 && contrat.acceptedVersion !== contrat.version && (
            <ul className="small">{contrat.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
          <ol className="resto-contract-clauses">{(contrat?.clauses || []).map((c) => <li key={c.titre}><b>{c.titre}.</b> {c.corps}</li>)}</ol>
          {onPdf && (
            <button type="button" className="ec-lien" onClick={onPdf}>
              <Icone nom="document" taille={15} className="icone-texte" />{' '}{t('engagementsCommerce.pdf')}
            </button>
          )}
        </>
      )
    },
    allergenes: {
      icone: 'alerte', titre: t('conformite.allergenAttestTitle'), resume: t('engagementsCommerce.allergenesResume'),
      lire: <ul className="small">{(traduit(conf?.allergens?.attestation) || conf?.allergens?.attestation?.text || []).map((l) => <li key={l}>{l}</li>)}</ul>,
      champs: champsAllergenes
    },
    pro: {
      icone: 'bouclier', titre: t('conformite.proTitle'), resume: t('engagementsCommerce.proResume'),
      note: pro?.declaredAt ? t('conformite.proNewVersion') : '',
      lire: <ul className="small">{(traduit(pro) || pro?.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
    }
  };
  return (
    <ol className="eg-liste">
      {aSigner.map((cle, k) => {
        const x = textes[cle];
        return (
          <li key={cle} className="eg-texte">
            <span className="eg-numero" aria-hidden="true">{k + 1}</span>
            <div className="eg-corps">
              <b className="eg-titre"><Icone nom={x.icone} taille={16} className="icone-texte" />{' '}{x.titre}</b>
              {x.note && <p className="small eg-note">{x.note}</p>}
              <p className="small eg-resume">{x.resume}</p>
              <button type="button" className="ec-lien" aria-expanded={ouvert === cle} onClick={() => setOuvert(ouvert === cle ? null : cle)}>
                {ouvert === cle ? t('engagementsCommerce.replier') : t('engagementsCommerce.lire')}
              </button>
              {ouvert === cle && <div className="eg-lire">{x.lire}</div>}
              {x.champs}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
