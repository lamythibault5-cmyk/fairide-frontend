import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { getConsent, setConsent, onConsentChange } from '../consent';

// Bannière de consentement. Refuser doit être aussi simple qu'accepter (RGPD + directive ePrivacy) :
// les deux boutons sont donc côte à côte, de même taille et de même poids visuel — pas un bouton doré
// bien visible face à un lien discret, schéma que l'APD/GBA sanctionne précisément.
// Le choix réel ('accepted' | 'refused') est stocké par consent.js, seule source lue par le reste de
// l'app (aujourd'hui Sentry, voir main.jsx).
export default function CookieBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const boite = useRef(null);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
    // « Gérer mes cookies » remet le choix à zéro : la bannière revient.
    return onConsentChange((v) => { if (!v) setVisible(true); });
  }, []);
  // Au clavier, les deux choix sont atteignables tout de suite, sans traverser toute la page : la carte prend le focus, la
  // première tabulation mène à « Accepter », la suivante à « Refuser ». Le focus allait sur « Accepter » lui-même : posé au
  // chargement, il y dessinait l'anneau — le seul bouton cerné des deux, donc mis en avant. La carte, elle, n'a pas d'anneau.
  useEffect(() => { if (visible) boite.current?.focus({ preventScroll: true }); }, [visible]);

  function choose(value) {
    setConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    /* LA CARTE IRIS (fondateur, 2026-10-16, section 1 de maquettes/site-ordinateur/site-ordinateur.html) : elle était noire, « Accepter »
       en lime et « Refuser » en contour — même taille, mais pas le même poids visuel, ce que l'APD reproche justement aux
       bannières. Les deux choix sont maintenant le MÊME bouton (blanc, texte iris, même graisse), côte à côte, à parts
       égales. Le lien vers la politique des cookies reste. En bas à gauche, à côté de la barre latérale et au-dessus des
       onglets du bas (site-cadre.css, .carte-cookies). role="dialog" et le lien /cookies : la vérification de l'app
       (scripts/verifier-appli.mjs) la reconnaît par eux. */
    <div ref={boite} tabIndex={-1} role="dialog" aria-live="polite" aria-label={t('cookies.text')} className="carte-cookies">
      {/* Une phrase (fondateur, 2026-10-11) ; le texte complet reste l'aria-label et la politique des cookies. */}
      <p className="carte-cookies-texte">{t('cookies.short')}</p>
      <Link to="/cookies" className="carte-cookies-lien">{t('cookies.more')}</Link>
      <div className="carte-cookies-choix">
        <button type="button" onClick={() => choose('accepted')}>{t('cookies.accept')}</button>
        <button type="button" onClick={() => choose('refused')}>{t('cookies.refuse')}</button>
      </div>
    </div>
  );
}
