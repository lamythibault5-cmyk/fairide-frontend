# Application mobile Fairide (App Store / Play Store)

Le site **est** l'application : Capacitor emballe le `dist/` de Vite dans une coque iOS et Android. Il n'y a
pas de second code à maintenir. Tout ce qui diffère entre « page dans Safari » et « application installée »
passe par `src/natif.js` (et `src/pushNatif.js` pour les notifications) — nulle part ailleurs.

## Ce qui est déjà en place

| Sujet | Où | Comportement |
|---|---|---|
| Détection | `natif.js` → `estNatif()` | `false` dans un navigateur : rien ne change sur fairide.be |
| Bouton Retour Android | `demarrerNatif` | ferme la fenêtre/fiche ouverte, sinon remonte l'historique ; sur une page d'entrée, réduit l'app |
| Paiement Stripe | `allerAuPaiement(url, { retour })` | navigateur intégré (SFSafariViewController / Custom Tab) ; retour par lien universel, sinon page `retour` à la fermeture |
| Liens externes, documents signés | `ouvrirLienExterne`, `ouvrirDocument.js` | navigateur intégré |
| PDF reçus en mémoire (contrats) | `ouvrirPdfBlob` | fichier dans le cache + feuille de partage du système |
| Vibrations | `gestes.js` → `vibrerNatif` | greffon du projet `Haptique` (iOS : `ios/App/App/HaptiquePlugin.swift`, inscrit par `FairideViewController.swift` ; Android : `HaptiquePlugin.java`, inscrit dans `MainActivity`) : une sensation du téléphone par sens, générateurs préparés au toucher ; `@capacitor/haptics` en repli pour une ancienne version de l'app |
| Barre d'état | `demarrerNatif` | iris `#3B2FB5`, texte clair (Android : `overlaysWebView: false`) |
| Encoche / barre d'accueil | `styles.css` (fin), `index.html` | `viewport-fit=cover` + `env(safe-area-inset-*)` sur `.hero`, les barres fixes, les onglets |
| Clavier | `demarrerNatif` | classe `clavier-ouvert` sur `<html>` : les barres fixes du bas se rangent |
| Écran de lancement | `retirerEcranLancementNatif` | retiré dès que `main.jsx` tourne ; le `#splash` HTML (vélo qui roule) prend le relais jusqu'à ce que l'application soit montée, puis les squelettes couvrent l'attente des données (2026-10-26) |
| Service worker | `main.jsx` | pas enregistré dans la coque |
| Notifications | `pushNatif.js` ↔ `POST /api/push/native-token` | jeton APNs/FCM ; le serveur envoie par Firebase (`fcm.js`, variable `FCM_SERVICE_ACCOUNT_JSON`) |
| CORS API | `server.js` | `capacitor://localhost`, `https://localhost` autorisés |
| Liens universels | `public/.well-known/`, `AndroidManifest.xml` | voir « Reste à faire » : empreintes à remplir |
| Accueil de l'application | `pages/app/Bienvenue.jsx` (`/bienvenue`), `Home.jsx` | premier lancement : « Tu es… » (client / livreur / commerce), questions, « Pourquoi Fairide », position ou code postal, commerces qui livrent vraiment chez toi, compte. Ensuite l'app s'ouvre sur la liste, jamais sur la vitrine du site. Maquette : `maquettes/app-onboarding/app-onboarding.html`. Relire dans un navigateur : `/bienvenue?apercu` |
| Position | `natif.js` → `demanderPosition` | greffon `@capacitor/geolocation` (une seule question du système, pas celle de la WebView en plus). Livreur : jamais à l'inscription, juste avant qu'il passe « Disponible » (fondateur, 2026-10-21 ; `PositionRequise.jsx`, interrupteur de `driver/Dashboard.jsx`), app et site |
| Position du livreur téléphone verrouillé | `natif.js` → `suivrePositionCourse` (driver/Dashboard.jsx, driver/MapPage.jsx) | greffon `@capacitor-community/background-geolocation` 1.2.26, **seulement pendant une course en livraison** : service au premier plan avec la notification « Fairide : livraison en cours ». Hors course, et sur le site : `watchPosition`. Le manifeste du greffon déclare lui-même `FOREGROUND_SERVICE_LOCATION` (Android 14). À essayer sur un vrai téléphone, écran verrouillé, avant la mise en ligne |
| Urgence du livreur | `BoutonUrgence.jsx` → `POST /api/couriers/me/sos` | « Appeler le 112 » (le téléphone compose), puis « Prévenir l'équipe » : tâche haute priorité + e-mail [Livreurs], position précise lue au moment de l'appui (`positionPrecise`) |
| Connexion Apple / Google | `natif.js` → `connexionFournisseur`, `BoutonsConnexionNative.jsx` | feuille native (`@capgo/capacitor-social-login`) : le bouton Google du site est refusé dans une WebView. Apple sur iPhone seulement (règle 4.8). Serveur : `POST /auth/apple` (`apple.js`) |
| Notifications après l'inscription | `AmorceNotifications.jsx` | une fois, pour les trois profils, en listant ce qui arrive vraiment. Ensuite : réglage dans Mes commandes (client), sous « Courses disponibles » (livreur), barre d'alerte (commerce) |
| Notifications envoyées | backend `pushFile.js` (file `push_queue`, déclencheur migration 029), `notifLivreurs.js` | client : acceptée, refusée, livreur trouvé, en route, livrée, prête à retirer, annulée, à la porte. Commerce : nouvelle commande, en attente d'acceptation, annulée, livreur qui attend. Livreur : nouvelle course qu'il verrait, sa course prête, annulée, retirée par le client. Jamais pour son propre geste |

Scripts : `npm run app:sync` (build + `cap sync`), `npm run app:android`, `npm run app:ios`.

## Reste à faire (une fois, à la main — demande des comptes et des certificats)

1. **Comptes** : Apple Developer (99 $/an) et Google Play Console (25 $ une fois). Identifiant d'application
   `be.fairide.app` (`capacitor.config.json`, `android/app/build.gradle`).
2. **Icônes et écran de lancement** : FAIT pour Android (`npm run app:assets` : `scripts/app-assets.mjs` dessine
   `assets/icon*.png` et `assets/splash*.png` à partir du vélo « 5a », puis `@capacitor/assets` remplit
   `android/app/src/main/res`). FAIT pour iOS (22 oct. 2026) : `npm run app:assets:ios` remplit
   `ios/App/App/Assets.xcassets` à partir des mêmes images (icône 1024 px sans transparence, exigée par Apple).
3. **Android** : ouvrir `android/` dans Android Studio (`npm run app:android`), générer la clé de signature
   (Play App Signing conseillé), puis copier l'empreinte SHA-256 du certificat dans
   `public/.well-known/assetlinks.json` (déployer le site) — c'est ce qui fait que `https://fairide.be/…`
   s'ouvre dans l'application, retour de paiement compris.
4. **iOS** : le projet `ios/` existe (22 oct. 2026, `npx cap add ios`). Ses droits sont dans
   `ios/App/App/App.entitlements` (notifications, Sign in with Apple, `applinks:fairide.be`) : Xcode les active sur
   l'identifiant `be.fairide.app` à la première signature. iPhone et iPad (`TARGETED_DEVICE_FAMILY = "1,2"`, Owen
   23 oct. 2026 : l'app doit marcher sur tablette, iPad comme Android) ; l'iPad tourne dans les quatre sens et partage
   l'écran (Split View), la mise en page suit la largeur comme sur le site. iOS 15 minimum (Firebase).
   `capacitor.config.json` › `ios.contentInset` = `never` (23 oct. 2026) : le CSS gère déjà l'encoche et la barre d'accueil
   (`env(safe-area-inset-*)`, écrit pour le site ajouté à l'écran d'accueil) ; avec `automatic`, iOS ajoutait la même marge
   une seconde fois et laissait un vide sous la barre d'onglets. `allowsLinkPreview: false` : pas d'aperçu de lien au
   toucher long, comme une app. Construire et envoyer :
   « Sortir une version iPhone » plus bas. Team ID Apple `44V9JV2JQN` (23 oct. 2026), déjà dans
   `public/.well-known/apple-app-site-association` : `https://fairide.be/…` s'ouvre dans l'app une fois le site déployé.
   Depuis le 24 oct. 2026 (revue du 24/10) la liste y comprend `/retour-appli*` (le retour de Stripe d'une demande faite
   dans l'app : sans lui, l'iPhone restait dans le navigateur intégré après le paiement) et `/driver*`. Une adresse qui
   n'y est pas s'ouvre dans Safari, jamais dans l'app. Le bouton de `/retour-appli` prend sur iPhone le schéma de l'app,
   `fairide:///chemin` (`CFBundleURLTypes` d'`Info.plist`) : iOS n'ouvre jamais l'app pour un lien vers le domaine déjà affiché.
5. **Notifications** : projet Firebase → télécharger `google-services.json` dans `android/app/` ;
   pour iOS, ajouter une app iOS `be.fairide.app` au même projet Firebase, télécharger son
   `GoogleService-Info.plist` dans `ios/App/App/` (hors git, comme `google-services.json` ; une étape du projet Xcode
   le copie dans l'app), et déposer la clé APNs (.p8, Apple Developer → Keys) dans Firebase → Cloud Messaging.
   **Pourquoi Firebase est dans l'app iPhone** : iOS remet au greffon un jeton APNs, que FCM refuse
   (`INVALID_ARGUMENT`, et le serveur l'efface comme mort : aucune notification, sans erreur visible).
   `AppDelegate.swift` confie le jeton APNs à Firebase et donne le jeton Firebase au greffon. Sans le fichier, l'app
   démarre mais ne reçoit pas de notifications (Xcode l'écrit en avertissement). Créer un compte de service
   (Paramètres du projet → Comptes de service → générer une clé JSON) et coller le JSON dans la variable
   Railway `FCM_SERVICE_ACCOUNT_JSON`. Sans cette variable, `/api/push/key` répond `native: false` et
   l'application ne propose pas le bouton.
6. **Fiches de magasin** : captures d'écran (iPhone 6,9″, 1320 × 2868, et iPad 13″, 2064 × 2752, pour Apple ; téléphone + tablette 7″ pour Google),
   politique de confidentialité = `https://fairide.be/confidentialite`, catégorie « Nourriture et boissons ».
   Apple demande un compte de démonstration : utiliser un commerce de simulation (Admin › Simulation).
7. **Stripe** : rien à changer — le paiement reste sur checkout.stripe.com dans le navigateur intégré, ce
   que les règles d'Apple autorisent pour des biens physiques (repas), contrairement aux achats intégrés.
8. **« Continuer avec Google » dans l'application** (Google Cloud → Identifiants, même projet que l'ID web
   `VITE_GOOGLE_CLIENT_ID`) :
   - **Android** : créer un ID client OAuth de type *Android*, paquet `be.fairide.app`, avec l'empreinte **SHA-1** de la
     clé de signature (Play Console → Intégrité de l'app ; plus celle de la clé de debug pour les essais). Rien à mettre
     dans le code : l'app demande un jeton pour l'ID **web**, que le serveur vérifie déjà.
   - **iOS** : créer un ID client de type *iOS* (bundle `be.fairide.app`), le mettre dans `VITE_GOOGLE_IOS_CLIENT_ID`
     (Vercel et `.env.local` avant `npm run app:sync`), et ajouter son « iOS URL scheme » (l'ID à l'envers,
     `com.googleusercontent.apps.…`) dans Xcode → Info → URL Types. FAIT le 23 oct. 2026 : client iOS « Fairide iOS »
     `236237065648-39n11a8pc53v4eavik8ek3t3602dhqv9.apps.googleusercontent.com` (projet Google Cloud du client web, pas
     celui de Firebase), schéma déjà dans `ios/App/App/Info.plist` (`CFBundleURLTypes`). Le plist proposé par Google ne sert pas.
     **Les deux ID sont aussi dans `Info.plist`** (`GIDClientID` = iOS, `GIDServerClientID` = web ; 23 oct. 2026) : une version
     construite sans `VITE_GOOGLE_IOS_CLIENT_ID` laissait le greffon sans configuration, et le premier toucher sur « Continuer
     avec Google » fermait l'app (« No active configuration. Make sure GIDClientID is set in Info.plist »). GoogleSignIn lit
     ces clés tout seul ; la variable reste la source pour `natif.js`.
9. **« Continuer avec Apple »** (iPhone) : *Sign in with Apple* est déclaré dans `App.entitlements`. Le jeton
   d'identité est vérifié avec les clés publiques d'Apple (`APPLE_CLIENT_IDS` ne sert que si l'identifiant de l'app
   change). **Relais e-mail** : une personne peut masquer son adresse (`…@privaterelay.appleid.com`) ; nos e-mails n'y arrivent que si le domaine d'envoi est déclaré dans le compte
   Apple Developer → Services → *Sign in with Apple for Email Communication* (domaine `fairide.be` + l'adresse
   d'expédition de Resend). **Révocation à la suppression du compte** (règle 5.1.1(v), 2026-10-25) : à chaque connexion
   Apple, l'app envoie le code d'autorisation (`natif.js` › `codeApple`, greffon en `useProperTokenExchange`) ; le
   serveur l'échange contre un refresh_token gardé chiffré (`users.apple_refresh_token_enc`, migration 092) et le révoque
   (`appleid.apple.com/auth/revoke`) quand le compte est supprimé (`accountDeletion.js`). Il lui faut trois variables
   Railway : `APPLE_TEAM_ID` (44V9JV2JQN), `APPLE_KEY_ID` (VDXR82465F, la clé « Fairide » qui couvre aussi Sign in with
   Apple) et `APPLE_PRIVATE_KEY` (le contenu du `.p8`). Sans elles rien ne casse, mais rien n'est gardé ni révoqué. Un
   compte lié avant cela n'a pas de jeton gardé jusqu'à sa prochaine connexion Apple.
10. **Textes des permissions iOS** : FAIT dans `ios/App/App/Info.plist` : `NSLocationWhenInUseUsageDescription`
    (« Pour te montrer les commerces qui livrent jusqu'à chez toi, et aux livreurs les courses proches. ») et
    `NSCameraUsageDescription` (photo de la commande prête, documents du dossier livreur : les champs `capture`),
    `NSPhotoLibraryAddUsageDescription` (24 oct. 2026 : « Enregistrer l'image » au toucher long d'une photo de plat).
    Sans elles, iOS refuse la position, l'app s'arrête en ouvrant l'appareil photo ou en enregistrant une image, et Apple
    refuse l'application.
    Un nouvel accès (micro, contacts…) demande sa phrase ici. Android : déjà déclaré dans `AndroidManifest.xml`.
    `ios/App/App/PrivacyInfo.xcprivacy` déclare à Apple les données collectées (pas de pistage) et les raisons des API
    sensibles des greffons ; un nouveau type de donnée collectée s'y ajoute, et dans App Store Connect › App Privacy.
11. **Position du livreur en arrière-plan** (15 oct. 2026, voir le tableau plus haut) :
    - **iOS** : FAIT dans `Info.plist` : `NSLocationAlwaysAndWhenInUseUsageDescription` (« Pendant une livraison, ta
      position reste partagée avec le client même écran verrouillé, jusqu'à la remise. ») et `UIBackgroundModes` =
      `location`. Apple demande pourquoi à la revue : le suivi de la livraison par le client (l'écrire dans les notes).
    - **Google Play** : Play Console → Contenu de l'application → *Types de services de premier plan* : déclarer
      « location », avec une courte vidéo de la notification pendant une course. L'application ne demande PAS la position
      « en arrière-plan » (`ACCESS_BACKGROUND_LOCATION`) : le service au premier plan suffit, ce qui évite le formulaire
      le plus lourd de Google.
12. **Clair uniquement** (19 oct. 2026, audit « Look and feel ») : Fairide n'a pas de thème sombre. Le site et Android
    sont déjà forcés en clair (balise `color-scheme` d'index.html, `color-scheme: light only` dans styles.css, thème
    `Theme.AppCompat.Light.NoActionBar` + `forceDarkAllowed=false` dans `android/app/src/main/res/values/styles.xml`).
    **iOS** : FAIT, `UIUserInterfaceStyle` = `Light` dans `Info.plist` ; sans elle, un iPhone en mode sombre affiche le
    clavier, les sélecteurs de date et les fenêtres du système en noir sur nos écrans blancs.

## Sortir une version iPhone

**Par GitHub, sans Mac (depuis le 23 oct. 2026, la voie normale)** : `.github/workflows/app-ios-testflight.yml`. À chaque
fusion dans `main` (sauf docs seules), un Mac de GitHub construit l'app reliée à la production, la signe et l'envoie dans App
Store Connect ; le groupe interne « Équipe » de TestFlight la reçoit tout seul (« Mettre à jour » dans l'app TestFlight),
10 à 30 min après la fin du build. À la main : Actions › *App iPhone TestFlight* › *Run workflow*. Numéro de build = numéro
du lancement + 100. La signature (certificat « Apple Distribution » + profil « Fairide App Store CI », créés par l'API App
Store Connect avec la clé « GitHub », rôle Admin) **expire le 23 oct. 2027** : la recréer avant, sinon le build s'arrête.
Originaux dans `C:\Users\OSTA\fairide-cles\ios-ci\` ; secrets et variables listés en tête du workflow. Rien ne part vers
l'App Store public : la soumission se fait à la main dans App Store Connect (onglet Distribution).

**Sur le Mac d'Owen (secours, et pour déboguer avec la console de Xcode)** : Xcode signe et envoie lui-même vers TestFlight.

**Une fois**
1. Installer Xcode (App Store du Mac) et l'ouvrir une fois, Node 22, CocoaPods (`brew install cocoapods`).
2. Cloner le dépôt frontend, `npm ci`.
3. À la racine, un fichier `.env.production.local` (hors git) : `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_IOS_CLIENT_ID`
   (point 8), `VITE_SENTRY_DSN`, `VITE_PLAUSIBLE_DOMAIN`, mêmes valeurs que les variables GitHub du workflow Play Store.
   Le serveur de production et l'absence de photos de banque d'images sont imposés par `npm run app:ios:production`,
   jamais par ce fichier.
4. `GoogleService-Info.plist` dans `ios/App/App/` (point 5).
5. App Store Connect › Apps › « + » : app iOS « Fairide », langue principale français, identifiant `be.fairide.app`.
6. Xcode (ouvert par la commande ci-dessous) › cible *App* › Signing & Capabilities › *Team* : l'équipe Fairide. La
   signature est automatique ; vérifier que l'onglet liste Push Notifications, Sign in with Apple, Associated Domains et
   Background Modes (Location updates).

**Chaque version**
1. `git pull`, `npm ci`, puis `npm run app:ios:production` : construit le site contre le serveur de production, le copie
   dans `ios/` (`pod install` au passage) et ouvre Xcode.
2. En haut de Xcode, appareil *Any iOS Device (arm64)*, puis Product › Archive.
3. Dans l'Organizer : Distribute App › App Store Connect › Upload, en laissant cochée *Manage Version and Build Number*
   (Xcode monte le numéro de build lui-même ; ne pas le changer à la main dans le projet).
4. Après 10 à 30 minutes, la version apparaît dans App Store Connect › TestFlight. Testeurs internes (l'équipe, jusqu'à
   100) : tout de suite, sans revue Apple.

**Déboguer** : iPhone branché, Xcode › Run ; les journaux natifs s'affichent dans la console de Xcode (l'équivalent
d'`adb logcat`), et Safari › Développement › [l'iPhone] inspecte la page de l'app (version Debug).

## Mettre à jour l'application

Chaque `git push` sur `main` met le site à jour, pas l'application : son `dist/` est figé à la compilation.
Les corrections côté API (Railway) et le contenu (cartes, commerces, prix) touchent immédiatement les deux.

**Les deux applications Android** (17 oct. 2026) :

| | Fairide Test (`be.fairide.app.test`) | Fairide (`be.fairide.app`, Play Store) |
|---|---|---|
| Serveur | staging | production |
| Quand | **à chaque fusion sur `main`**, tout seul | **à la main** : GitHub › Actions › *App Android Play Store* › *Run workflow* |
| Workflow | `.github/workflows/app-android-test.yml` | `.github/workflows/app-android-store.yml` |
| Arrive | e-mail Firebase App Distribution aux testeurs | piste **Internal testing** de la Play Console, envoyée par le build lui-même |

**Sortir une version Play Store.** Rien à modifier dans le code : le `versionCode` est le numéro du lancement du
workflow (`VERSION_CODE`, `android/app/build.gradle`), il monte tout seul. Owen lance *Run workflow*, recharge la page
d'abord (F5) pour voir la case **Notes de version** (français, 500 caractères au plus, lues par les testeurs), puis
l'étape « Envoi dans Internal testing » dépose le bundle. Ne PAS faire télécharger le `.aab` à Owen : l'antivirus de son
ordinateur (Defender, « Trojan:JS/Tisifi.A » sur les pages Factures) bloque le `.zip` — fausse alerte, l'envoi direct
l'évite. Jamais vers la production depuis le workflow : le compte de service n'a que « View app information » et
« Release apps to testing tracks ». La mise en production se fait dans la Play Console, à la main.

**Pour un agent** : sans `gh` authentifié, il ne peut pas cliquer *Run workflow* ; il prépare les notes de version
(à partir de `git log` depuis la dernière version) et donne le lien
`https://github.com/lamythibault5-cmyk/fairide-frontend/actions/workflows/app-android-store.yml` à Owen. Un changement
qui ne touche que l'API ou le contenu n'a pas besoin de nouvelle version.

**Déboguer sur un vrai téléphone** : `adb logcat` par USB (débogage USB activé sur la Galaxy Tab S7+ d'Owen ; `adb` des
platform-tools de Google, téléchargés dans un dossier temporaire). C'est le logcat qui a trouvé, le 17 oct. 2026, que la
connexion Google attendait sans fin (greffon rendu par une fonction async, voir `natif.js`, `preparerConnexion`) —
trois versions « à l'aveugle » avant lui. Commencer par là.
