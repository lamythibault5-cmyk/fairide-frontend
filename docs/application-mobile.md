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
| Vibrations | `gestes.js` → `vibrerNatif` | moteur haptique (Taptic Engine sur iPhone, où `navigator.vibrate` n'existe pas) |
| Barre d'état | `demarrerNatif` | iris `#3B2FB5`, texte clair (Android : `overlaysWebView: false`) |
| Encoche / barre d'accueil | `styles.css` (fin), `index.html` | `viewport-fit=cover` + `env(safe-area-inset-*)` sur `.hero`, les barres fixes, les onglets |
| Clavier | `demarrerNatif` | classe `clavier-ouvert` sur `<html>` : les barres fixes du bas se rangent |
| Écran de lancement | `retirerEcranLancementNatif` | retiré en même temps que le `#splash` HTML, quand la page est vraiment rendue |
| Service worker | `main.jsx` | pas enregistré dans la coque |
| Notifications | `pushNatif.js` ↔ `POST /api/push/native-token` | jeton APNs/FCM ; le serveur envoie par Firebase (`fcm.js`, variable `FCM_SERVICE_ACCOUNT_JSON`) |
| CORS API | `server.js` | `capacitor://localhost`, `https://localhost` autorisés |
| Liens universels | `public/.well-known/`, `AndroidManifest.xml` | voir « Reste à faire » : empreintes à remplir |
| Accueil de l'application | `pages/app/Bienvenue.jsx` (`/bienvenue`), `Home.jsx` | premier lancement : « Tu es… » (client / livreur / commerce), questions, « Pourquoi Fairide », position ou code postal, commerces qui livrent vraiment chez toi, compte. Ensuite l'app s'ouvre sur la liste, jamais sur la vitrine du site. Maquette : `mockups/app-onboarding.html`. Relire dans un navigateur : `/bienvenue?apercu` |
| Position | `natif.js` → `demanderPosition` | greffon `@capacitor/geolocation` (une seule question du système, pas celle de la WebView en plus) |
| Connexion Apple / Google | `natif.js` → `connexionFournisseur`, `BoutonsConnexionNative.jsx` | feuille native (`@capgo/capacitor-social-login`) : le bouton Google du site est refusé dans une WebView. Apple sur iPhone seulement (règle 4.8). Serveur : `POST /auth/apple` (`apple.js`) |
| Notifications après l'inscription | `AmorceNotifications.jsx` | une fois, pour les trois profils. Livreur : prévenu de chaque course qu'il verrait dans sa liste (backend `notifLivreurs.js`) ; réglage permanent sous « Courses disponibles » (`NotifCourses.jsx`) |

Scripts : `npm run app:sync` (build + `cap sync`), `npm run app:android`, `npm run app:ios`.

## Reste à faire (une fois, à la main — demande des comptes et des certificats)

1. **Comptes** : Apple Developer (99 $/an) et Google Play Console (25 $ une fois). Identifiant d'application
   `be.fairide.app` (`capacitor.config.json`, `android/app/build.gradle`).
2. **Icônes et écran de lancement** : FAIT pour Android (`npm run app:assets` : `scripts/app-assets.mjs` dessine
   `assets/icon*.png` et `assets/splash*.png` à partir du vélo « 5a », puis `@capacitor/assets` remplit
   `android/app/src/main/res`). Pour iOS, une fois `ios/` créé sur le Mac :
   `npx @capacitor/assets generate --ios --iconBackgroundColor '#3B2FB5' --splashBackgroundColor '#3B2FB5'`.
3. **Android** : ouvrir `android/` dans Android Studio (`npm run app:android`), générer la clé de signature
   (Play App Signing conseillé), puis copier l'empreinte SHA-256 du certificat dans
   `public/.well-known/assetlinks.json` (déployer le site) — c'est ce qui fait que `https://fairide.be/…`
   s'ouvre dans l'application, retour de paiement compris.
4. **iOS** (un Mac avec Xcode est indispensable) : `npx cap add ios`, puis dans Xcode → Signing & Capabilities :
   *Push Notifications* et *Associated Domains* (`applinks:fairide.be`). Remplacer `TEAMID_APPLE` dans
   `public/.well-known/apple-app-site-association` par le Team ID (déployer le site).
5. **Notifications** : projet Firebase → télécharger `google-services.json` dans `android/app/` ;
   pour iOS, déposer la clé APNs (.p8) dans Firebase → Cloud Messaging. Créer un compte de service
   (Paramètres du projet → Comptes de service → générer une clé JSON) et coller le JSON dans la variable
   Railway `FCM_SERVICE_ACCOUNT_JSON`. Sans cette variable, `/api/push/key` répond `native: false` et
   l'application ne propose pas le bouton.
6. **Fiches de magasin** : captures d'écran (téléphone 6,7″ et 6,5″ pour Apple, téléphone + tablette 7″ pour Google),
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
     `com.googleusercontent.apps.…`) dans Xcode → Info → URL Types.
9. **« Continuer avec Apple »** (iPhone) : dans Xcode → Signing & Capabilities, ajouter *Sign in with Apple*. Côté
   serveur rien à configurer (le jeton est vérifié avec les clés publiques d'Apple ; `APPLE_CLIENT_IDS` ne sert que si
   l'identifiant de l'app change). **Relais e-mail** : une personne peut masquer son adresse
   (`…@privaterelay.appleid.com`) ; nos e-mails n'y arrivent que si le domaine d'envoi est déclaré dans le compte
   Apple Developer → Services → *Sign in with Apple for Email Communication* (domaine `fairide.be` + l'adresse
   d'expédition de Resend). **Reste à faire** : à la suppression d'un compte lié à Apple, Apple demande de révoquer
   le jeton (`appleid.apple.com/auth/revoke`) — il faut pour cela une clé `.p8` *Sign in with Apple*, pas encore créée.
10. **Position, texte des permissions iOS** : dans `ios/App/App/Info.plist`, `NSLocationWhenInUseUsageDescription`
    (« Pour te montrer les commerces qui livrent jusqu'à chez toi, et aux livreurs les courses proches. »). Sans elle,
    iOS refuse la demande et Apple refuse l'application. Android : déjà déclaré dans `AndroidManifest.xml`.

## Mettre à jour l'application

Chaque `git push` sur `main` met le site à jour, pas l'application : son `dist/` est figé à la compilation.
Pour publier une nouvelle version : `npm run app:sync`, monter `versionCode`/`versionName`
(`android/app/build.gradle`) ou le build number Xcode, puis envoyer aux magasins. Les corrections côté API
(Railway) touchent immédiatement les deux.
