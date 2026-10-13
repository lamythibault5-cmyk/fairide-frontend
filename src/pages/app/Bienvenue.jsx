import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api';
import { estNatif, demanderPosition, connexionFournisseur } from '../../natif';
import { communeDepuisCodePostal, communeRingDistance, haversineDistanceKm } from '../../menuCategories';
import { ecrireBienvenue } from '../../bienvenue';
import {
  Haut, EcranAccueil, EcranProfil, EcranChoix, EcranCartes, EcranPourquoi, EcranEnvies, EcranPermission, EcranCodePostal,
  EcranRecherche, EcranCompte, EcranPromesses
} from './EcransBienvenue';

/* ACCUEIL DE L'APPLICATION iOS / ANDROID — /bienvenue, premier lancement seulement.
 *
 * Conçu avec le skill app-onboarding-questionnaire et validé sur maquette par le fondateur le 2026-10-11
 * (mockups/app-onboarding.html, à garder en phase). Le site n'est pas touché : Home.jsx n'envoie ici que dans
 * l'application (estNatif()), et un visiteur de fairide.be qui taperait l'adresse retombe sur l'accueil — sauf
 * avec ?apercu, pour pouvoir le relire dans un navigateur (npm run dev).
 *
 * CE QUI A ÉTÉ ADAPTÉ DU CADRE DU SKILL, ET POURQUOI
 *   - Pas de paywall : le client ne paie pas l'application ; l'abonnement commerce est offert au lancement.
 *   - Pas d'avis inventés ni de chiffres de démonstration : seulement des faits vérifiables (voir EcransBienvenue).
 *   - Trois parcours après « Tu es… » : le client a tout ; livreur et commerce ont un écran de promesses puis le
 *     compte — leur vrai parcours (dossier livreur, fiche commerce) existe déjà après l'inscription.
 *   - Pas de démo « choisis 3 commerces » ni de partage (retirés par le fondateur, « trop long ») : la position
 *     mène au chargement, puis aux commerces qui livrent vraiment chez toi, au-dessus des boutons de compte.
 *   - Le compte est demandé APRÈS avoir vu les commerces (règle 5.1.1 d'Apple), Apple à côté de Google (4.8).
 *   - Les notifications ne sont proposées qu'une fois le compte créé (AmorceNotifications.jsx) : le jeton de
 *     l'appareil s'enregistre sur un compte, il n'y a rien à quoi l'attacher avant. Pour les trois profils : le
 *     livreur est prévenu des courses qu'il verrait (backend notifLivreurs.js, depuis le 2026-10-11).
 *
 * RAYON. « Qui livre chez toi » est calculé ici, avec ce que la liste publique renvoie déjà (position et
 * deliveryRadiusKm de chaque commerce, 6 km par défaut — rayonLivraison.js côté serveur) : aucune route en plus.
 * Au lancement il y a peu de commerces, donc on les montre TOUS ceux qui livrent, du plus proche au plus loin
 * (décision du fondateur), les envies cochées d'abord. */

const BUTS = [['prix', 'euro', 'bPrix', true], ['juste', 'balance', 'bJuste', true], ['local', 'commerce', 'bLocal', true], ['decouvrir', 'boussole', 'bDecouvrir', true]];
// Trois freins, tous sur le prix (retour du fondateur : c'est la seule vraie douleur).
const FREINS = [['gonfle', 'tendance', 'fGonfle'], ['frais', 'ticket', 'fFrais'], ['resto', 'restaurants', 'fResto']];
// Quelles cuisines répondent à quelle envie. Un commerce peut répondre à plusieurs. La table RESTAURANT_TYPES ne suffit
// pas : la liste publique porte aussi des cuisines saisies librement (« Ramen », « Marocain », « Cuisine Saine »,
// « Bubble Tea »… relevées en production le 2026-10-11) — on les range ici pour qu'elles comptent.
const CUISINES_PAR_ENVIE = {
  snack: ['Kebab & Grill', 'Friterie', 'Belge', 'Fried Chicken', 'Sandwichs & Salades'],
  pizza: ['Pizza', 'Italien'],
  burger: ['Burgers'],
  monde: ['Asiatique', 'Sushi', 'Ramen', 'Mexicain', 'Libanais', 'Marocain', 'Espagnol', 'Thaïlandais', 'Indien', 'Vietnamien', 'Chinois', 'Africain', 'Coréen'],
  healthy: ['Healthy', 'Cuisine Saine', 'Végétarien', 'Poke Bowl', 'Sandwichs & Salades'],
  sucre: ['Coffee Shop', 'Boulangerie', 'Bubble Tea', 'Desserts & Glaces', 'Petit-déjeuner & Brunch']
};
const PARCOURS = {
  client: ['buts', 'freins', 'cartes', 'pourquoi', 'envies', 'position', 'codePostal', 'recherche', 'compte'],
  driver: ['lvPromesses', 'lvPosition', 'compte'],
  restaurant: ['coPromesses', 'compte']
};
const DUREE_RECHERCHE_MS = 1800; // le chargement que le fondateur aime : assez long pour se lire, jamais plus

// Commerces qui livrent à cette position (ou, sans position, rangés par proximité de commune), envies d'abord.
function trierCommerces(liste, { position, commune, envies }) {
  const repond = (r) => envies.some((e) => (CUISINES_PAR_ENVIE[e] || []).some((c) => (r.cuisines || [r.cuisine]).includes(c)));
  let items = liste.map((r) => ({
    r,
    km: position && r.lat !== null && r.lng !== null ? haversineDistanceKm(position.lat, position.lng, r.lat, r.lng) : null,
    envie: envies.length ? repond(r) : false
  }));
  if (position) items = items.filter((x) => x.km !== null && x.km <= (x.r.deliveryRadiusKm ?? 6));
  const proximite = (x) => (position ? x.km : communeRingDistance(commune, x.r.commune));
  return items.sort((a, b) => (Number(b.envie) - Number(a.envie)) || (proximite(a) - proximite(b)));
}

// Points du cercle : à leur vraie place autour de la position (échelle = le plus grand rayon), sinon en spirale.
function pointsDuCercle(items, position) {
  if (!position) return items.slice(0, 12).map((_, k) => ({ x: 50 + Math.cos(k * 2.4) * (12 + k * 2.6), y: 50 + Math.sin(k * 2.4) * (12 + k * 2.6) }));
  const echelle = Math.max(6, ...items.map((x) => x.r.deliveryRadiusKm ?? 6));
  return items.slice(0, 24).map(({ r }) => ({
    x: 50 + ((r.lng - position.lng) * 111.32 * Math.cos((position.lat * Math.PI) / 180) / echelle) * 44,
    y: 50 - ((r.lat - position.lat) * 110.57 / echelle) * 44
  }));
}

export default function Bienvenue() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const apercu = new URLSearchParams(location.search).has('apercu');

  const [ecran, setEcran] = useState('accueil');
  const [historique, setHistorique] = useState([]);
  const [role, setRole] = useState(null);
  const [buts, setButs] = useState([]);
  const [freins, setFreins] = useState([]);
  const [envies, setEnvies] = useState([]);
  const [position, setPosition] = useState(null);
  const [cp, setCp] = useState('');
  const [liste, setListe] = useState(null);
  const [attente, setAttente] = useState(false);

  const communeCp = cp.length === 4 ? communeDepuisCodePostal(cp) : '';
  const parcours = useMemo(() => ['accueil', 'profil', ...(role ? PARCOURS[role] : [])], [role]);
  const resultats = useMemo(() => (liste ? trierCommerces(liste, { position, commune: communeCp, envies }) : []), [liste, position, communeCp, envies]);
  const points = useMemo(() => pointsDuCercle(resultats, position), [resultats, position]);

  // La liste des commerces part dès l'écran « Pourquoi » : au chargement, elle est souvent déjà là.
  useEffect(() => {
    if (role !== 'client' || liste || !['pourquoi', 'envies', 'position', 'codePostal', 'recherche'].includes(ecran)) return;
    api('/restaurants').then((r) => setListe(Array.isArray(r) ? r : [])).catch(() => setListe([]));
  }, [role, ecran, liste]);

  // Chargement : au moins DUREE_RECHERCHE_MS, et jusqu'à ce que la liste soit arrivée.
  useEffect(() => {
    if (ecran !== 'recherche') return undefined;
    let fini = false; let minuteur;
    const depart = Date.now();
    const verifier = () => {
      if (fini) return;
      if (liste && Date.now() - depart >= DUREE_RECHERCHE_MS) { fini = true; aller('compte', { sansHistorique: true }); return; }
      minuteur = setTimeout(verifier, 150);
    };
    verifier();
    return () => { fini = true; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, liste]);

  if (user) return <Navigate to="/" replace />;
  if (!estNatif() && !apercu) return <Navigate to="/" replace />;

  function aller(suivant, { sansHistorique = false } = {}) {
    if (!sansHistorique) setHistorique((h) => [...h, ecran]);
    setEcran(suivant);
    window.scrollTo(0, 0);
  }
  const suivant = () => aller(parcours[parcours.indexOf(ecran) + 1]);
  function retour() {
    const h = [...historique];
    let precedent = h.pop();
    while (precedent === 'recherche') precedent = h.pop(); // il repartirait tout seul vers l'avant
    setHistorique(h);
    setEcran(precedent || 'accueil');
  }
  const basculer = (setter) => (v) => setter((l) => (l.includes(v) ? l.filter((x) => x !== v) : [...l, v]));
  // Tant qu'aucun profil n'est choisi, le parcours ne compte que deux écrans : « Tu es… » aurait affiché une barre
  // pleine (retour du fondateur, 2026-10-11). On mesure donc sur le parcours le plus long, celui du client.
  const mesure = role ? parcours : ['accueil', 'profil', ...PARCOURS.client];
  const progression = Math.max(0, mesure.indexOf(ecran)) / (mesure.length - 1);

  async function utiliserPosition(ensuite) {
    setAttente(true);
    const p = await demanderPosition();
    setAttente(false);
    if (role === 'client') {
      if (p) { setPosition(p); aller('recherche'); } else { toast(t('appli.posEchec')); aller('codePostal'); }
      return;
    }
    ensuite();
  }

  // On quitte l'accueil pour la page de connexion : on retient ce qui sert après (Home.jsx, AmorceNotifications.jsx).
  function memoriser() {
    ecrireBienvenue({
      vu: true, role, envies, commune: communeCp || null, position: position || null,
      amorceNotifs: 'a-faire'
    });
  }
  // Page de connexion : rôle présélectionné. Avec un jeton Apple/Google, Auth.jsx le traite tout de suite (connexion
  // si le compte existe, sinon formulaire d'inscription prérempli) ; sinon, formulaire d'inscription par e-mail.
  const roleParam = role && role !== 'client' ? `role=${role}` : '';
  async function viaFournisseur(fournisseur) {
    setAttente(true);
    try {
      const fed = await connexionFournisseur(fournisseur);
      memoriser();
      navigate(`/login${roleParam ? `?${roleParam}` : ''}`, { state: { fed } });
    } catch (err) {
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) toast(t('appli.nativeLoginFailed'), 'erreur');
    } finally {
      setAttente(false);
    }
  }
  const viaEmail = () => { memoriser(); navigate(`/login?audience=${role === 'restaurant' ? 'partner' : 'client'}${roleParam ? `&${roleParam}` : ''}`); };
  const dejaInscrit = () => { ecrireBienvenue({ vu: true, amorceNotifs: 'a-faire' }); navigate('/login'); };

  const fondIris = ['accueil', 'recherche', 'lvPromesses', 'coPromesses'].includes(ecran);
  const sansHaut = ['accueil', 'recherche'].includes(ecran);
  // « Passer » saute les questions, jamais le message : on atterrit sur « Pourquoi passer à Fairide ? ».
  const passerQuestions = ['buts', 'freins', 'cartes'].includes(ecran) ? () => aller('pourquoi') : null;

  let contenu;
  switch (ecran) {
    case 'accueil':
      contenu = <EcranAccueil onCommencer={() => aller('profil')} onConnexion={dejaInscrit} />; break;
    case 'profil':
      contenu = <EcranProfil role={role} onChoix={setRole} onSuite={suivant} />; break;
    case 'buts':
      contenu = <EcranChoix titre={t('appli.butTitre')} liste={BUTS} choisis={buts} onBasculer={basculer(setButs)} onSuite={suivant} exigerUn />; break;
    case 'freins':
      contenu = <EcranChoix titre={t('appli.freinsTitre')} liste={FREINS} choisis={freins} onBasculer={basculer(setFreins)} onSuite={suivant} libelleVide={t('appli.rien')} />; break;
    case 'cartes':
      contenu = <EcranCartes onFini={() => aller('pourquoi')} />; break;
    case 'pourquoi':
      contenu = <EcranPourquoi freins={freins} onSuite={suivant} />; break;
    case 'envies':
      contenu = <EcranEnvies envies={envies} onBasculer={basculer(setEnvies)} onSuite={suivant} />; break;
    case 'position':
      contenu = (
        <EcranPermission icone="position" titre={t('appli.posTitre')} sous={t('appli.posSub')} bouton={t('appli.posBtn')} attente={attente}
          faits={[['maison', t('appli.pos1'), t('appli.pos1S')], ['cadenas', t('appli.pos2'), t('appli.pos2S')]]}
          onOui={() => utiliserPosition()} onNon={() => aller('codePostal')} libelleNon={t('appli.posNon')} />
      ); break;
    case 'codePostal':
      contenu = <EcranCodePostal cp={cp} commune={communeCp} onCp={setCp} onSuite={() => { setPosition(null); aller('recherche'); }} />; break;
    case 'recherche':
      contenu = <EcranRecherche commune={position ? '' : communeCp} points={liste ? points : []} envies={envies} />; break;
    case 'compte':
      contenu = (
        <EcranCompte role={role} resultats={resultats} avecPosition={!!position} commune={communeCp} points={points} attente={attente}
          onFournisseur={viaFournisseur} onEmail={viaEmail} onConnexion={dejaInscrit} />
      ); break;
    case 'lvPromesses':
      contenu = (
        <EcranPromesses chip={t('appli.lvChip')} chipIcone="scooter" titre={t('appli.lvTitre')} bouton={t('appli.lvBtn')} onSuite={suivant}
          faits={[['euro', t('appli.lv1'), t('appli.lv1S')], ['interdit', t('appli.lv2'), t('appli.lv2S')], ['cadeau', t('appli.lv3'), t('appli.lv3S')], ['document', t('appli.lv4'), t('appli.lv4S')]]} />
      ); break;
    case 'lvPosition':
      contenu = (
        <EcranPermission icone="position" titre={t('appli.lvPosTitre')} sous={t('appli.lvPosSub')} bouton={t('appli.lvPosBtn')} attente={attente}
          faits={[['horloge', t('appli.lvPos1'), t('appli.lvPos1S')], ['apercu', t('appli.lvPos2'), t('appli.lvPos2S')]]}
          // Indispensable pour livrer : pas de « Pas maintenant ». Un refus n'empêche pas de créer le compte (le
          // tableau de bord bloque ensuite les courses tant qu'elle manque, PositionRequise.jsx) — bloquer l'inscription
          // elle-même pour une permission serait refusé par Apple (règle 5.1.1).
          onOui={() => utiliserPosition(suivant)} />
      ); break;
    case 'coPromesses':
      contenu = (
        <EcranPromesses chip={t('appli.coChip')} chipIcone="be" titre={t('appli.coTitre')} sous={t('appli.coSub')} bouton={t('appli.coBtn')} onSuite={suivant}
          faits={[['euro', t('appli.co1'), t('appli.co1S')], ['cadeau', t('appli.co2'), t('appli.co2S')], ['bouclier', t('appli.co3'), t('appli.co3S')], ['document', t('appli.co4'), t('appli.co4S')]]} />
      ); break;
    default:
      contenu = null;
  }

  return (
    <div className={`bv${fondIris ? ' bv-iris' : ''}`}>
      <main className="bv-ecran" key={ecran}>
        {!sansHaut && <Haut onRetour={retour} progression={progression} onPasser={passerQuestions} />}
        {contenu}
      </main>
    </div>
  );
}
