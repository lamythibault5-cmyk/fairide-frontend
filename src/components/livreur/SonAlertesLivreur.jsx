import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import LigneCompte from '../LigneCompte';
import { CLE_SON, sonActifMemorise } from '../../hooks/useAlerteLivreur';
import { vibrer } from '../../gestes';

/* LE SON DES ALERTES DU LIVREUR, DANS MON COMPTE (app seulement ; deuxième audit design, 2026-10-19). Dans l'app, la carte
 * d'alerte du site (AlerteLivreurBar : « tant que cette page reste ouverte, sinon un e-mail ») a quitté l'écran des courses :
 * les notifications push préviennent, app fermée ou non. Il restait un réglage utile, le son joué quand l'app est ouverte
 * (nouvelle course, course prête, annulée, rappel toutes les 30 s) : il vit ici, dans la même clé que useAlerteLivreur, qui
 * la relit à l'ouverture des Courses. Sur le site, la carte et son bouton restent sur l'écran des courses. */
export default function SonAlertesLivreur() {
  const { t } = useLanguage();
  const [actif, setActif] = useState(sonActifMemorise);
  function basculer() {
    const v = !actif;
    setActif(v);
    vibrer('selection');
    try { localStorage.setItem(CLE_SON, v ? 'on' : 'off'); } catch { /* sans stockage : le son reste comme il était */ }
  }
  return (
    <LigneCompte icone={actif ? 'son' : 'sonCoupe'} titre={t('ecranLivreur.sonTitre')} sous={actif ? t('ecranLivreur.sonActif') : t('ecranLivreur.sonCoupe')}
      action={(
        <button type="button" className={actif ? 'btn-ghost' : 'btn-outline'} style={{ padding: '8px 14px', fontSize: 14 }} aria-pressed={actif} onClick={basculer}>
          {actif ? t('ecranLivreur.sonCouper') : t('ecranLivreur.sonActiver')}
        </button>
      )} />
  );
}
