import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import TwoFactorSetup from '../TwoFactorSetup';
import Icone from '../Icone';

/* LA DOUBLE AUTHENTIFICATION POUR TOUTE L'ÉQUIPE (audit du 19/10, admin-14).
 *
 * Elle ne s'activait que dans Réglages › Sécurité, que seuls les rôles propriétaire et admin ouvrent : un membre support,
 * ops ou finance n'avait aucun moyen de la mettre, et personne n'était prévenu (`totpRecommended`, envoyé par le serveur
 * dans publicUser, n'était lu nulle part). Sur « Aujourd'hui », que tous les rôles ouvrent, cette carte la rappelle tant
 * qu'elle manque, et l'active sur place (TwoFactorSetup, routes /auth/totp/*, ouvertes à tout compte connecté).
 * Elle reste ouverte une fois l'activation lancée, même quand le compte n'est plus « à rappeler » : les codes de secours
 * s'affichent à la fin, une seule fois, et ne doivent pas disparaître avec la carte. */
export default function RappelDoubleAuth() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [ouvert, setOuvert] = useState(false);
  if (!user?.totpRecommended && !ouvert) return null;
  return (
    <section className="card" style={{ margin: '0 0 16px' }} aria-labelledby="rappel-2fa-titre">
      <h3 id="rappel-2fa-titre" style={{ margin: '0 0 6px' }}><Icone nom="cadenas" taille={18} className="icone-texte" />{' '}{t('adminHome.twofaTitle')}</h3>
      {!ouvert ? (
        <>
          <p className="small" style={{ margin: '0 0 10px' }}>{t('adminHome.twofaText')}</p>
          <button type="button" className="btn-gold" onClick={() => setOuvert(true)}>{t('adminHome.twofaBtn')}</button>
        </>
      ) : <TwoFactorSetup />}
    </section>
  );
}
