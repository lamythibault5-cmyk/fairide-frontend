import { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { vibrer } from '../../gestes';

/* PLUS DE TEMPS APRÈS AVOIR ACCEPTÉ (revue des trois parcours, 2026-10-31 ; backend PATCH /orders/:id/extra-time). Le temps
 * en plus ne se choisissait qu'au moment d'accepter : un coup de feu qui arrive ensuite laissait au client une heure qui ne
 * serait pas tenue. Sous « Marquer prêt », un lien discret (texte, jamais lime : le geste de la carte reste « prêt ») qui
 * déplie +10 / +20 / +30 min ; un toucher envoie, le client reçoit une notification. Le serveur refuse au-delà d'une heure
 * en plus au total (son message s'affiche). `onAjouter(minutes)` : l'appel, fait par la page (orderAction). */
export default function PlusDeTemps({ onAjouter, occupe = false }) {
  const { t } = useLanguage();
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return <button type="button" className="ec-bouton ec-bouton--texte" disabled={occupe} onClick={() => setOuvert(true)}>{t('ordersResto.moreTime')}</button>;
  }
  return (
    <div className="ec-plus-temps" role="group" aria-label={t('ordersResto.moreTime')}>
      {[10, 20, 30].map((m) => (
        <button key={m} type="button" className="ec-bouton ec-bouton--contour" disabled={occupe}
          onClick={async () => { vibrer('choix'); const r = await onAjouter(m); if (r?.ok !== false) setOuvert(false); }}>
          {t('ordersResto.extraPrepMinutes', { n: m })}
        </button>
      ))}
    </div>
  );
}
