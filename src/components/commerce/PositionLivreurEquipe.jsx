import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { estNatif, etatPosition, ouvrirReglagesAppli, refusPosition, suivrePositionCourse } from '../../natif';
import { useLanguage } from '../../context/LanguageContext';

// Toutes les 12 s au plus, et au moins une fois toutes les 12 s à l'arrêt : le rythme du livreur Fairride (driver/Dashboard.jsx).
const INTERVALLE_MS = 12000;

/* LA POSITION DU LIVREUR SALARIÉ, DEPUIS SON COMPTE DE L'ÉQUIPE (fondateur, 2026-11-02 : « la position pour ce compte, c'est
 * mieux » ; backend routes/orders.js, shop-location). Le titulaire l'a marqué « livre pour moi » (Mon compte › Équipe) ; il a
 * touché « Partie en livraison » sur son téléphone : la commande le retient (shopCourierId). Tant qu'elle est en livraison, son
 * téléphone envoie sa position, qui n'est montrée qu'au client de cette commande et effacée à « Livrée ». Rien d'autre :
 * ni le titulaire, ni un autre membre, ni une autre commande. La carte de la commande le lui dit (OrdersPage, GestesEquipe).
 * Dans l'application, le suivi continue téléphone verrouillé (même greffon que les livreurs Fairride, notification visible).
 * TÉLÉPHONE QUI REFUSE (G42, 2026-11-06) : position bloquée, ou seulement approximative sur Android (le greffon exige
 * l'exacte), il ne se passait rien du tout, pas même un message. Le bandeau le dit maintenant tant que la livraison dure. */
export default function PositionLivreurEquipe({ orders, moi, token }) {
  const { t } = useLanguage();
  const miennes = (orders || []).filter((o) => o.deliveryBy === 'restaurant' && o.status === 'livraison' && moi && o.shopCourierId === moi).map((o) => o.id);
  const cle = miennes.join(',');
  const ids = useRef(miennes);
  ids.current = miennes;
  const [refuse, setRefuse] = useState(false);
  // Revenu des réglages avec la position exacte : le greffon qui avait refusé ne reprend pas seul, le suivi repart (jamais sur
  // un simple retour à l'écran, qui reposerait la question du système en boucle).
  const [relance, setRelance] = useState(0);
  useEffect(() => {
    if (!refuse) return undefined;
    const auRetour = async () => { if (document.visibilityState === 'visible' && (await etatPosition({ precise: true })) === 'granted') setRelance((n) => n + 1); };
    document.addEventListener('visibilitychange', auRetour);
    return () => document.removeEventListener('visibilitychange', auRetour);
  }, [refuse]);

  useEffect(() => {
    if (!cle) { setRefuse(false); return undefined; }
    let dernierEnvoi = 0; let dernieres = null; let arreter = null; let fini = false;
    const envoyer = ({ latitude, longitude }) => {
      dernierEnvoi = Date.now();
      ids.current.forEach((id) => api(`/orders/${id}/shop-location`, { method: 'PATCH', token, body: { lat: latitude, lng: longitude } }).catch(() => {}));
    };
    suivrePositionCourse({
      arrierePlan: true,
      titre: t('livraisonEquipe.suiviTitre'),
      message: t('livraisonEquipe.suiviMessage'),
      onPosition: (p) => { setRefuse(false); dernieres = p; if (Date.now() - dernierEnvoi >= INTERVALLE_MS) envoyer(p); },
      onErreur: (e) => { if (refusPosition(e)) setRefuse(true); }
    }).then((stop) => { if (fini) stop(); else arreter = stop; });
    const battement = setInterval(() => { if (dernieres && Date.now() - dernierEnvoi >= INTERVALLE_MS) envoyer(dernieres); }, INTERVALLE_MS);
    return () => { fini = true; clearInterval(battement); arreter?.(); };
  }, [cle, token, relance]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cle || !refuse) return null;
  return (
    <p className="ec-b-sous" role="alert">
      {t('livraisonEquipe.suiviCoupe')}
      {estNatif() && <> <button type="button" className="lien-bouton" style={{ color: 'inherit' }} onClick={() => ouvrirReglagesAppli()}>{t('dashDriver.posReqReglages')}</button></>}
    </p>
  );
}
