import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api';
import { experienceApp, demanderPosition, connexionFournisseur } from '../../natif';
import { communeDepuisCodePostal, communeRingDistance, haversineDistanceKm } from '../../menuCategories';
import { ecrireBienvenue, ecrireReprise, lireReprise, lireParcoursFait, ecrireParcoursFait } from '../../bienvenue';
import { repondAuxEnvies } from '../../envies';
import {
  Haut, EcranAccueil, EcranProfil, EcranChoix, EcranCartes, EcranPourquoi, EcranEnvies, EcranPermission, EcranCodePostal,
  EcranRecherche, EcranCompte, EcranPromesses
} from './EcransBienvenue';
import InscriptionAppli from './InscriptionAppli';

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
 *   - L'inscription elle-même se fait ICI, dans les mêmes écrans (InscriptionAppli.jsx, 2026-10-15) : plus de passage
 *     par /login, la page du site avec son en-tête. Seul « J'ai déjà un compte » y mène encore.
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
// Quelles cuisines répondent à quelle envie : la table vit dans src/envies.js depuis le 2026-10-13, partagée avec la
// rangée « Vos envies » de la liste des commerces (cuisines saisies librement relevées en production le 2026-10-11).
const PARCOURS = {
  client: ['buts', 'freins', 'cartes', 'pourquoi', 'envies', 'position', 'codePostal', 'recherche', 'compte'],
  driver: ['lvPromesses', 'lvPosition', 'compte'],
  restaurant: ['coPromesses', 'compte']
};
// Le chargement que le fondateur aime : assez long pour se lire (1,8 s, puis 3,8 s le 2026-10-16 : « 2 secondes de plus »).
const DUREE_RECHERCHE_MS = 3800;

// Commerces qui livrent à cette position (ou, sans position, rangés par proximité de commune), envies d'abord.
function trierCommerces(liste, { position, commune, envies }) {
  const repond = (r) => repondAuxEnvies(r, envies);
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
  const { user, loginWithGoogle, loginWithApple } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const apercu = new URLSearchParams(location.search).has('apercu');

  // Depuis la connexion de l'app (« Créer un compte », ConnexionAppli.jsx) : droit au choix du profil, présélectionné
  // quand un lien d'inscription le donnait ; `from` ramène là où l'on voulait aller (un commerce touché sans compte).
  // Sinon, un accueil laissé en route sans compte reprend là où il s'était arrêté (lireReprise, bienvenue.js).
  const [reprise] = useState(() => (location.state?.depart ? null : lireReprise()));
  // « Créer un compte » quand l'accueil a DÉJÀ été fait sur ce téléphone (bienvenue.js, lireParcoursFait) : on reprend à
  // l'écran du compte, avec le profil et les réponses d'alors — sauf si un autre profil est demandé (lien d'inscription).
  const [dejaFait] = useState(() => {
    if (location.state?.depart !== 'profil') return null;
    const fait = lireParcoursFait();
    const voulu = location.state?.role;
    return fait && (!voulu || voulu === fait.role) ? fait : null;
  });
  // Apple / Google sans compte, depuis la connexion (ConnexionAppli.jsx) : le jeton est gardé, l'accueil ne le jette plus.
  const fedRecu = location.state?.fed || null;
  const depart = dejaFait ? (fedRecu ? 'inscription' : 'compte') : location.state?.depart === 'profil' ? 'profil' : reprise?.ecran || 'accueil';
  const depuis = location.state?.from || null;
  const [ecran, setEcran] = useState(depart);
  const [historique, setHistorique] = useState(() => (dejaFait ? ['accueil', 'profil'] : Array.isArray(reprise?.historique) ? reprise.historique : []));
  // Sens du dernier passage d'écran : en reculant, l'écran revient par la gauche, d'où il était parti (cohérence
  // spatiale, plan du 2026-10-13). Avant, tout arrivait par la droite, retour compris.
  const [recule, setRecule] = useState(false);
  const [role, setRole] = useState(() => (dejaFait ? dejaFait.role : ['client', 'driver', 'restaurant'].includes(location.state?.role) ? location.state.role
    : ['client', 'driver', 'restaurant'].includes(reprise?.role) ? reprise.role : null));
  const [buts, setButs] = useState(() => (Array.isArray(reprise?.buts) ? reprise.buts : []));
  const [freins, setFreins] = useState(() => (Array.isArray(reprise?.freins) ? reprise.freins : []));
  const [envies, setEnvies] = useState(() => (Array.isArray(dejaFait?.envies) ? dejaFait.envies : Array.isArray(reprise?.envies) ? reprise.envies : []));
  const [position, setPosition] = useState(() => dejaFait?.position || reprise?.position || null);
  const [cp, setCp] = useState(() => dejaFait?.cp || reprise?.cp || '');
  const [liste, setListe] = useState(null);
  const [attente, setAttente] = useState(false);
  // Jeton Apple / Google d'une personne qui n'a pas encore de compte : l'inscription s'en sert au lieu d'un mot de passe.
  const [fed, setFed] = useState(fedRecu);

  const communeCp = cp.length === 4 ? communeDepuisCodePostal(cp) : '';
  const parcours = useMemo(() => ['accueil', 'profil', ...(role ? PARCOURS[role] : [])], [role]);
  const resultats = useMemo(() => (liste ? trierCommerces(liste, { position, commune: communeCp, envies }) : []), [liste, position, communeCp, envies]);
  const points = useMemo(() => pointsDuCercle(resultats, position), [resultats, position]);

  // La liste des commerces part dès l'écran « Pourquoi » : au chargement, elle est souvent déjà là.
  useEffect(() => {
    if (role !== 'client' || liste || !['pourquoi', 'envies', 'position', 'codePostal', 'recherche', 'compte', 'inscription'].includes(ecran)) return;
    api('/restaurants').then((r) => setListe(Array.isArray(r) ? r : [])).catch(() => setListe([]));
  }, [role, ecran, liste]);

  // On retient où en est l'accueil, à chaque écran, pour le reprendre si l'application est fermée avant le compte
  // (bienvenue.js, lireReprise). Le chargement repart toujours sur l'écran du compte (il ne fait qu'y mener) ; l'inscription
  // par Apple ou Google aussi, son jeton n'étant pas gardé : la personne retouche simplement le bouton.
  useEffect(() => {
    if (user) return;
    const etape = ecran === 'recherche' || (ecran === 'inscription' && fed) ? 'compte' : ecran;
    const passe = historique.filter((e) => e !== 'recherche' && e !== 'inscription');
    ecrireReprise({
      ecran: etape, historique: passe[passe.length - 1] === etape ? passe.slice(0, -1) : passe,
      role, buts, freins, envies, position, cp
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, role, buts, freins, envies, position, cp, fed]);

  // Arrivé à l'écran du compte (ou à l'inscription par Apple / Google) : l'accueil est fait, il ne sera pas rejoué.
  useEffect(() => {
    if ((ecran === 'compte' || ecran === 'inscription') && role) ecrireParcoursFait({ role, envies, position, cp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, role]);

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

  // Pendant l'inscription, c'est elle qui choisit où arriver une fois le compte ouvert (son espace, pas l'accueil).
  if (user && ecran !== 'inscription') return <Navigate to="/" replace />;
  if (!experienceApp() && !apercu) return <Navigate to="/" replace />;

  function aller(vers, { sansHistorique = false } = {}) {
    // Jeton Apple / Google déjà en main (venu de la connexion) : l'écran du compte ne redemanderait que lui.
    const suivant = vers === 'compte' && fed ? 'inscription' : vers;
    if (!sansHistorique) setHistorique((h) => [...h, ecran]);
    setRecule(false);
    setEcran(suivant);
    window.scrollTo(0, 0);
  }
  const suivant = () => aller(parcours[parcours.indexOf(ecran) + 1]);
  function retour() {
    const h = [...historique];
    let precedent = h.pop();
    while (precedent === 'recherche') precedent = h.pop(); // il repartirait tout seul vers l'avant
    setHistorique(h);
    setRecule(true);
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
      // codePostal : repris par l'inscription (Auth.jsx) pour ne pas redemander ce qui vient d'être tapé.
      vu: true, role, envies, commune: communeCp || null, codePostal: communeCp ? cp : null, position: position || null,
      amorceNotifs: 'a-faire'
    });
  }
  // Apple / Google : le compte existe → session ouverte (la garde plus haut renvoie à l'accueil) ; il n'existe pas encore
  // (INCOMPLETE_PROFILE) → l'inscription de l'application, sans e-mail ni mot de passe à donner. Seul un compte protégé par
  // un second facteur passe par /login, qui sait demander le code (Auth.jsx traite le jeton reçu dans `state`).
  async function viaFournisseur(fournisseur) {
    setAttente(true);
    try {
      const jeton = await connexionFournisseur(fournisseur);
      memoriser();
      try {
        if (jeton.fournisseur === 'apple') await loginWithApple(jeton.jeton, role, { givenName: jeton.prenom || undefined, familyName: jeton.nom || undefined });
        else await loginWithGoogle(jeton.jeton, role, {});
      } catch (err) {
        if (err.message === 'INCOMPLETE_PROFILE') { setFed(jeton); aller('inscription'); return; }
        if (err.code === 'TOTP_REQUIRED') { navigate('/login', { state: { fed: jeton } }); return; }
        toast(err.message, 'erreur');
      }
    } catch (err) {
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) toast(err?.message ? `${t('appli.nativeLoginFailed')} (${err.message})` : t('appli.nativeLoginFailed'), 'erreur');
    } finally {
      setAttente(false);
    }
  }
  const viaEmail = () => { memoriser(); setFed(null); aller('inscription'); };
  const dejaInscrit = () => { ecrireBienvenue({ vu: true, amorceNotifs: 'a-faire' }); navigate('/login'); };

  // L'accueil a rejoint le bandeau iris le 2026-10-16 (version B2 de mockups/accueil-appli.html) : slogan sur l'iris, le
  // reste dans la feuille blanche, comme les écrans suivants.
  const fondIris = ['recherche', 'lvPromesses', 'coPromesses'].includes(ecran);
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
      contenu = <EcranPourquoi onSuite={suivant} />; break;
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
      contenu = <EcranRecherche commune={position ? '' : communeCp} points={liste ? points : []} envies={envies} duree={DUREE_RECHERCHE_MS} />; break;
    case 'compte':
      contenu = (
        <EcranCompte role={role} resultats={resultats} avecPosition={!!position} commune={communeCp} attente={attente}
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

  // L'inscription a ses propres écrans (en-tête, progression, animation) : elle rend tout le plein écran.
  if (ecran === 'inscription') return <InscriptionAppli role={role} fed={fed} depuis={depuis} onQuitter={retour} onConnexion={dejaInscrit} />;

  return (
    // Les écrans blancs ont un bandeau iris en haut et une feuille blanche dessous (EcransBienvenue.jsx, Feuille).
    <div className={`bv${fondIris ? ' bv-iris' : ' bv-bandeau'}`}>
      <main className={`bv-ecran${recule ? ' bv-ecran--retour' : ''}`} key={ecran}>
        {!sansHaut && <Haut onRetour={retour} progression={progression} onPasser={passerQuestions} />}
        {contenu}
      </main>
    </div>
  );
}
