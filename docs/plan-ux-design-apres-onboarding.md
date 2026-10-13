# Étendre le langage de l'onboarding au reste de l'app : analyse et plan

*12 octobre 2026, révisé le 13 avec les principes d'Apple (« Designing Fluid Interfaces », WWDC 2018 ;
« Principles of Great Design »). Analyse faite en lisant le code (`main` + `feat/app-onboarding`) et la maquette
`mockups/app-onboarding.html`, pas en naviguant : chaque point « à vérifier » se regarde dans le navigateur avant
d'être codé.*

**Les deux fils du plan :** moins de clics, et du mouvement qui a l'air physique. **Une contrainte décide de
tout le reste :** le site web ne doit pas devenir plus lent. Le mouvement coûteux (gestes, ressorts en
JavaScript) ne vit donc **que dans l'app iOS / Android**, derrière `estNatif()`. Le site garde seulement ce qui
ne coûte rien.

---

## 1. Ce qui fait que l'onboarding fonctionne

| Principe | Comment la maquette le fait |
|---|---|
| **Une décision par écran** | Un titre de 30 px, une phrase grise, des choix, un bouton en bas. |
| **Un en-tête unique** | Retour rond · barre de progression 4 px · FR/NL/EN. Toujours au même endroit. |
| **Trois boutons** | Pilule pleine largeur : lime (décisif), iris (continuer), contour (secondaire) + un lien. |
| **Choix = rangée avec tuile** | `.opt` : icône en filet, libellé + sous-libellé, case ; sélectionné = rangée iris. |
| **Icônes en traits seulement** | Tracés d'`Icone.jsx`, jamais d'emoji. |
| **L'iris comme moment** | Écrans pleins en iris pour les promesses ; le reste en blanc. |
| **Expliquer avant de demander** | Position et notifications : à quoi ça sert, et ce qui n'arrive *pas*. |
| **Une liste d'étapes visible** | « Votre dossier » / « Avant d'être en ligne » : on sait ce qui reste. |

## 2. Mesures du reste de l'app

| Mesure | Valeur |
|---|---|
| Fichiers `.jsx` avec des emojis | **116** (SalesPage 63, driver/Onboarding 23, AdminCouriers 21, Auth 20, AdminRestaurants 20, restaurant/OrdersPage 19). `Icone` n'est utilisé que dans 32 fichiers. |
| `style={{…}}` dans les composants | **3 109** (Auth 91, SalesPage 90, AdminRestaurants 89, Account 85) |
| Classes de boutons | **13**, dont `btn-ghost` ×315 en **12 px** |
| Couleurs hors palette dans les `.jsx` | `#2e7d32`, `#F5B800`, `#E6E2D6`, `#3B7DD8`, `#E07A1F`… ; bordure `#A9CE2A` sur `.btn-gold` |
| Rayon des cartes | 16 px dans styles.css, 20 px dans la maquette et le CLAUDE.md |
| Motifs d'« étapes » | 3 différents : `auth-step-bar`, `courier-steps` (onglets numérotés, `✓` en texte), `bv-progression` |
| Animations CSS | 34 `@keyframes`, 48 `transition`. Une règle globale `prefers-reduced-motion` existe déjà (styles.css, « Mouvement réduit : une seule règle ») : à garder telle quelle. |

---

## 3. Moins de clics — les parcours qui peuvent raccourcir

Principe d'Apple appliqué : **simplicité, pas minimalisme**. On ne cache rien ; on retire les étapes qui
redemandent une chose déjà sue, ou qui confirment une chose déjà vue.

| # | Parcours | Aujourd'hui | Cible | Comment |
|---|---|---|---|---|
| C1 | **Commander** (client) | `+` → pilule panier → `/panier` « Passer commande » → `/checkout` « Commander et payer » → carte « Confirme ta commande » (case à cocher + bouton) → Stripe : **5 appuis + 1 case** | **3 appuis** : `+` → pilule → « Commander et payer » → Stripe | Voir C1 ci-dessous. |
| C2 | **S'inscrire après l'onboarding** (client) | L'onboarding connaît la commune et les envies ; l'inscription (`STEP_KEYS.client`) redemande l'adresse | Préremplir. Apple / Google = un appui, puis directement la liste | L'adresse exacte se demande au checkout, où elle sert (c'est déjà ce que dit l'onboarding : « L'adresse exacte, ce sera au moment de commander »). |
| C3 | **Envies** (client) | Choisies dans l'onboarding, puis oubliées par `RestaurantList` (qui ne range que par `communeProche`) | Elles rangent la liste | Lire l'état mémorisé par `ecrireBienvenue`. Mettre `/classement` à jour dans le même commit (CLAUDE.md). |
| R1 | **Inscription commerce** | ✅ **Fait par le fondateur** (`feat/conformite-avocat-front`, 180d075) : 6 écrans courts, numéro d'entreprise demandé tout de suite (raison sociale et TVA déduites), « Configurer mes paiements » mène droit à Stripe | — | Choix assumé : demander le numéro d'entreprise à l'inscription économise l'étape Stripe ensuite. Ne pas revenir à « 3 champs ». Reste à aligner le texte de l'onboarding (« Trois choses pour commencer ») sur ce parcours. |
| L1 | **Dossier livreur** | ✅ En partie fait (même commit) : écran 2 réduit au statut, numéro d'entreprise, véhicule ; dossier ouvert sur « Prochaine étape » | Reste la forme : une question par écran avec l'en-tête de l'onboarding | Les textes de conformité ne bougent pas. |
| L2 | **Course** (livreur, app seulement) | Boutons « Récupérée » / « Livrée » | **Glisser pour confirmer** | Un appui accidentel dans une poche ne valide rien ; un glissement est délibéré, et il remplace un appui plus une confirmation. |

**Ce qu'on ne raccourcit pas, exprès :** l'acceptation d'une commande avec allergie (ConfirmDialog, A1), la
case d'âge pour l'alcool, l'acceptation des CGU, le libellé « Commander et payer » (CDE VI.46 §2), le double
geste Approuver / Publier de l'admin. Ce sont des engagements, et Apple le dit aussi : une confirmation n'a sa
place que pour ce qui ne se défait pas — mais là, elle doit rester.

### C1 en détail — pourquoi il y a deux étapes et comment en retirer une

La carte « Confirme ta commande » existe pour une vraie raison, écrite dans `Checkout.jsx` : *les frais de
livraison dépendent de la distance réelle et ne sont connus qu'une fois la commande créée côté serveur*. Le
client voit donc un total estimé, puis le total exact.

- **Côté backend** : une route de devis (`POST /orders/quote`, n'existe pas aujourd'hui) qui renvoie le total
  exact sans créer la commande, avec le même calcul (`fraisService`, minimum livreur, promos). Le checkout
  l'appelle dès que l'adresse est connue ; « Commander et payer » montre alors le vrai total et part
  directement chez Stripe.
- **Sans toucher au backend** (étape intermédiaire) : si le total du serveur est égal au total affiché, passer
  directement au paiement ; ne montrer la carte que quand le total a changé, en surlignant *ce qui* a changé.
- **La case « confirmDeliveryInfo »** : vérifiée le 13/10 — ajoutée le 2026-08-14 comme simple étape de
  validation (commit 8102e23), sans commentaire juridique, jamais vérifiée par le backend. Ni CDE VI.46 §2
  (bouton « Commander et payer » + infos essentielles juste avant) ni XII.7 (pouvoir corriger ses erreurs de
  saisie) n'imposent une case. **Retirée** sur `feat/moins-de-clics-front`, avec l'étape intermédiaire
  ci-dessus. À faire relire par l'avocat avec le reste de la branche conformité.
- **`/panier`** : la pilule peut mener directement au checkout, dont le récapitulatif permet déjà de modifier
  les quantités. À vérifier : ce que `PanierPage` contient de plus (suggestions `UpsellPanier`) et si ça vaut
  un écran.

---

## 4. Le mouvement — web léger, app fluide

### La règle de partage

| | **Site web** (tout le monde) | **App iOS / Android** (`html.natif`, `estNatif()`) |
|---|---|---|
| Ce qui est permis | CSS sur `transform` et `opacity` uniquement (le compositeur s'en charge, rien sur le fil principal) | En plus : gestes suivis au doigt, ressorts en JavaScript, haptique |
| Bibliothèque | **Aucune** | **Aucune non plus** : un petit `ressort.js` écrit à la main (~60 lignes), chargé par `import()` dynamique seulement quand `estNatif()` — **0 octet ajouté au site** |
| Durées | ≤ 200 ms, jamais sur le chemin de l'action | Ressorts : pas de durée fixe, interruptibles |

Pourquoi pas Motion / Framer Motion : une dépendance de plus, téléchargée par tous les visiteurs, alors que les quatre gestes
dont on a besoin tiennent dans une fonction de ressort. C'est le raisonnement déjà écrit en tête d'`Icone.jsx`
(« un seul fichier, pas une bibliothèque »).

Le sélecteur `html.natif` est déjà posé par `natif.js` ; le CSS réservé à l'app s'écrit donc
`html.natif .feuille { … }` sans rien coûter au site.

### 4a. Gratuit, donc sur le web aussi

1. **Réponse à l'appui, pas au relâcher.** `:active { transform: scale(.97); transition: transform 100ms }` sur
   les pilules, rangées `.choix`, cartes de commerce. Coût nul, et c'est le principe n° 1 d'Apple.
2. **Retirer de la latence au lieu d'en ajouter.** `.page-fade` passe un fondu de 220 ms sur *chaque*
   changement de page : sur le web, le ramener à ~120 ms ou le supprimer. Auditer aussi les `setTimeout`
   d'attente dans les parcours (à relever un par un).
3. **Courbes « ressort » en CSS.** Une variable `--ressort` en `linear(…)` (courbe précalculée d'un ressort
   amorti à 1,0) remplace les `cubic-bezier` des feuilles et modales. Même coût qu'un `ease`, mais l'arrivée
   ressemble à un objet qui se pose.
4. **Cohérence spatiale.** Ce qui entre par la droite sort par la droite. Aujourd'hui l'onboarding fait entrer
   *tous* les écrans par la droite, y compris au retour : le retour doit entrer par la gauche. Les feuilles
   (`FichePlat`, `SousEcran`) montent du bas et doivent redescendre vers le bas, pas s'effacer en fondu.
5. **Une pointe de typographie.** Interlettrage selon la taille : `-0.02em` sur les titres (déjà fait), `0` sur
   le corps, `+0.01em` sur les textes ≤ 12 px.

**Refusé, exprès :** les matériaux translucides (`backdrop-filter`) que décrit Apple. Ils coûtent cher au GPU
sur les téléphones modestes, et l'identité « The frame » les interdit (« pas de flou, fonds blanc ou iris,
l'élévation est un filet »). On garde le filet.

### 4b. App seulement — les gestes

Tous reposent sur `ressort.js` : un ressort à deux réglages (amortissement, réponse), qui **part toujours de
la position affichée** et **reprend la vitesse du doigt** — donc interruptible.

| Geste | Où | Réglages (Apple) | Détail |
|---|---|---|---|
| **Feuille qu'on tire vers le bas** | `FichePlat`, `SousEcran`, `CarteSuivi` | amort. 0,8 · réponse 0,3 | Aujourd'hui `FichePlat` suit le doigt puis décide avec un seuil (110 px ou vitesse > 0,6) et relance une `transition` CSS : pas de reprise de vitesse, et un plat qu'on ressaisit pendant qu'il se ferme ne se rattrape pas. → Pointer Events + `setPointerCapture`, projection de l'élan (`v/1000 · 0,998/(1−0,998)`), décision sur le **sens** de la vitesse, ressort lancé à la vitesse du doigt. |
| **Résistance aux bords** | Haut d'une feuille, fin d'un carrousel | — | `rubberband()` : plus on tire, moins ça suit, au lieu d'un arrêt sec. |
| **Retour par glissement depuis le bord** | Toutes les pages de l'app (Android l'a en natif, iOS non dans un webview) | amort. 1,0 · réponse 0,4 | La page suit le doigt, l'écran précédent apparaît dessous. |
| **Cartes à glisser** | Onboarding (« Vous vous reconnaissez ? ») | amort. 0,8 · réponse 0,4 | La carte s'envole dans la direction et à la vitesse du lancer. |
| **Glisser pour confirmer** | Livreur : récupérée, livrée (L2) | amort. 1,0 | Haptique au point de validation (`vibrer`, déjà branché sur `@capacitor/haptics`). |
| **Écrans de l'onboarding** | `Bienvenue.jsx` | amort. 1,0 · réponse 0,35 | Pousser / revenir avec une direction cohérente (4a.4). |

**Haptique :** seulement au moment qui compte — ajout au panier (déjà fait), validation d'un geste, commande
acceptée. Image, son et vibration sur la même image d'animation.

**Mouvement réduit :** la règle globale existante neutralise le CSS ; `ressort.js` doit lire `mouvementReduit()`
(déjà dans `gestes.js`) et remplacer le ressort par un fondu court. Le geste reste utilisable, il ne glisse
simplement plus.

---

## 5. Les écarts de forme, par rôle (rappel)

- **Client.** Le checkout (rangées + sous-écran, `SousEcran.jsx`) est déjà dans le bon langage : c'est le modèle.
  `SalesPage` (993 lignes, 63 emojis, 90 styles en ligne) est le plus loin.
- **Commerce.** `OrdersPage` : 19 emojis sur l'écran qu'on regarde en plein service. Pas de liste unique « Avant
  d'être en ligne » (`MenuReadiness` et `ConformiteCarte` existent séparément).
- **Livreur.** L'état « en service » mérite un écran iris plein, lisible d'un coup d'œil sur le vélo.
- **Admin.** Outil dense sur ordinateur : on y applique le vocabulaire (icônes, boutons, couleurs, états
  vides), pas le rythme « une question par écran », et aucun geste.

---

## 6. Le plan

Chaque phase est livrable seule, sur sa branche, avec `npm run lint` sans nouveau message dans les fichiers
touchés et un passage dans le navigateur. Pour tout ce qui touche au mouvement : **mesurer avant / après**
(onglet Performance de Chrome, téléphone Android moyen en limitation CPU ×4) — si le site perd quoi que ce
soit, la chose passe derrière `html.natif`.

### Phase 0 — Fondations (aucun écran ne change)
1. Trancher le rayon (16 ou 20 px) ; styles.css, CLAUDE.md et maquette d'accord.
2. Promouvoir les classes `bv-*` en classes génériques (`.ecran`, `.ecran-haut`, `.ecran-titre`, `.ecran-sous`,
   `.ecran-pied`, `.choix`) ; composants `<EcranEtape>` et `<Choix>`.
3. Quatre boutons : `btn-gold`, `btn-teal`, `btn-outline`, un lien. `btn-ghost` ≥ 14 px.
4. Jetons de mouvement : `--ressort` (`linear()`), `--duree-courte` (100 ms), `--duree` (180 ms).
5. Retour à l'appui (`:active`) sur les pilules, rangées et cartes (4a.1).

### Phase 1 — Moins de clics, là où la promesse n'est pas tenue
1. **R1** inscription commerce en 3 champs + liste « Avant d'être en ligne ».
2. **C2 / C3** ne plus redemander la commune ; les envies rangent la liste.
3. **C1, étape intermédiaire** : la carte de confirmation n'apparaît que si le total a changé ; décision sur la
   case `confirmDeliveryInfo` ; pilule → checkout direct si `/panier` n'apporte rien.

### Phase 2 — Le mouvement de l'app
1. `ressort.js` (ressort, projection, rubberband, reprise de vitesse), chargé seulement en natif.
2. Feuilles (`FichePlat`, `SousEcran`) à tirer vers le bas ; retour par le bord ; cartes et écrans de
   l'onboarding.
3. **L2** glisser pour confirmer chez le livreur.
4. Test sur un vrai iPhone et un vrai Android, en ralenti (Apple : « regarder le mouvement image par image »).

### Phase 3 — Parcours longs
1. **L1** dossier livreur en `EcranEtape`.
2. **C1 complet** : route de devis côté backend, une seule étape au checkout. (Backend : tests à ajouter dans
   `../fairide-backend`, `npm test`.)
3. Écran « commande confirmée » en iris plein (une seule pointe de lime).

### Phase 4 — Forme
1. Emojis → `Icone` : parcours d'achat (RestaurantList, RestaurantMenu, Orders, `orderStatus.jsx`,
   DeliveryTrackingMap), puis OrdersPage commerce, puis admin.
2. `SalesPage` refaite avec les composants de la phase 0.
3. Admin : styles en ligne répétés → classes, `EtatVide` partout où une liste peut être vide.

## 7. Garde-fous
- **Performance du site d'abord** : aucun octet de JavaScript de mouvement en plus sur le web ; seulement
  `transform` / `opacity` ; aucune animation sur le chemin d'une action (on n'attend jamais qu'une animation
  finisse pour pouvoir appuyer).
- Ne pas faire grossir `Account.jsx` ni `MenuPage.jsx` : extraire.
- Ne pas toucher aux libellés juridiques ni aux confirmations listées au § 3.
- Chaque nouvelle clé en fr / en / nl.
- Une seule pointe de lime par vue ; fonds blanc ou iris ; pas de flou ni d'ombre.
- Rien qui note, classe ou pénalise un livreur — y compris dans les gestes (un refus reste un appui neutre).

## 8. Suivi
Refaire les mesures du § 2 à la fin de chaque phase, et compter les appuis des parcours du § 3
(cible : commander en 3, inscrire un commerce en 3 champs).

## 9. État au 13 octobre 2026 (branche feat/refonte-ux-front)

Fait, vérifié dans un navigateur sur un backend local en mémoire (aucune requête vers la production) :
- **C1 complet** : paiement en un bouton. Devis du serveur (`POST /orders/devis`, backend `feat/devis-commande`, 4 tests) :
  la barre affiche le total exact, bon cadeau compris, et « Commander et payer » part directement au paiement. Case
  « je confirme mes informations » retirée (aucune obligation légale trouvée — à faire relire par l'avocat).
- **C2 / C3** : rangée « Vos envies » dans la liste ; code postal et commune de l'accueil préremplis à l'inscription.
- **Barre d'onglets** façon Revolut : pastille qui glisse, barre qui suit, réduite au défilement, libellés courts.
- **Police** : Inter (texte) et Inter Tight (titres), servies par Fairide.
- **Plus aucun emoji**, admin compris : icônes d'Icone.jsx (16 écrans contrôlés automatiquement).
- **Phase 2, gestes de l'app** : feuilles physiques, retour par le bord sur iPhone, glisser pour confirmer (livreur),
  écrans de l'accueil qui reviennent par la gauche. Chargés seulement dans l'app.
- **Fondations** : jeton `--green`, pastilles beiges retirées, `btn-ghost` à 14 px, `btn-primary` retiré, rayons
  documentés tels que le code les définit (16 / 8 / 999 px).
- **Commande payée** : écran iris plein.
- **Phase 4, deuxième passe** : une seule taille de petit bouton (`.btn-sm`, 175 tailles en ligne remplacées), texte
  d'erreur en classe (`.texte-erreur`, 44), `EtatVide` sur les écrans principaux (9), dossier livreur avec l'en-tête de
  l'accueil de l'app (barre de progression, « Étape n sur 6 »).

Reste :
- Phase 4 : il reste 2 929 styles en ligne, surtout des espacements ponctuels — que le CLAUDE.md accepte ; on ne les
  convertit pas en classes utilitaires (ce serait réinventer un framework CSS). SalesPage reste à refaire.
- Essai sur de vrais téléphones (gestes) et de la vraie page Stripe (paiement).
