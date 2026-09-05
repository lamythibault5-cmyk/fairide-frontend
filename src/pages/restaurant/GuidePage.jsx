import { useLanguage } from '../../context/LanguageContext';
import Rich from '../../components/Rich';

// Mode d'emploi du restaurateur : comment recevoir et traiter les commandes Fairide. Contenu statique
// (pas de données chargées, pas de nouvelle table) qui ne décrit QUE des fonctionnalités réellement
// implémentées à ce jour, vérifiées dans le code avant rédaction (voir orderStatus.jsx, OrdersPage.jsx,
// DashboardLayout.jsx, routes/orders.js et email.js côté backend).
//
// Le texte vit dans translations.js (espace `guide`), en trois langues : la page ne fait que le
// dérouler. Un paragraphe peut porter **gras**, *italique* ou [lien](cible) — voir Rich.jsx.
//
// TODO fonctionnalités absentes aujourd'hui, mentionnées ici pour ne pas les réinventer ni les décrire
// comme existantes dans le mode d'emploi. Ordre de priorité proposé :
//   1. Web Push + son à la réception d'une nouvelle commande
//   2. Choix du temps de préparation à l'acceptation + motif obligatoire au refus
//   3. (Fait) Impression du ticket depuis la fiche commande (escposTicket.js, bluetoothPrinter.js)
//   4. Envoi du bon de commande par WhatsApp
//   5. Délai d'acceptation automatique avec annulation si dépassé

// Chaque section : un titre, puis des blocs dans l'ordre — 'p' paragraphe, 'ul' liste, 'faq' couple
// question/réponse séparé d'un filet. Les clés sont dérivées du numéro de section.
const SECTIONS = [
  { n: 1, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 2, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['ul', ['l1', 'l2', 'l3']], ['p', 'p4']] },
  { n: 3, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 4, accent: true, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 5, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['ul', ['l1', 'l2']]] },
  { n: 6, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['p', 'p4'], ['p', 'p5']] },
  { n: 7, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['p', 'p4']] },
  { n: 8, blocs: [['p', 'p1'], ['p', 'p2']] },
  { n: 9, blocs: [['faq', 'q1'], ['faq', 'q2'], ['faq', 'q3'], ['faq', 'q4']] },
  { n: 10, blocs: [['p', 'p1'], ['p', 'p2']] }
];

export default function GuidePage() {
  const { t } = useLanguage();
  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{t('guide.title')}</h2>
      <p className="small" style={{ margin: '0 0 16px' }}>{t('guide.intro')}</p>

      {SECTIONS.map((s) => (
        <section key={s.n} className="card" style={s.accent ? { borderLeft: '3px solid var(--gold)' } : undefined}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{s.n}. {t(`guide.s${s.n}Title`)}</h3>
          {s.blocs.map(([type, cle], i) => {
            const dernier = i === s.blocs.length - 1;
            if (type === 'ul') {
              return (
                <ul key={i} className="small" style={{ margin: dernier ? 0 : '0 0 8px', paddingLeft: 18 }}>
                  {cle.map((k) => <li key={k}><Rich text={t(`guide.s${s.n}${k}`)} /></li>)}
                </ul>
              );
            }
            if (type === 'faq') {
              return (
                <div key={i}>
                  <div className="divider" />
                  <p className="small" style={{ marginBottom: 2 }}><b>{t(`guide.s${s.n}${cle}`)}</b></p>
                  <p className="small" style={dernier ? { marginBottom: 0 } : undefined}><Rich text={t(`guide.s${s.n}${cle}a`)} /></p>
                </div>
              );
            }
            return <p key={i} className="small" style={dernier ? { marginBottom: 0 } : undefined}><Rich text={t(`guide.s${s.n}${cle}`)} /></p>;
          })}
        </section>
      ))}
    </div>
  );
}
