import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { refusPosition, suivrePositionCourse } from '../../natif';
import useAlerteLivreur from '../../hooks/useAlerteLivreur';

// Même cadence d'envoi que l'écran des courses (driver/Dashboard.jsx, MIN_LOCATION_SEND_INTERVAL_MS).
const INTERVALLE_ENVOI_MS = 12000;
// Relevé de ses courses : comme l'écran des courses pendant une course ; sans course en main, juste de quoi voir arriver la
// suivante (prise depuis une notification, par exemple), sans charger le serveur.
const RELEVE_EN_COURSE_MS = 15000;
const RELEVE_SANS_COURSE_MS = 60000;
const AUCUNE = [];

/* LE SUIVI D'UNE LIVRAISON CONTINUE HORS DE L'ÉCRAN DES COURSES (G41, 2026-11-06).
 *
 * Le partage de position (avec son battement de 12 s et le greffon en arrière-plan) et les alertes « prête » / « annulée »
 * vivaient dans l'écran des courses (driver/Dashboard.jsx) et la carte (driver/MapPage.jsx). Gains et Mon compte sont d'autres
 * pages : y passer pendant une livraison démontait l'écran et coupait le suivi. La carte du client se figeait pour le reste de
 * la course (« où est mon livreur ? »), et la course devenue prête ne sonnait plus.
 *
 * Monté par App.jsx pour un compte livreur, SEULEMENT hors de ces deux écrans, qui gardent leur propre suivi : jamais deux
 * suivis à la fois, donc jamais deux envois de la même position. Il relit ses courses (GET /orders/mine/deliveries?recent=1),
 * partage sa position pour celles « en livraison » exactement comme l'écran des courses (partage coupé dans Mon compte :
 * rien), et fait sonner « prête » et « annulée » (useAlerteLivreur, sans les offres ni le titre de l'onglet). N'affiche rien. */
export default function SuiviCoursesHorsEcran() {
  const { t } = useLanguage();
  const toast = useToast();
  const { token, user } = useAuth();
  const [mine, setMine] = useState(null);
  const courses = mine || AUCUNE;
  const enMain = courses.some((o) => ['preparation', 'pret', 'livraison'].includes(o.status));
  const enMainRef = useRef(enMain);
  enMainRef.current = enMain;

  useEffect(() => {
    let fini = false;
    let minuteur = null;
    async function relire() {
      // Écran caché sans course en main : rien à surveiller (le serveur prévient par notification).
      if (!document.hidden || enMainRef.current) {
        try {
          const r = await api('/orders/mine/deliveries?recent=1', { token });
          if (!fini) setMine(r);
        } catch { /* réseau : le relevé suivant */ }
      }
      if (!fini) minuteur = setTimeout(relire, enMainRef.current ? RELEVE_EN_COURSE_MS : RELEVE_SANS_COURSE_MS);
    }
    relire();
    return () => { fini = true; clearTimeout(minuteur); };
  }, [token]);

  const surAnnulee = useCallback((o) => toast(t('driverAlert.notifCancelled', { name: o.restaurantName || '' }), 'erreur'), [toast, t]);
  useAlerteLivreur({ disponibles: AUCUNE, mesCourses: courses, pret: mine !== null, actif: false, surAnnulee, titreOnglet: false });

  const enLivraison = courses.filter((o) => o.status === 'livraison').map((o) => o.id);
  const ids = useRef(enLivraison);
  ids.current = enLivraison;
  const actif = enLivraison.length > 0;
  useEffect(() => {
    if (!actif || user?.locationSharingEnabled === false) return undefined;
    let dernierEnvoi = 0; let dernieres = null; let arreter = null; let fini = false; let prevenu = false;
    const envoyer = ({ latitude, longitude }) => {
      dernierEnvoi = Date.now();
      ids.current.forEach((id) => api(`/orders/${id}/location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {}));
    };
    suivrePositionCourse({
      arrierePlan: true,
      titre: t('dashDriver.bgTrackingTitle'),
      message: t('dashDriver.bgTrackingMessage'),
      onPosition: (p) => { dernieres = p; if (Date.now() - dernierEnvoi >= INTERVALLE_ENVOI_MS) envoyer(p); },
      // Un refus du téléphone (G42) : dit une fois ici ; l'écran des courses le garde affiché tant que la livraison dure.
      onErreur: (e) => { if (!prevenu && refusPosition(e)) { prevenu = true; toast(t('livraisonEquipe.suiviCoupe'), 'erreur'); } }
    }).then((stop) => { if (fini) stop(); else arreter = stop; });
    // Battement : un livreur immobile (feu rouge, porte du client) renvoie sa dernière position, comme l'écran des courses.
    const battement = setInterval(() => { if (dernieres && Date.now() - dernierEnvoi >= INTERVALLE_ENVOI_MS) envoyer(dernieres); }, INTERVALLE_ENVOI_MS);
    return () => { fini = true; clearInterval(battement); arreter?.(); };
  }, [actif, token, user?.locationSharingEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
