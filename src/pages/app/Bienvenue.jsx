import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../api';
import { CHEMIN_LISTE } from '../../resumeCarte';
import { experienceApp, demanderPosition, autoriserPosition, connexionFournisseur } from '../../natif';
import { communeDepuisCodePostal, communeRingDistance, haversineDistanceKm } from '../../menuCategories';
import { ecrireBienvenue, ecrireReprise, lireReprise, lireParcoursFait, ecrireParcoursFait } from '../../bienvenue';
import { repondAuxEnvies } from '../../envies';
import { FAMILLES, famillesCommerce } from '../../specialites';
import {
  Haut, EcranAccueil, EcranProfil, EcranQuestion, EcranPourquoi, EcranEnvies, EcranCodePostal,
  EcranRecherche, EcranCompte, EcranPromesses, BarresCommande
} from './EcransBienvenue';
import InscriptionAppli from './InscriptionAppli';

/* ACCUEIL DE L'APPLICATION iOS / ANDROID — /bienvenue, premier lancement seulement.
 *
 * Conçu avec le skill app-onboarding-questionnaire et validé sur maquette par le fondateur le 2026-10-11
 * (maquettes/app-onboarding/app-onboarding.html, à garder en phase). Le site n'est pas touché : Home.jsx n'envoie ici que dans
 * l'application (estNatif()), et un visiteur de fairride.be qui taperait l'adresse retombe sur l'accueil — sauf
 * avec ?apercu, pour pouvoir le relire dans un navigateur (npm run dev).
 *
 * CE QUI A ÉTÉ ADAPTÉ DU CADRE DU SKILL, ET POURQUOI
 *   - Pas de paywall : le client ne paie pas l'application ; l'abonnement commerce est offert au lancement.
 *   - Pas d'avis inventés ni de chiffres de démonstration : seulement des faits vérifiables (voir EcransBienvenue).
 *   - Trois parcours après « Tu es… » : le client a tout ; livreur et commerce ont un écran de promesses puis le
 *     compte — leur vrai parcours (dossier livreur, fiche commerce) existe déjà après l'inscription.
 *   - Pas de démo « choisis 3 commerces » ni de partage (retirés par le fondateur, « trop long ») : la position
 *     mène au chargement, puis aux commerces qui livrent vraiment chez toi, au-dessus des boutons de compte.
 *   - PLUS COURT DEPUIS LE 2026-10-22 (des testeurs le trouvaient trop long ; version retenue de
 *     maquettes/onboarding-court/onboarding-court.html) : une seule question au lieu de « ce qui compte », « ce qui agace »,
 *     trois cartes à glisser et « une envie en particulier ? ». Le client passe 5 écrans avant le compte au lieu de 8 et
 *     3 cartes. Chacun voit d'abord ce qu'il y gagne : le client son argent, le livreur ce qu'il touche, le commerce ce que
 *     la plateforme lui prend.
 *   - « TU AS ENVIE DE QUOI ? » REVIENT LE 2026-10-25 (fondateur, version A de maquettes/onboarding-gouts/onboarding-gouts.html :
 *     « les gens qui sentent que c'est fait pour eux restent ») — mais APRÈS le chargement, avec les vraies familles
 *     (specialites.js) qui ont un commerce qui livre chez toi (sans leur nombre depuis le 2026-10-28), au lieu de 6 envies larges avant la position. Le
 *     résultat compte alors « N commerces pour toi », ceux-là d'abord. Rien d'autre depuis le 2026-10-26 (fondateur : « juste pour
 *     le plaisir ») : la page Restaurants ne les lit plus (envies.js). Sauté quand rien ne livre. 6 écrans.
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
 * (décision du fondateur). */

const PARCOURS = {
  // Plus d'écran « position » (fondateur, 2026-10-27, P1 de maquettes/badge-position/badge-position.html) : « Trouver mes
  // restaurants » pose directement la question du système. Le code postal ne vient qu'après un refus (ou un GPS muet).
  client: ['question', 'pourquoi', 'codePostal', 'recherche', 'envies', 'compte'],
  // Plus d'écran « position » pour le livreur (fondateur, 2026-10-21, décision 10) : elle est demandée juste avant son
  // premier « Disponible », avec la même explication (components/livreur/PositionRequise.jsx), jamais à l'inscription.
  driver: ['lvPromesses', 'compte'],
  restaurant: ['coPromesses', 'compte']
};
// Les réponses possibles à la seule question (QUESTION, EcransBienvenue.jsx) : une reprise n'en garde pas d'autre.
// « promo » remplace « ici » (que mon argent reste ici) le 2026-10-26 : une reprise qui avait gardé « ici » repart sans choix.
const CHOIX = ['prix', 'total', 'promo'];
// Un accueil laissé en route avant le 2026-10-22 reprend sur l'écran qui a remplacé le sien. `lvPosition` (position du
// livreur, retirée le 2026-10-21) manquait : un livreur arrêté là rouvrait l'app sur un écran vide (revue du 24/10).
// `envies` n'y est plus depuis le 2026-10-25 : l'écran existe de nouveau (après le chargement), on y reprend. `position` (écran
// retiré le 2026-10-27) reprend sur « Sur Fairride, c'est réglé », dont le bouton pose maintenant la question.
const ECRANS_RETIRES = { buts: 'question', freins: 'question', cartes: 'question', lvPosition: 'lvPromesses', position: 'pourquoi' };
const CLES_FAMILLES = new Set(FAMILLES.map((f) => f.cle));
const famillesValides = (l) => (Array.isArray(l) ? l.filter((f) => CLES_FAMILLES.has(f)) : []);
// Les écrans que le `switch` plus bas sait dessiner, plus l'inscription. Un écran gardé qui n'en fait pas partie (retiré
// un jour sans entrée dans ECRANS_RETIRES, stockage abîmé) reprend à l'accueil au lieu d'un écran vide.
const ECRANS = new Set(['accueil', 'profil', 'inscription', ...Object.values(PARCOURS).flat()]);
const ecranValide = (e) => {
  const v = ECRANS_RETIRES[e] || e;
  return ECRANS.has(v) ? v : null;
};
// Le chargement que le fondateur aime, assez long pour se lire (2026-10-16 : « 2 secondes de plus ») : depuis le 2026-10-27
// (R1 de maquettes/badge-position/badge-position.html), trois VRAIES lignes, cochées chacune quand c'est fait (la position,
// la liste, l'ordre), à une seconde au moins l'une de l'autre, puis un temps pour lire la dernière. Avant : deux lignes
// cochées à heure fixe et 3,8 s d'attente quoi qu'il arrive, après jusqu'à 10 s de GPS sur un bouton « Chargement… ».
const PAS_RECHERCHE_MS = 1000;
const FIN_RECHERCHE_MS = 700;
// Le GPS est attendu sur l'écran de chargement, 6 s au plus ; ensuite le code postal (demanderPosition, natif.js).
const DELAI_POSITION_MS = 6000;

// Commerces qui livrent à cette position (ou, sans position, rangés par proximité de commune), tes envies d'abord.
function trierCommerces(liste, { position, commune, envies }) {
  let items = liste.map((r) => ({
    r,
    km: position && r.lat !== null && r.lng !== null ? haversineDistanceKm(position.lat, position.lng, r.lat, r.lng) : null,
    envie: repondAuxEnvies(r, envies)
  }));
  if (position) items = items.filter((x) => x.km !== null && x.km <= (x.r.deliveryRadiusKm ?? 6));
  const proximite = (x) => (position ? x.km : communeRingDistance(commune, x.r.commune));
  return items.sort((a, b) => (Number(b.envie) - Number(a.envie)) || (proximite(a) - proximite(b)));
}

// Les familles proposées à « Tu as envie de quoi ? » : celles des commerces trouvés, les plus fournies d'abord (à égalité,
// l'ordre de la bande des cuisines). Le nombre ne sert plus qu'à les ranger : l'écran ne l'affiche plus (2026-10-28).
function famillesTrouvees(items) {
  const n = {};
  items.forEach(({ r }) => famillesCommerce(r).forEach((f) => { n[f] = (n[f] || 0) + 1; }));
  return FAMILLES.filter((f) => n[f.cle]).map((f) => [f.cle, n[f.cle]]).sort((a, b) => b[1] - a[1]);
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
  const depart = dejaFait ? (fedRecu ? 'inscription' : 'compte') : location.state?.depart === 'profil' ? 'profil'
    : ecranValide(reprise?.ecran) || 'accueil';
  const depuis = location.state?.from || null;
  const [ecran, setEcran] = useState(depart);
  const [historique, setHistorique] = useState(() => (dejaFait ? ['accueil', 'profil']
    : Array.isArray(reprise?.historique) ? reprise.historique.filter((e) => !ECRANS_RETIRES[e] && ECRANS.has(e)) : []));
  // Sens du dernier passage d'écran : en reculant, l'écran revient par la gauche, d'où il était parti (cohérence
  // spatiale, plan du 2026-10-13). Avant, tout arrivait par la droite, retour compris.
  const [recule, setRecule] = useState(false);
  const [role, setRole] = useState(() => (dejaFait ? dejaFait.role : ['client', 'driver', 'restaurant'].includes(location.state?.role) ? location.state.role
    : ['client', 'driver', 'restaurant'].includes(reprise?.role) ? reprise.role : null));
  // La réponse à la seule question (EcransBienvenue.jsx, QUESTION) : sa carte passe en tête de « Ce que tu y gagnes ».
  const [choix, setChoix] = useState(() => (CHOIX.includes(reprise?.choix) ? reprise.choix : null));
  // Les familles cochées à « Tu as envie de quoi ? » (EcranEnvies), dans l'ordre où elles l'ont été.
  const [envies, setEnvies] = useState(() => famillesValides(dejaFait?.familles || reprise?.familles));
  const [position, setPosition] = useState(() => dejaFait?.position || reprise?.position || null);
  const [cp, setCp] = useState(() => dejaFait?.cp || reprise?.cp || '');
  const [liste, setListe] = useState(null);
  // La liste n'a pas pu se charger (réseau) : à ne pas confondre avec une liste vide (audit du 19/10, auth-22).
  const [listeEchec, setListeEchec] = useState(false);
  // Code d'un lien de parrainage (?ref=), transmis par la connexion de l'app (audit du 19/10, auth-28).
  const [codeParrain] = useState(() => location.state?.ref || null);
  const [attente, setAttente] = useState(false);
  // Jeton Apple / Google d'une personne qui n'a pas encore de compte : l'inscription s'en sert au lieu d'un mot de passe.
  const [fed, setFed] = useState(fedRecu);
  // La position est autorisée et le GPS cherche encore : la première ligne du chargement attend.
  const [lecturePosition, setLecturePosition] = useState(false);
  // Lignes du chargement déjà cochées (0 à 3), et où en est le pas à pas (gardé d'un rendu à l'autre).
  const [lignesFaites, setLignesFaites] = useState(0);
  const pasRecherche = useRef({ coche: 0, depuis: 0 });

  const communeCp = cp.length === 4 ? communeDepuisCodePostal(cp) : '';
  const parcours = useMemo(() => ['accueil', 'profil', ...(role ? PARCOURS[role] : [])], [role]);
  const resultats = useMemo(() => (liste ? trierCommerces(liste, { position, commune: communeCp, envies }) : []), [liste, position, communeCp, envies]);
  const familles = useMemo(() => famillesTrouvees(resultats), [resultats]);
  const points = useMemo(() => pointsDuCercle(resultats, position), [resultats, position]);

  // La liste des commerces part dès l'écran « Pourquoi » : au chargement, elle est souvent déjà là.
  useEffect(() => {
    if (role !== 'client' || liste || !['pourquoi', 'codePostal', 'recherche', 'envies', 'compte', 'inscription'].includes(ecran)) return;
    api(CHEMIN_LISTE).then((r) => setListe(Array.isArray(r) ? r : [])).catch(() => { setListeEchec(true); setListe([]); });
  }, [role, ecran, liste]);

  // On retient où en est l'accueil, à chaque écran, pour le reprendre si l'application est fermée avant le compte
  // (bienvenue.js, lireReprise). Le chargement repart sur « Tu as envie de quoi ? » (il ne fait qu'y mener) ; l'inscription
  // par Apple ou Google sur l'écran du compte, son jeton n'étant pas gardé : la personne retouche simplement le bouton.
  useEffect(() => {
    if (user) return;
    const etape = ecran === 'recherche' ? 'envies' : ecran === 'inscription' && fed ? 'compte' : ecran;
    const passe = historique.filter((e) => e !== 'recherche' && e !== 'inscription');
    ecrireReprise({
      ecran: etape, historique: passe[passe.length - 1] === etape ? passe.slice(0, -1) : passe,
      role, choix, familles: envies, position, cp
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, role, choix, envies, position, cp, fed]);

  // Arrivé à l'écran du compte (ou à l'inscription par Apple / Google) : l'accueil est fait, il ne sera pas rejoué.
  useEffect(() => {
    if ((ecran === 'compte' || ecran === 'inscription') && role) ecrireParcoursFait({ role, familles: envies, position, cp });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, role]);

  // Chargement, ligne par ligne (PAS_RECHERCHE_MS) : 1. la position trouvée (ou la commune du code postal), 2. la liste arrivée,
  // avec le nombre de commerces qui livrent, 3. « les plus proches d'abord » ; puis l'écran suivant. Le pas à pas repart de
  // zéro à chaque entrée sur l'écran, et survit aux rendus qu'amènent la position et la liste. performance.now() et pas Date.now() :
  // une horloge qui ne recule ni ne saute quand l'heure du téléphone change.
  useEffect(() => {
    if (ecran !== 'recherche') return;
    pasRecherche.current = { coche: 0, depuis: performance.now() };
    setLignesFaites(0);
  }, [ecran]);
  useEffect(() => {
    if (ecran !== 'recherche') return undefined;
    const pas = pasRecherche.current;
    const prete = (n) => (n === 0 ? !lecturePosition : n === 1 ? !!liste : true);
    let fini = false; let minuteur;
    const verifier = () => {
      if (fini) return;
      if (pas.coche < 3 && prete(pas.coche) && performance.now() - pas.depuis >= PAS_RECHERCHE_MS) {
        pas.coche += 1; pas.depuis = performance.now(); setLignesFaites(pas.coche);
      }
      if (pas.coche === 3 && performance.now() - pas.depuis >= FIN_RECHERCHE_MS) { fini = true; aller(apresRecherche(), { sansHistorique: true }); return; }
      minuteur = setTimeout(verifier, 120);
    };
    verifier();
    return () => { fini = true; clearTimeout(minuteur); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, liste, lecturePosition]);

  // Repris sur « Tu as envie de quoi ? » (application rouverte) alors que rien ne livre, ou liste illisible : au compte.
  useEffect(() => {
    if (ecran === 'envies' && liste && apresRecherche() === 'compte') aller('compte', { sansHistorique: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, liste]);

  // Pendant l'inscription, c'est elle qui choisit où arriver une fois le compte ouvert (son espace, pas l'accueil).
  // Venu d'un commerce touché sans compte : Apple / Google qui ouvre un compte existant y ramène (audit du 19/10, auth-07).
  if (user && ecran !== 'inscription') return <Navigate to={depuis || '/'} replace />;
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
  // Après le chargement : « Tu as envie de quoi ? », sauf s'il n'y a aucune famille à proposer (rien ne livre, liste illisible).
  function apresRecherche() { return familles.length && !listeEchec ? 'envies' : 'compte'; }
  const basculerEnvie = (cle) => setEnvies((l) => (l.includes(cle) ? l.filter((x) => x !== cle) : [...l, cle]));
  function retour() {
    const h = [...historique];
    let precedent = h.pop();
    while (precedent === 'recherche') precedent = h.pop(); // il repartirait tout seul vers l'avant
    setHistorique(h);
    setRecule(true);
    setEcran(precedent || 'accueil');
  }
  // Tant qu'aucun profil n'est choisi, le parcours ne compte que deux écrans : « Tu es… » aurait affiché une barre
  // pleine (retour du fondateur, 2026-10-11). On mesure donc sur le parcours le plus long, celui du client.
  const mesure = role ? parcours : ['accueil', 'profil', ...PARCOURS.client];
  const progression = Math.max(0, mesure.indexOf(ecran)) / (mesure.length - 1);

  // Le client seulement depuis le 2026-10-21 : le livreur n'a plus d'écran de position dans l'accueil (voir PARCOURS).
  // « Trouver mes restaurants » pose la question du système (2026-10-27) ; oui : le chargement s'ouvre tout de suite et y attend
  // le GPS ; non : le code postal. Un GPS muet après DELAI_POSITION_MS mène aussi au code postal.
  async function utiliserPosition() {
    setAttente(true);
    const autorisee = await autoriserPosition();
    setAttente(false);
    if (!autorisee) { aller('codePostal'); return; }
    setPosition(null);
    setLecturePosition(true);
    aller('recherche');
    const p = await demanderPosition({ delai: DELAI_POSITION_MS });
    setLecturePosition(false);
    if (p) setPosition(p);
    else { toast(t('appli.posEchec')); aller('codePostal', { sansHistorique: true }); }
  }

  // Les trois lignes du chargement : ce qu'on attend, puis ce qu'on a trouvé une fois la ligne cochée.
  function lignesRecherche() {
    const parGps = !!position || lecturePosition;
    const n = resultats.length;
    return [
      parGps ? t(lignesFaites > 0 ? 'appli.calcPosition' : 'appli.calcPosAttente') : t('appli.calcCommune', { c: communeCp }),
      // Sans position (code postal), la liste n'est pas filtrée par rayon : on dit combien on en a trouvé, pas qu'ils livrent.
      lignesFaites > 1 ? (n === 0 ? t('appli.calcN0') : !parGps ? t(n === 1 ? 'appli.calcTrouve1' : 'appli.calcTrouves', { n })
        : n === 1 ? t('appli.calcN1') : t('appli.calcN', { n })) : t('appli.calc1'),
      t('appli.calc3')
    ];
  }

  // On quitte l'accueil pour la page de connexion : on retient ce qui sert après (Home.jsx, AmorceNotifications.jsx).
  function memoriser() {
    ecrireBienvenue({
      // codePostal : repris par l'inscription (Auth.jsx) pour ne pas redemander ce qui vient d'être tapé.
      // familles : « Tu as envie de quoi ? » (envies.js), gardées sans effet ailleurs depuis le 2026-10-26 ; [] efface d'anciennes envies.
      vu: true, role, familles: envies, commune: communeCp || null, codePostal: communeCp ? cp : null, position: position || null,
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
        // Inscription déjà faite, code SMS jamais saisi : on le demande (connexion, écran du code ; « Renvoyer » y est).
        // Le jeton suit (preuve) : il prouve le compte si le numéro est à changer (auth-03) ; `from` aussi (auth-07).
        if (err.message === 'PHONE_NOT_VERIFIED') { navigate('/login', { state: { from: depuis || undefined, attenteCode: { email: err.data?.email, canal: 'sms', telephone: err.data?.phoneMasked, preuve: { fournisseur: jeton.fournisseur, jeton: jeton.jeton } } } }); return; }
        if (err.code === 'TOTP_REQUIRED') { navigate('/login', { state: { from: depuis || undefined, fed: jeton } }); return; }
        toast(err.message, 'erreur');
      }
    } catch (err) {
      // Le texte brut du greffon (« com.google.android.gms…: 10: ») n'est plus collé au message (audit du 19/10, CROSS-13) : il
      // part dans la console (adb logcat) ; un refus du serveur (ApiError, avec un statut) garde son propre texte, traduit.
      if (!/annul|cancel|1001|12501/i.test(err?.message || '')) {
        if (!err?.status) console.error('Connexion native :', err);
        toast(err?.status && err?.message ? err.message : t('appli.nativeLoginFailed'), 'erreur');
      }
    } finally {
      setAttente(false);
    }
  }
  const viaEmail = () => { memoriser(); setFed(null); aller('inscription'); };
  // « J'ai déjà un compte » garde le commerce touché sans compte (`from`) : la connexion y ramène (audit du 19/10, auth-07).
  const dejaInscrit = () => { ecrireBienvenue({ vu: true, amorceNotifs: 'a-faire', ...(envies.length ? { familles: envies } : {}) }); navigate('/login', depuis ? { state: { from: depuis } } : undefined); };

  // L'accueil a rejoint le bandeau iris le 2026-10-16 (version B2 de maquettes/accueil-appli/accueil-appli.html) : slogan sur l'iris, le
  // reste dans la feuille blanche, comme les écrans suivants.
  const fondIris = ['recherche', 'lvPromesses', 'coPromesses'].includes(ecran);
  const sansHaut = ['accueil', 'recherche'].includes(ecran);
  // « Passer » saute la question, jamais le message : on atterrit sur « Ce que tu y gagnes ». Sur les envies : rien de coché.
  const passerQuestions = ecran === 'question' ? () => aller('pourquoi')
    : ecran === 'envies' ? () => { setEnvies([]); aller('compte'); } : null;

  let contenu;
  switch (ecran) {
    case 'accueil':
      contenu = <EcranAccueil onCommencer={() => aller('profil')} onConnexion={dejaInscrit} />; break;
    case 'profil':
      contenu = <EcranProfil role={role} onChoix={setRole} onSuite={suivant} />; break;
    case 'question':
      contenu = <EcranQuestion choix={choix} onChoix={setChoix} onSuite={suivant} />; break;
    case 'pourquoi':
      contenu = <EcranPourquoi onSuite={utiliserPosition} attente={attente} premier={choix} />; break;
    case 'codePostal':
      contenu = <EcranCodePostal cp={cp} commune={communeCp} onCp={setCp} onSuite={() => { setPosition(null); aller('recherche'); }} />; break;
    case 'recherche':
      contenu = <EcranRecherche commune={position ? '' : communeCp} points={lignesFaites > 1 ? points : []} lignes={lignesRecherche()} faites={lignesFaites} />; break;
    case 'envies':
      contenu = (
        <EcranEnvies familles={familles} choisies={envies} nPourToi={resultats.filter((x) => x.envie).length}
          onBasculer={basculerEnvie} onSuite={suivant} />
      ); break;
    case 'compte':
      contenu = (
        <EcranCompte role={role} resultats={resultats} envies={envies} listeEchec={listeEchec} avecPosition={!!position} commune={communeCp} attente={attente}
          onFournisseur={viaFournisseur} onEmail={viaEmail} onConnexion={dejaInscrit} />
      ); break;
    case 'lvPromesses':
      contenu = (
        <EcranPromesses chip={t('appli.lvChip')} chipIcone="velo" titre={t('appli.lvTitre')} bouton={t('appli.lvBtn')} onSuite={suivant} ligneBe
          faits={[['euro', t('appli.lvGain'), t('appli.lvGainS')], ['cadeau', t('appli.lv3'), t('appli.lv3S')], ['horloge', t('appli.lv1'), t('appli.lv1S')],
            ['bouclier', t('appli.lv4'), t('appli.lv4S')]]} />
      ); break;
    case 'coPromesses':
      contenu = (
        <EcranPromesses chip={t('appli.coChip')} chipIcone="be" titre={t('appli.coTitre')} bouton={t('appli.coBtn')} onSuite={suivant}
          barres={<BarresCommande />} faits={[['euro', t('appli.co1'), t('appli.co1S')], ['cadeau', t('appli.co2'), t('appli.co2S')]]} />
      ); break;
    default:
      contenu = null;
  }

  // L'inscription a ses propres écrans (en-tête, progression, animation) : elle rend tout le plein écran.
  if (ecran === 'inscription') return <InscriptionAppli role={role} fed={fed} depuis={depuis} codeParrain={codeParrain} onQuitter={retour} onConnexion={dejaInscrit} />;

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
