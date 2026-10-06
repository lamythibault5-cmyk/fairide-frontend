import usePageMeta from '../../hooks/usePageMeta';
import Rich from '../../components/Rich';
import { useLanguage } from '../../context/LanguageContext';

/* Accessibilité (décision DEC-10 du fondateur, 6 oct. 2026, plan de test LEG-15).
 *
 * Fairide se considère exemptée de la déclaration d'accessibilité de l'Acte européen sur l'accessibilité (directive (UE)
 * 2019/882, art. 4 § 5 : microentreprises qui fournissent des services) — à confirmer par l'avocat. La page existe quand
 * même : elle dit ce que nous visons, ce que nous savons ne pas encore faire, et comment nous joindre.
 *
 * CE QUE LA PAGE AFFIRME, vérifié le 6 oct. 2026 :
 *   - aucun audit d'accessibilité n'a été fait ;
 *   - des formulaires n'associent pas encore chaque étiquette à son champ (CLAUDE.md, « Known gaps » 4) ;
 *   - les cartes (Leaflet, src/carte.js) sont formulées comme « peuvent être difficiles » : non mesuré.
 * Si l'un de ces points change (audit fait, formulaires corrigés), cette page change avec. */
const SECTIONS = ['aim', 'state', 'limits', 'contact', 'legal'];

export default function AccessibilityPage() {
  const { t } = useLanguage();
  usePageMeta({ title: t('accessibilite.pageTitle'), description: t('accessibilite.pageDescription'), path: '/accessibilite' });
  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>{t('accessibilite.title')}</h2>
      {SECTIONS.map((s) => (
        <div key={s}>
          <h3>{t(`accessibilite.${s}Title`)}</h3>
          <p className="small" style={{ whiteSpace: 'pre-line' }}><Rich text={t(`accessibilite.${s}`)} /></p>
        </div>
      ))}
      <p className="small" style={{ opacity: 0.7, marginBottom: 0 }}>{t('accessibilite.updated')}</p>
    </div>
  );
}
