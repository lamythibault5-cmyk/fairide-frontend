import { useLanguage, getLocale } from '../context/LanguageContext';

// Le terminal Fairide, expliqué clairement (fondateur, 2026-09-21) : une image de ce que c'est, comment ça marche en
// quatre étapes, et les conditions — offert aux 50 premiers restaurants qui créent leur compte AVANT le 5 octobre 2026,
// ensuite caution de 80 € rendue au départ de Fairide si le terminal fonctionne toujours. Utilisé à l'inscription
// (OffreFormules, sans état) et dans Mon compte (rangée « Mon terminal Fairide », avec l'état tenu par l'admin).
// `terminal` : l'objet `restaurant.terminal` du serveur (formules.etatTerminal), ou null avant inscription.
const OFFRE_JUSQUAU_DEFAUT = Date.UTC(2026, 9, 4, 22); // 5 octobre 2026, minuit à Bruxelles (voir formules.js)
const OFFRE_PREMIERS = 50;
const CAUTION = 80;

function Illustration({ t }) {
  // Une tablette sur son support, l'écran de commandes Fairide, et l'imprimante à tickets à côté.
  return (
    <svg className="terminal-illu" viewBox="0 0 320 200" role="img" aria-label={t('accountUi.terminalIllustrationAlt')}>
      <defs>
        <linearGradient id="term-ecran" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFDF7" /><stop offset="1" stopColor="#F3EFE4" /></linearGradient>
      </defs>
      {/* support */}
      <path d="M92 168 L128 168 L140 150 L80 150 Z" fill="#2B2B2B" opacity=".85" />
      <rect x="60" y="168" width="100" height="8" rx="4" fill="#2B2B2B" opacity=".85" />
      {/* tablette */}
      <rect x="22" y="22" width="176" height="130" rx="12" fill="#1F1F24" />
      <rect x="30" y="30" width="160" height="114" rx="8" fill="url(#term-ecran)" />
      {/* barre Fairide */}
      <rect x="30" y="30" width="160" height="18" rx="8" fill="#4B3BD6" />
      <rect x="30" y="40" width="160" height="8" fill="#4B3BD6" />
      <circle cx="42" cy="39" r="4.5" fill="#C6F06B" />
      <text x="50" y="43" fontSize="9" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">Fairide</text>
      {/* commande en cours */}
      <rect x="36" y="54" width="148" height="30" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="42" y="66" fontSize="8" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🛵 {t('accountUi.terminalScreenOrder')}</text>
      <text x="42" y="77" fontSize="7" fill="#666" fontFamily="system-ui, sans-serif">2 × Dürüm poulet · 1 × Frites · 24,50 €</text>
      <rect x="128" y="59" width="50" height="18" rx="9" fill="#C6F06B" />
      <text x="153" y="71" fontSize="7.5" fontWeight="700" fill="#1F1F24" textAnchor="middle" fontFamily="system-ui, sans-serif">{t('accountUi.terminalScreenAccept')}</text>
      {/* réservation */}
      <rect x="36" y="90" width="148" height="24" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="42" y="101" fontSize="8" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🍽️ {t('accountUi.terminalScreenBooking')}</text>
      <text x="42" y="110" fontSize="7" fill="#666" fontFamily="system-ui, sans-serif">19:30 · 4 pers.</text>
      {/* à emporter */}
      <rect x="36" y="120" width="148" height="18" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="42" y="132" fontSize="8" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🥡 {t('accountUi.terminalScreenPickup')}</text>
      <text x="178" y="132" fontSize="7" fill="#666" textAnchor="end" fontFamily="system-ui, sans-serif">12 min</text>
      {/* imprimante */}
      <rect x="218" y="96" width="84" height="56" rx="10" fill="#2B2B2B" />
      <rect x="226" y="104" width="68" height="8" rx="4" fill="#111" />
      <rect x="230" y="88" width="60" height="10" rx="2" fill="#F5F1E6" />
      {/* ticket */}
      <path d="M234 88 L286 88 L286 40 L234 40 Z" fill="#fff" stroke="#E6E2D6" />
      <path d="M234 40 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5 l6 -5 l6 5" fill="#fff" stroke="#E6E2D6" />
      <rect x="240" y="48" width="40" height="3" rx="1.5" fill="#4B3BD6" />
      <rect x="240" y="56" width="32" height="2.5" rx="1" fill="#BBB" />
      <rect x="240" y="62" width="38" height="2.5" rx="1" fill="#BBB" />
      <rect x="240" y="68" width="26" height="2.5" rx="1" fill="#BBB" />
      <rect x="240" y="76" width="40" height="3" rx="1.5" fill="#1F1F24" />
      <text x="260" y="168" fontSize="8" fill="#444" textAnchor="middle" fontFamily="system-ui, sans-serif">{t('accountUi.terminalScreenTicket')}</text>
      {/* signal sonore */}
      <path d="M204 60 q10 10 0 20" fill="none" stroke="#F5B800" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M210 52 q18 18 0 36" fill="none" stroke="#F5B800" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
    </svg>
  );
}

export default function TerminalFairide({ terminal = null, compact = false }) {
  const { t } = useLanguage();
  const locale = getLocale();
  const fmt = (ms) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const jusquau = terminal?.offerUntil || OFFRE_JUSQUAU_DEFAUT;
  const offreOuverte = terminal ? terminal.offerOpen !== false && Date.now() < jusquau : Date.now() < jusquau;
  const caution = Number(terminal?.depositAmount || CAUTION).toFixed(0);
  const premiers = terminal?.offerRank || OFFRE_PREMIERS;
  // Trois cas : compte déjà inscrit et éligible (offert) ; compte inscrit hors offre (caution) ; pas encore de compte
  // (l'offre est ouverte jusqu'à la date, ou fermée).
  let condition; let tonalite = 'terminal-cond-offert';
  if (terminal?.eligibleOffert) condition = t('accountUi.terminalCondEligible', { n: premiers, date: fmt(jusquau) });
  else if (terminal?.signupRank) { condition = t('accountUi.terminalCondDeposit', { amount: caution }); tonalite = 'terminal-cond-caution'; }
  else if (offreOuverte) condition = t('accountUi.terminalCondOpen', { n: premiers, date: fmt(jusquau), amount: caution });
  else { condition = t('accountUi.terminalCondClosed', { amount: caution }); tonalite = 'terminal-cond-caution'; }

  return (
    <div className={`terminal-fairide${compact ? ' terminal-compact' : ''}`}>
      <div className="terminal-haut">
        <Illustration t={t} />
        <div>
          <b className="terminal-titre">🖥️ {t('accountUi.offre_terminalTitle')}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.terminalWhat')}</p>
        </div>
      </div>
      <b className="small" style={{ display: 'block', marginTop: 10 }}>{t('accountUi.terminalHowTitle')}</b>
      <ol className="terminal-etapes small">
        <li>{t('accountUi.terminalStep1')}</li>
        <li>{t('accountUi.terminalStep2')}</li>
        <li>{t('accountUi.terminalStep3')}</li>
        <li>{t('accountUi.terminalStep4')}</li>
      </ol>
      <div className={`terminal-conditions ${tonalite}`}>
        <p className="small" style={{ margin: 0 }}><b>{condition}</b></p>
        <p className="small" style={{ margin: '4px 0 0' }}>{t('accountUi.terminalDepositRule', { amount: caution })}</p>
        <p className="small" style={{ margin: '4px 0 0', opacity: .85 }}>{t('accountUi.terminalFreeVersion')}</p>
      </div>
      {terminal && (terminal.deliveredAt || terminal.returnedAt || terminal.refundedAt) && (
        <p className="small" style={{ margin: '8px 0 0' }}>
          {terminal.deliveredAt && <>📦 {t('accountUi.terminalDelivered', { date: new Date(terminal.deliveredAt).toLocaleDateString(locale) })}<br /></>}
          {terminal.returnedAt && <>↩️ {t('accountUi.terminalReturned', { date: new Date(terminal.returnedAt).toLocaleDateString(locale) })}<br /></>}
          {terminal.refundedAt && <>💶 {t('accountUi.terminalRefunded', { date: new Date(terminal.refundedAt).toLocaleDateString(locale) })}</>}
        </p>
      )}
      {!compact && <p className="small" style={{ margin: '8px 0 0' }}>{t('accountUi.terminalHow')}</p>}
    </div>
  );
}
