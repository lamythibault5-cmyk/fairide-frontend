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
  // Le terminal tout-en-un tel qu'il existe chez les grandes plateformes : un appareil à écran tactile avec
  // l'imprimante à tickets intégrée en haut. L'app Fairide est à l'écran : une commande, un bouton Accepter.
  return (
    <svg className="terminal-illu" viewBox="0 0 320 200" role="img" aria-label={t('accountUi.terminalIllustrationAlt')}>
      <defs>
        <linearGradient id="term-ecran" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFDF7" /><stop offset="1" stopColor="#F3EFE4" /></linearGradient>
        <linearGradient id="term-corps" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2E2E36" /><stop offset="1" stopColor="#15151A" /></linearGradient>
      </defs>
      {/* ticket qui sort de l'imprimante intégrée */}
      <path d="M118 14 L202 14 L202 52 L118 52 Z" fill="#fff" stroke="#E6E2D6" />
      <path d="M118 14 l7 -5 l7 5 l7 -5 l7 5 l7 -5 l7 5 l7 -5 l7 5 l7 -5 l7 5 l7 -5 l7 5" fill="#fff" stroke="#E6E2D6" />
      <rect x="126" y="24" width="40" height="3" rx="1.5" fill="#4B3BD6" />
      <rect x="126" y="32" width="60" height="2.5" rx="1" fill="#BBB" />
      <rect x="126" y="38" width="48" height="2.5" rx="1" fill="#BBB" />
      <rect x="126" y="44" width="30" height="2.5" rx="1" fill="#BBB" />
      {/* corps du terminal (tout-en-un) */}
      <rect x="96" y="48" width="128" height="146" rx="16" fill="url(#term-corps)" />
      <rect x="108" y="50" width="104" height="10" rx="3" fill="#0B0B0E" />
      <rect x="112" y="53" width="96" height="3" rx="1.5" fill="#3A3A44" />
      {/* écran */}
      <rect x="106" y="66" width="108" height="118" rx="8" fill="url(#term-ecran)" />
      <rect x="106" y="66" width="108" height="16" rx="8" fill="#4B3BD6" />
      <rect x="106" y="74" width="108" height="8" fill="#4B3BD6" />
      <circle cx="116" cy="74" r="4" fill="#C6F06B" />
      <text x="123" y="77.5" fontSize="8" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">Fairide</text>
      <text x="208" y="77.5" fontSize="7" fill="#fff" textAnchor="end" fontFamily="system-ui, sans-serif">11:23</text>
      <rect x="111" y="88" width="98" height="40" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="116" y="99" fontSize="7.5" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🛵 {t('accountUi.terminalScreenOrder')}</text>
      <text x="116" y="109" fontSize="6.5" fill="#666" fontFamily="system-ui, sans-serif">2 × Dürüm poulet</text>
      <text x="116" y="117" fontSize="6.5" fill="#666" fontFamily="system-ui, sans-serif">1 × Frites · 24,50 €</text>
      <rect x="160" y="105" width="44" height="16" rx="8" fill="#C6F06B" />
      <text x="182" y="116" fontSize="7" fontWeight="700" fill="#1F1F24" textAnchor="middle" fontFamily="system-ui, sans-serif">{t('accountUi.terminalScreenAccept')}</text>
      <rect x="111" y="133" width="98" height="20" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="116" y="146" fontSize="7.5" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🍽️ {t('accountUi.terminalScreenBooking')}</text>
      <text x="204" y="146" fontSize="6.5" fill="#666" textAnchor="end" fontFamily="system-ui, sans-serif">19:30 · 4</text>
      <rect x="111" y="158" width="98" height="20" rx="6" fill="#fff" stroke="#E6E2D6" />
      <text x="116" y="171" fontSize="7.5" fontWeight="700" fill="#1F1F24" fontFamily="system-ui, sans-serif">🥡 {t('accountUi.terminalScreenPickup')}</text>
      <text x="204" y="171" fontSize="6.5" fill="#666" textAnchor="end" fontFamily="system-ui, sans-serif">12 min</text>
      {/* signal sonore */}
      <path d="M236 96 q10 12 0 24" fill="none" stroke="#F5B800" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M244 86 q18 22 0 44" fill="none" stroke="#F5B800" strokeWidth="2.5" strokeLinecap="round" opacity=".6" />
      {/* légendes */}
      <text x="60" y="34" fontSize="8" fill="#444" textAnchor="middle" fontFamily="system-ui, sans-serif">{t('accountUi.terminalScreenTicket')}</text>
      <path d="M84 36 L114 30" fill="none" stroke="#444" strokeWidth="1" strokeDasharray="2 2" />
      <text x="272" y="150" fontSize="8" fill="#444" textAnchor="middle" fontFamily="system-ui, sans-serif">{t('accountUi.terminalLegendScreen')}</text>
      <path d="M258 146 L218 130" fill="none" stroke="#444" strokeWidth="1" strokeDasharray="2 2" />
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
          <p className="small" style={{ margin: '4px 0 0' }}><b>{t('accountUi.terminalSameAs')}</b></p>
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
