import { useEffect, useRef, useState } from 'react';
import { imgProps, cacherImageCassee } from '../../images';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePreviewMode } from '../../context/PreviewModeContext';
import { SkeletonCards } from '../../components/Skeleton';
import VisuelVide from '../../components/VisuelVide';
import EtatVide from '../../components/EtatVide';
import ErreurChargement from '../../components/ErreurChargement';
import FavoriteHeart from '../../components/FavoriteHeart';
import { useLanguage } from '../../context/LanguageContext';
import { restaurantTypeLabel } from '../../menuCategories';
import { mouvementReduit, vibrer } from '../../gestes';
import '../../ecran-liste.css';
import '../../site-liste.css';

/* MES FAVORIS (fondateur, 2026-10-16, proposition « Le cœur qui bat » de mockups/tous-les-ecrans.html). Le titre et le
 * nombre de commerces sur un bandeau iris, les cartes dans la feuille blanche. Chaque carte porte le cœur des cartes de
 * la liste : le toucher retire le favori SUR PLACE — le cœur se vide, la carte s'efface, les autres se resserrent — sans
 * passer par la fiche du commerce. Plus rien : le vélo attend sur sa route (EtatVide scene="favoris"). */
export default function Favorites() {
  const { token, role } = useAuth();
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  // Liste pas lue (réseau, serveur) : « Aucun favori » ferait croire les favoris perdus (audit du 19/10, CROSS-34).
  const [echec, setEchec] = useState(false);
  // Les cartes en train de partir (cœur touché) : elles s'effacent avant d'être retirées de la liste.
  const [sortantes, setSortantes] = useState(() => new Set());
  const minuteurs = useRef([]);
  const toast = useToast();
  const { previewMode } = usePreviewMode();
  const { t } = useLanguage();

  // Un restaurateur en mode aperçu n'a pas de vrais favoris (403 côté API) — liste vide silencieuse
  // plutôt qu'un message d'erreur trompeur, voir MapPage.jsx pour le même filet.
  const charger = () => {
    const isPreviewingRestaurant = previewMode && role === 'restaurant';
    setEchec(false);
    setLoading(true);
    api('/restaurants/favorites/mine', { token }).then(setRestaurants).catch(() => { if (!isPreviewingRestaurant) setEchec(true); }).finally(() => setLoading(false));
  };
  useEffect(() => {
    charger();
    const enCours = minuteurs.current;
    return () => enCours.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le cœur touché : la carte part tout de suite (le geste répond), le serveur suit. S'il refuse, elle revient.
  async function retirer(e, r) {
    e.preventDefault();
    e.stopPropagation();
    if (sortantes.has(r.id)) return;
    vibrer(10);
    setSortantes((s) => new Set(s).add(r.id));
    const duree = mouvementReduit() ? 0 : 520;
    const fin = new Promise((ok) => { minuteurs.current.push(setTimeout(ok, duree)); });
    try {
      await api(`/restaurants/${r.id}/favorite`, { method: 'DELETE', token });
      await fin;
      setRestaurants((liste) => liste.filter((x) => x.id !== r.id));
    } catch (err) {
      toast(err.message, 'erreur');
    } finally {
      setSortantes((s) => { const n = new Set(s); n.delete(r.id); return n; });
    }
  }

  const n = restaurants.length;
  return (
    <div className="ecran-bandeau fav-ecran">
      <div className="eb-bandeau">
        <h1 className="eb-titre">{t('favorites.title')}</h1>
        {!loading && !echec && <p className="eb-sous" aria-live="polite">{n === 0 ? t('ecranListe.favorisAucun') : n === 1 ? t('ecranListe.favorisUn') : t('ecranListe.favorisN', { n })}</p>}
      </div>
      <div className="eb-feuille">
        {loading && <SkeletonCards count={4} />}
        {/* Un écran vide, pas une phrase dans un cadre en pointillés : quand le vide occupe toute la
            page, le rectangle hachuré se lit comme une panne. Voir le commentaire d'EtatVide. */}
        {!loading && echec && <ErreurChargement onReessayer={charger} />}
        {!loading && !echec && n === 0 && (
          <EtatVide
            icone="favoris" scene="favoris" titre={t('favorites.emptyTitle')} texte={t('favorites.empty')}
            actionVers="/restaurants" actionTexte={t('orders.emptyAction')}
          />
        )}
        {!loading && n > 0 && (
          <div className="fav-grille">
            {restaurants.map((r) => {
              const sort = sortantes.has(r.id);
              return (
                <Link key={r.id} to={`/restaurants/${r.id}`} className={`fav-carte${sort ? ' fav-carte--sort' : ''}`}>
                  <span className="fav-photo">
                    <VisuelVide nom={r.name} cuisine={r.cuisine} />
                    {r.coverImageUrl && <img loading="lazy" decoding="async" {...imgProps(r.coverImageUrl, 480, '(max-width: 640px) 50vw, 240px')} alt="" onError={cacherImageCassee} />}
                    <FavoriteHeart
                      active={!sort}
                      onClick={(e) => retirer(e, r)}
                      title={t('ecranListe.favorisRetirer')}
                      className={`rest-card-fav${sort ? ' fav-bat' : ''}`}
                    />
                  </span>
                  <b className="fav-nom">{r.name}</b>
                  <span className="fav-ligne">{[r.cuisine && restaurantTypeLabel(r.cuisine, t), r.commune].filter(Boolean).join(' · ')}</span>
                  <span className="fav-ligne fav-discret">{[r.neighborhood, t('restaurantList.dishesCount', { count: (r.menu || []).length })].filter(Boolean).join(' · ')}</span>
                  {r.desc && <span className="fav-desc">{r.desc}</span>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
