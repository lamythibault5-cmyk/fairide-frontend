import { useEffect, useState } from 'react';
import EcranPlein from './EcranPlein';
import Icone from './Icone';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { apercuTheme, definirTheme } from '../theme';
import '../ecran-apparence.css';

/* CLAIR OU SOMBRE, À L'ARRIVÉE (fondateur, 2026-10-23, version B de maquettes/choix-apparence/choix-apparence.html).
 *
 * Un écran plein, une seule fois, à qui n'a pas encore choisi (theme.js, themeChoisi) quand il arrive sur SON accueil dans
 * l'app : le client qui vient de créer son compte (l'inscription mène à l'accueil), un compte existant à sa première
 * ouverture de l'app mise à jour, le livreur sur ses Courses, le commerce sur ses Commandes (Layout.jsx, ACCUEILS).
 *
 * « Comme mon téléphone » est coché d'entrée : c'est ce qui s'applique si l'on continue sans toucher. Toucher un choix le
 * montre tout de suite à tout l'écran (apercuTheme) ; rien n'est enregistré avant « Continuer ». Les deux aperçus sont
 * l'accueil dessiné en petit dans les deux couleurs (pas une capture : elle vieillirait, et chaque profil a son accueil) ;
 * décoratifs (aria-hidden), le libellé du bouton dit le choix. */
export default function ChoixApparenceArrivee() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [choix, setChoix] = useState('auto');
  const [fini, setFini] = useState(false);
  useEffect(() => { apercuTheme(choix); }, [choix]);
  // Quitté sans « Continuer » (déconnexion, autre écran) : l'aperçu ne reste pas.
  useEffect(() => () => apercuTheme(null), []);
  if (fini) return null;

  const continuer = () => { definirTheme(choix); setFini(true); };
  const option = (c) => ({ role: 'radio', 'aria-checked': choix === c, onClick: () => setChoix(c) });
  return (
    <EcranPlein etiquette={t('account.appearanceArrivee_titre')}>
      <div className="bv-ecran ap-ecran">
        <p className="ap-bonjour">{user?.firstName ? t('account.appearanceArrivee_bonjour', { prenom: user.firstName }) : t('account.appearanceArrivee_bonjourSansNom')}</p>
        <h1 className="bv-titre">{t('account.appearanceArrivee_titre')}</h1>
        <p className="bv-sous">{t('account.appearanceArrivee_sous')}</p>
        <div role="radiogroup" aria-label={t('account.appearance')}>
          <div className="ap-minis">
            {['clair', 'sombre'].map((c) => (
              <button key={c} type="button" className={`ap-choix${choix === c ? ' on' : ''}`} {...option(c)}>
                <MiniAccueil theme={c} />
                <span className="ap-etiquette">{t(`account.appearance_${c}`)}</span>
              </button>
            ))}
          </div>
          <button type="button" className={`bv-option${choix === 'auto' ? ' on' : ''}`} {...option('auto')}>
            <span className="bv-tuile"><Icone nom="mobile" taille={20} /></span>
            <span>{t('account.appearance_auto')}<small>{t('account.appearance_autoSub')}</small></span>
          </button>
        </div>
        <div className="bv-grandit" />
        <button type="button" className="btn-gold bv-btn" onClick={continuer}>{t('account.appearanceArrivee_continuer')}</button>
        <p className="ap-plus-tard">{t('account.appearanceArrivee_plusTard')}</p>
      </div>
    </EcranPlein>
  );
}

// L'accueil en petit : la bande et son vélo, la bande des cuisines, une carte « à la une », deux cartes, les onglets.
function MiniAccueil({ theme }) {
  return (
    <span className={`ap-mini ap-mini--${theme}`} aria-hidden="true">
      <span className="ap-mini-bande">
        <svg viewBox="-3 5 82 42" className="ap-mini-velo"><g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g><g fill="currentColor"><rect x="16" y="7" width="44" height="6" rx="3" /><g transform="rotate(42 27 22.5)"><rect x="13" y="19.5" width="28" height="6" rx="3" /></g></g></svg>
        <i className="ap-mini-route" />
      </span>
      <span className="ap-mini-feuille">
        <span className="ap-mini-puces"><i /><i /><i /><i /><i /></span>
        <span className="ap-mini-une" />
        <span className="ap-mini-cartes">
          <span className="ap-mini-carte"><i className="ap-mini-photo" /><i className="ap-mini-ligne" /><i className="ap-mini-ligne ap-mini-ligne--court" /></span>
          <span className="ap-mini-carte"><i className="ap-mini-photo ap-mini-photo--2" /><i className="ap-mini-ligne" /><i className="ap-mini-ligne ap-mini-ligne--court" /></span>
        </span>
      </span>
      <span className="ap-mini-onglets"><i className="on" /><i /><i /><i /><i /></span>
    </span>
  );
}
