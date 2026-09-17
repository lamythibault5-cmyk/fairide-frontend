import { useEffect, useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import useRevalidation from '../useRevalidation';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import RetourCompte from '../components/RetourCompte';
import GameSwitcher from '../components/GameSwitcher';
import TrackingWithGames from '../components/TrackingWithGames';
import DeliveryTrackingMap from '../components/DeliveryTrackingMap';
import Icone from '../components/Icone';

// Les mini-jeux, rubrique de Mon compte (juste après « Notre histoire »).
//
// ILS VIVAIENT EN BAS DE « MES COMMANDES ». Une page de commandes sert à savoir où en est ce qu'on a
// payé ; six jeux posés dessous l'allongeaient pour tout le monde, y compris pour qui ne joue jamais.
// Ils ont maintenant leur page, qu'on ouvre quand on en a envie.
//
// L'ÉCRAN SCINDÉ reste la raison d'être des jeux côté client : patienter en voyant le livreur arriver.
// Il n'est proposé que lorsqu'une commande est réellement en livraison, avec ses coordonnées — sans
// livreur en route, la carte n'aurait rien à montrer. Il ne s'ouvre jamais tout seul : on vient ici pour
// jouer, la carte est une possibilité, pas une imposition.

// Même cadence que « Mes commandes » : la position du livreur arrive avec la commande.
const RAFRAICHISSEMENT_MS = 15000;
// Sur téléphone, TrackingWithGames empile la carte au-dessus du jeu : une carte basse laisse les deux
// tenir ensemble à l'écran — c'est tout l'intérêt de l'écran scindé.
const TELEPHONE = 560;

function enLivraison(o) {
  return o.orderType === 'delivery' && o.status === 'livraison' && o.restaurantLat && o.deliveryLat;
}

export default function GamesPage() {
  const { t } = useLanguage();
  const { token, role } = useAuth();
  const client = role === 'client';
  const [livraisons, setLivraisons] = useState([]);
  const [suivieId, setSuivieId] = useState(null);
  const [scinde, setScinde] = useState(false);

  usePageMeta({ title: t('games.pageTitle'), description: t('games.pageMetaDescription'), path: '/jeux' });

  const charger = () => api('/orders/mine', { token }).then((orders) => setLivraisons(orders.filter(enLivraison)));
  useEffect(() => {
    if (!client) return undefined;
    charger().catch(() => {});
    const interval = setInterval(() => { charger().catch(() => {}); }, RAFRAICHISSEMENT_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);
  useRevalidation(charger, { actif: client });

  // La livraison suivie : celle qu'on a choisie si elle roule encore, sinon la première en route.
  const suivie = livraisons.find((o) => o.id === suivieId) || livraisons[0] || null;
  // Livrée entre-temps : l'écran scindé se referme de lui-même, le jeu reprend toute la place — et ne se
  // rouvrira pas tout seul à la livraison suivante.
  useEffect(() => { if (!suivie) setScinde(false); }, [suivie]);
  const scindeActif = scinde && !!suivie;

  const rendreCarte = ({ height, onEta }) => (
    <DeliveryTrackingMap
      restaurantLat={suivie.restaurantLat} restaurantLng={suivie.restaurantLng}
      deliveryLat={suivie.deliveryLat} deliveryLng={suivie.deliveryLng}
      driverLat={suivie.driverLat} driverLng={suivie.driverLng}
      lastUpdatedAt={suivie.driverLocationUpdatedAt}
      height={height} onEta={onEta}
    />
  );

  return (
    <div>
      <RetourCompte />
      <h1 className="section-title" style={{ marginTop: 0 }}>{t('games.pageTitle')}</h1>
      <p className="small jeux-page-intro">{t('games.pageIntro')}</p>

      {client && suivie && (
        <div className="card jeux-page-livraison" role="status">
          <span className="jeux-page-livraison-texte"><Icone nom="position" taille={16} /> {t('games.pageOnTheWay', { name: suivie.restaurantName })}</span>
          {livraisons.length > 1 && (
            <div className="jeux-page-choix" role="group" aria-label={t('games.pagePickOrder')}>
              {livraisons.map((o) => (
                <button key={o.id} type="button" className={`cuisine-chip${o.id === suivie.id ? ' active' : ''}`} aria-pressed={o.id === suivie.id} onClick={() => setSuivieId(o.id)}>
                  {o.restaurantName}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={scindeActif ? 'btn-outline' : 'btn-gold'} onClick={() => setScinde((s) => !s)} aria-pressed={scindeActif}>
            {scindeActif ? t('games.pageSplitClose') : <>◧ {t('games.pageSplitOpen')}</>}
          </button>
        </div>
      )}

      {scindeActif ? (
        <TrackingWithGames
          key={suivie.id}
          role="client" masquable={false} hauteur={window.innerWidth <= TELEPHONE ? 190 : 340}
          rendreCarte={rendreCarte}
          legende={suivie.driverLat ? t('orders.driverLiveLocation') : t('orders.driverWaitingLocation')}
        />
      ) : (
        <section className="jeux-page-terrain" aria-label={t('games.pageTitle')}>
          <GameSwitcher fill large onEcranScinde={client && suivie ? () => setScinde(true) : undefined} />
        </section>
      )}

      {client && !suivie && <p className="small jeux-page-aide"><span aria-hidden="true">◧ </span>{t('games.pageSplitHint')}</p>}
    </div>
  );
}
