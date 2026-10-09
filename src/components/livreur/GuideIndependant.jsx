import { useLanguage } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';

/* « Devenir (étudiant-)indépendant en 3 étapes » (CODE-16, DEC-21, 8 octobre 2026), dans l'inscription livreur.
 *
 * Beaucoup de livreurs potentiels ne savent pas comment devenir indépendants. Fairide INFORME — elle ne fait pas les
 * démarches à leur place (ce serait organiser leur activité) : trois étapes, les chiffres de l'année tirés de la
 * configuration fiscale (fiscal_config, jamais écrits ici), et les sites officiels. Les liens pointent vers la page
 * d'accueil de chaque organisme, plus stable qu'une adresse profonde qui change à chaque refonte de leur site. */
const LIENS = {
  bce: 'https://economie.fgov.be',
  inasti: 'https://www.inasti.be',
  tva: 'https://finances.belgium.be',
  famiris: 'https://famiris.brussels'
};

export default function GuideIndependant({ legal = {} }) {
  const { t } = useLanguage();
  const montant = (v) => (v == null || v === '' ? '—' : euros(Number(v)));
  return (
    <details className="card" style={{ marginBottom: 12 }}>
      <summary><b>{t('guideIndependant.title')}</b></summary>
      <p className="small" style={{ margin: '8px 0' }}>{t('guideIndependant.intro')}</p>
      <ol className="paiement-etapes">
        <li>
          <b>{t('guideIndependant.step1Title')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('guideIndependant.step1')} <a href={LIENS.bce} target="_blank" rel="noopener noreferrer">economie.fgov.be</a></p>
        </li>
        <li>
          <b>{t('guideIndependant.step2Title')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('guideIndependant.step2', { exemption: montant(legal.studentIndependentExemption) })} <a href={LIENS.inasti} target="_blank" rel="noopener noreferrer">inasti.be</a></p>
        </li>
        <li>
          <b>{t('guideIndependant.step3Title')}</b>
          <p className="small" style={{ margin: '2px 0 0' }}>{t('guideIndependant.step3', { max: montant(legal.franchiseMaxTurnover) })} <a href={LIENS.tva} target="_blank" rel="noopener noreferrer">finances.belgium.be</a></p>
        </li>
      </ol>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('guideIndependant.family', { ceiling: montant(legal.studentParentsCeiling) })} <a href={LIENS.famiris} target="_blank" rel="noopener noreferrer">famiris.brussels</a></p>
      <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{t('guideIndependant.disclaimer')}</p>
    </details>
  );
}
