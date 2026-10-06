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
//   1. (Fait) Web Push + son à la réception d'une nouvelle commande (NewOrderAlertBar, usePushNotifications)
//   2. (Fait le 2026-10-02) Temps de préparation en plus à l'acceptation (+10/+20/+30 min, OrdersPage → PATCH /accept
//      { extraMinutes }) ; motif obligatoire au refus (PATCH /orders/:id/refuse exige `reason`).
//
// Relu contre le code le 2026-10-06 (plan de test ACT-12) : le texte disait encore « pas de notification », « pas de
// champ allergie », « pas de délai d'annulation » et « tu modifies ton menu toi-même » — quatre choses devenues fausses
// (alarme + Web Push dans NewOrderAlertBar, demande d'allergie à confirmer, annulation après DELAI_ACCEPTATION_MIN = 15
// et rappel à 5 min dans acceptation.js côté backend, carte verrouillée MENU_LOCKED depuis le 2026-10-01). Section 11
// ajoutée : pause et interrupteur (InterrupteurService), Commandes et capacité (EcranCapacite), livreur qui attend,
// contrôle d'âge, client pas venu. Si l'un de ces délais change côté backend, ce texte change avec.
//   3. (Fait) Impression du ticket depuis la fiche commande (escposTicket.js, bluetoothPrinter.js)
//   4. Envoi du bon de commande par WhatsApp
//   5. (Fait) Délai d'acceptation automatique avec annulation si dépassé (acceptation.js côté backend)

// Chaque section : un titre, puis des blocs dans l'ordre — 'p' paragraphe, 'ul' liste, 'faq' couple
// question/réponse séparé d'un filet. Les clés sont dérivées du numéro de section.
const SECTIONS = [
  { n: 1, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 2, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['ul', ['l1', 'l2', 'l3']], ['p', 'p4']] },
  { n: 3, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 4, accent: true, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3']] },
  { n: 5, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['ul', ['l1', 'l2']]] },
  { n: 6, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['p', 'p4'], ['p', 'p5']] },
  // Ajoutée après coup : sa clé reste « s11 » (ne pas renuméroter les clés des trois langues), elle s'affiche en 7e.
  { n: 11, blocs: [['p', 'p1'], ['p', 'p2'], ['p', 'p3'], ['p', 'p4'], ['p', 'p5']] },
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

      {SECTIONS.map((s, rang) => (
        <section key={s.n} className="card" style={s.accent ? { borderLeft: '3px solid var(--iris)' } : undefined}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{rang + 1}. {t(`guide.s${s.n}Title`)}</h3>
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
