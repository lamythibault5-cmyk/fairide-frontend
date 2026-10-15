# Avant la production — la liste unique

**Écrite le 15 octobre 2026.** Remplace [AVANT-MISE-EN-LIGNE.md](AVANT-MISE-EN-LIGNE.md) (2 octobre), gardé pour
son détail technique (§ cités ci-dessous). Tout ce qui est marqué *vérifié le 15/10* a été relu ce jour-là en
lecture seule (production Railway et Vercel, API publique, DNS).

**Les dates qui commandent l'ordre :**

| Date | Ce qui s'ouvre | Ce qui doit être prêt |
|---|---|---|
| **16 octobre** | campagne réseaux sociaux ; envoi du contrat commerce 2026.17–19 | §1 |
| **1er novembre** | à emporter **payé sur place** ; contrat 2026.19 en vigueur | §1 et §2 |
| **10 novembre** | **livraison** et **paiement en ligne** (argent réel) | §1, §2 et §3 |

**Légende :** 🔴 bloquant · 🟠 juridique · 🟡 fiabilité · ⚪️ qualité. **Qui :** F = fondateurs (Thibault, Owen),
T = Thibault seul (titulaire des comptes), J = juriste, C = comptable, D = développement.

---

## 1. Avant le 16 octobre (demain)

- [ ] 🟠 **F — Envoyer aux commerces le contrat RESTO-2026.19** (avec le résumé des changements 2026.17 → 2026.19).
      L'envoi automatique est coupé (`notifier: false`, `restaurantContract.js`) : c'est un e-mail à la main, archivé.
      Il doit partir le 16/10 au plus tard pour l'entrée en vigueur du 01/11 (15 jours P2B). Les versions
      précédentes promettent 30 jours : décision du 14/10, on garde le 01/11 et on fait relire (§2, juriste).
- [ ] 🔴 **F — Le flyer PDF ne doit pas circuler tel quel** (`public/docs/flyer-fairide.pdf`, pas de source dans
      le dépôt). Il dit encore : « 100 % des frais de livraison aux coursiers », « pas de frais de visibilité »
      (les positions « Sponsorisé » existent), « un coursier fairide.be prend le relais » (n'existe pas),
      « à emporter gratuit » (abonnement requis), « en ligne le 1er novembre » à côté de la livraison (10/11),
      et le téléphone 0474. À refaire, ou retirer du site.
- [ ] 🔴 **F — Textes de la campagne** : mêmes règles que le site depuis le 14/10 — « l'alternative à Uber Eats »,
      10 % de commission face aux 22-32 % *annoncés* par les grandes plateformes ; **jamais « moins cher »** ;
      le livreur garde **90 %** de la livraison et **100 %** des pourboires ; zone = « Bruxelles et alentours ».
- [ ] 🔴 **T — Photos de banque d'images à couper** (*vérifié le 15/10 : toujours actives en production*).
      Vercel › fairide-frontend › Settings › Environment Variables › Production : `VITE_STOCK_DISH_PHOTOS=off`
      (exactement), puis Redeploy. Un vrai commerce (Maestro pizza) est public : une photo de stock présentée
      comme son plat est une pratique trompeuse.
- [ ] ⚪️ **F — Trancher le numéro de téléphone** : 0491 97 99 80 (mentions légales, contact, `fairideCompanyInfo.js`)
      ou 0474 20 07 13 (données structurées Google `src/seo/jsonLd.js`, flyer). Un seul partout.

## 2. Avant le 1er novembre (à emporter payé sur place)

**Commerces**
- [ ] 🔴 **F — Un vrai commerce prêt à recevoir une commande.** *Vérifié le 15/10 : 91 commerces en ligne, 1 seul
      réel (Maestro pizza).* Conditions dans l'ordre du code : AVANT-MISE-EN-LIGNE.md §1 ; l'outil
      Admin › Prêt au lancement (`pretLancement.js`) dit ce qui manque, commerce par commerce.
- [ ] 🔴 **F — Une vraie commande de bout en bout sur le staging** (voir « Le staging » en bas) : commande, acceptation,
      remise, puis les cas difficiles — refus, annulation, commande non récupérée.
- [ ] 🟡 **F — L'abonnement des commerces reste éteint** (décision du 14/10). Le jour où on l'allume : prévenir
      chaque commerce **30 jours avant** (contrat, clause « Abonnement ») — l'interrupteur admin ferme sinon
      l'à emporter et la livraison sur-le-champ.

**Production (Railway, Vercel)**
- [ ] 🔴 **T — Coupure de ~2 minutes à chaque déploiement du backend** (*vérifié le 15/10 : `healthcheckPath` vide*).
      Railway › service fairide-backend › Settings › **Healthcheck Path** = `/api/health`.
- [ ] 🔴 **T — Sécurité** (AVANT-MISE-EN-LIGNE.md §5) : `COURIER_DATA_KEY` est posée (*vérifié*) ; reste à
      confirmer que `JWT_SECRET` a bien été changé après la faille `verify-email` du 16/09, et à relire les journaux.
- [ ] 🟡 **T — Sauvegardes** : le workflow nocturne existe (`fairide-backend/.github/workflows/sauvegarde-base.yml`,
      pg_dump chiffré + restauration d'essai). Vérifier qu'il passe au vert chaque nuit et que la clé privée
      `age` est rangée hors de GitHub, à deux endroits.
- [ ] 🟡 **T — Deux bizarreries dans les variables de production** : `DATABASE_URL` vaut
      `${{RAILWAY_ENVIRONMENT}}${{Postgres.DATABASE_URL}}` (le nom de l'environnement est collé devant l'adresse ;
      ça marche par chance) → mettre `${{Postgres.DATABASE_URL}}` ; et une variable nommée `ON` (collage raté ?).
- [ ] 🟡 **T — Les aperçus Vercel parlent à la PRODUCTION.** Aucune `VITE_API_BASE` pour les aperçus : chaque branche
      en aperçu lit et écrit les vraies données. Leur donner l'API de staging (Settings › Environment Variables ›
      Preview › `VITE_API_BASE=https://fairide-backend-staging.up.railway.app/api`).
- [ ] 🟡 **T — Géocodage et itinéraires** : `GEO_PROVIDER` vide (*vérifié*) = serveurs publics Nominatim, Photon,
      OSRM, dont les conditions excluent un usage commercial. Clé Geoapify (`GEO_PROVIDER=geoapify` +
      `GEOAPIFY_API_KEY`) ou instances à nous. La politique de géolocalisation des livreurs cite déjà les deux.
- [ ] ⚪️ **T — Statistiques** : `VITE_PLAUSIBLE_DOMAIN=fairide.be` sur Vercel (production), puis Redeploy.
- [ ] ⚪️ **T — E-mails** : DMARC est en `p=none` (*vérifié*) → `p=quarantine` après un test mail-tester.

**Juridique**
- [ ] 🟠 **J — Relecture** : contrat commerce 2026.19 (préavis 16 jours contre les 30 promis ; positions sponsorisées ;
      mandat de tarification), contrat livreur (clause de remplacement, assurance), CGU-2026-10-14,
      confidentialité CONF-2026-10-15 (DPO : la phrase « notre taille ne l'exige pas » n'est pas le bon critère —
      suivi de la position des livreurs ; nouveau le 15/10 : photo du dépôt devant la porte 30 jours, position écran
      verrouillé pendant la livraison, bouton d'urgence fondé sur les intérêts vitaux art. 6.1.d), règlement P2B.
- [ ] 🟠 **F — DPA (RGPD art. 28)** à signer et archiver : Stripe, Resend, Cloudinary, Sentry, Vercel, Railway,
      Anthropic, MapTiler, Google/Firebase. La plupart se signent en ligne.
- [ ] 🟠 **F — Politique de confidentialité, prestataires manquants** : Geoapify / Google Places / fournisseur Peppol /
      Firebase (push) / Apple (connexion) — les ajouter dès qu'ils sont réellement allumés.

## 3. Avant le 10 novembre (livraison et paiement en ligne : de l'argent réel)

**Stripe**
- [ ] 🔴 **T — La production tourne avec une clé Stripe de TEST** (*vérifié le 15/10 : `sk_test_…`*). Avant le 10/11 :
      clé `sk_live_…` sur Railway (production), **nouveau webhook en mode live** vers
      `https://fairide-backend-production.up.railway.app/api/payments/webhook` (les 15 événements de
      `docs/staging.md`) et son `STRIPE_WEBHOOK_SECRET`.
- [ ] 🔴 **F — Tous les commerces et livreurs refont « Activer mes paiements » en live** : un compte Stripe Connect
      créé en mode test n'existe pas en mode live. Prévoir l'e-mail et la relance.
- [ ] 🔴 **F — Un premier vrai paiement** de quelques euros, remboursé ensuite, pour voir l'argent arriver chez
      le commerce et le livreur (virement du lundi).
- [ ] 🟡 **T — Allumer Apple Pay et Google Pay** : tableau de bord Stripe › Settings › Payments › **Payment methods**,
      activer *Apple Pay* et *Google Pay*, **en mode test ET en mode live** (deux réglages séparés). Rien à coder : la page
      Stripe Checkout les affiche d'elle-même dès que « Carte » est proposée (c'est le cas, `payment_method_types`
      `bancontact` + `card`), et une page hébergée par Stripe ne demande aucune vérification de domaine. À essayer :
      iPhone (Safari et l'application), Android (Chrome et l'application) — le bouton n'apparaît que sur un appareil
      qui a une carte enregistrée dans Wallet / Google Pay. La politique de confidentialité les cite déjà.

**Livreurs**
- [ ] 🔴 **F — Assurance accidents + protection juridique souscrite**, références saisies (paramètre
      `courier_insurance_policy`) : le contrat les promet avant la première course. Le bilan « Prêt au lancement »
      le signale tant que c'est vide.
- [ ] 🔴 **D+F — Nouvelle version du contrat livreur** (livraison au prix TVA comprise depuis le 14/10 : 1 km =
      4,50 € au lieu de 5,45 €, c'est une baisse) : changer le numéro dans `courierContracts.js`, **prévenir les
      livreurs avant**, faire re-signer. Ils réaccepteront aussi le mandat, la notice et la politique de géolocalisation
      (textes changés le 14-15/10).
- [ ] 🔴 **F — Des livreurs réels prêts** : dossier vérifié, contrat signé, Stripe live actif, notifications activées
      (Admin › Prêt au lancement).
- [ ] 🟡 **T — Notifications natives en production** : `FCM_SERVICE_ACCOUNT_JSON` n'est posée qu'en staging
      (*vérifié : absente en production*). La poser en production avant les applications.

**Fonctions ajoutées le 15/10 (comparaison avec Uber Eats) — à vérifier sur le staging, puis une fois en live**
- [ ] 🔴 **F — Pourboire au paiement** (`fairide-backend/pourboireCommande.js`). Sur le staging : commande en livraison,
      choisir 2 € → la page Stripe montre une ligne « Pourboire pour ton livreur » et débite total + 2 € ; à la livraison,
      un second virement de 2 € part au livreur (Stripe › Connect › Transfers, `tip_payout`). Puis une commande **refusée**
      avec pourboire : dans Stripe, **deux** remboursements (le pourboire, puis la commande). Puis « client absent » après
      l'attente : le pourboire reste au livreur. Mes commandes affiche « dont 2 € de pourboire » ou « pourboire rendu ».
- [ ] 🔴 **F — Photo du dépôt devant la porte** : commande avec « Déposer devant la porte », le livreur prend la photo
      depuis l'application → la commande passe « livrée » sans code ; le client voit « Voir la photo du dépôt » ; Admin ›
      Commandes › fiche : la photo s'ouvre (lien de 5 minutes). Demande que **Cloudinary** soit configuré en production
      (variables `CLOUDINARY_*`, déjà utilisées pour les photos des commerces).
- [ ] 🟡 **F — Temps de préparation** : dans un commerce, Mon commerce › Commandes et capacité › régler 25 min ; une
      nouvelle commande annonce une heure d'arrivée 13 minutes plus tard qu'avec les 12 minutes par défaut.
- [ ] 🔴 **F — Bouton d'urgence du livreur** : depuis un compte livreur de test, Urgence › Prévenir l'équipe → une tâche
      « URGENCE livreur » (priorité haute) dans Admin › Tâches **et** un e-mail [Livreurs] à `ADMIN_EMAILS` (vérifier qu'il
      arrive, et qu'une règle Outlook ne l'enterre pas dans un dossier). Décider **qui répond** à une alerte, le soir
      compris, et l'écrire dans `docs/procedures-incidents.md`.
- [ ] 🔴 **F — Position du livreur écran verrouillé** (Android, sur un vrai téléphone) : prendre une course, la marquer
      récupérée, verrouiller l'écran 5 minutes en marchant → la carte du client continue de bouger, et la notification
      « Fairide : livraison en cours » est visible ; elle disparaît à la livraison. Recommencer en passant sur Waze.
- [ ] 🔴 **D — Déclaration Google Play** : Play Console › Contenu de l'application › *Types de services de premier plan*
      → « location », avec une courte vidéo de la notification pendant une course (docs/application-mobile.md, point 11).
- [ ] 🔴 **D — iPhone** : `NSLocationAlwaysAndWhenInUseUsageDescription` et *Background Modes › Location updates* dans le
      projet iOS (docs/application-mobile.md, point 11), sinon Apple refuse l'application.
- [ ] 🟠 **F — Les livreurs réacceptent la politique de géolocalisation** : elle dit maintenant que la position est envoyée
      écran verrouillé pendant la livraison, et décrit le bouton d'urgence (`docs/livreurs/politique-geolocalisation.md`).
      Sa version change avec son texte : chaque livreur la relit avant sa prochaine course, rien à faire de plus que le
      prévenir.

**Comptable** (questions ouvertes du 14-15/10)
- [ ] 🟠 **C —** Frais de système de 10 % vendus au **consommateur** (pas au livreur) → base TVA du livreur assujetti =
      sa part de 90 %. À confirmer.
- [ ] 🟠 **C —** TVA des pourboires (le relevé du livreur les montre hors TVA).
- [ ] 🟠 **C —** Montants encaissés pour compte des commerces et livreurs hors du chiffre d'affaires de la franchise
      de Fairide (25 000 €) : seuls les frais de système et commissions compteraient.
- [ ] 🟠 **C —** DAC7 : remboursements partiels ; déclaration rectificative après le 31/01 (TODO dans `dac7.js`) ;
      la marge vélo du 08 au 14/10 ; conservation 10 ans de tout (`retentionPurge.js`) à confirmer.
- [ ] 🟠 **C —** Commission rendue automatiquement au commerce par virement Stripe quand le remboursement intégral
      n'est pas de sa faute (en place depuis le 14/10) : d'accord sur le principe ?
- [ ] 🟠 **C —** Facturation électronique 2026 pour un franchisé (Fairide, et les livreurs franchisés).

## 4. Applications iPhone et Android

- [ ] 🔴 **F — Comptes Apple Developer et Google Play** (en vérification au 15/10).
- [ ] **D — iPhone : TestFlight** construit par GitHub (machines Mac de GitHub, pas besoin d'un Mac). Il faudra :
      Team ID Apple, une clé API App Store Connect (.p8, Key ID, Issuer ID).
- [ ] **D — Android : la version des magasins** (`be.fairide.app`) : appli Firebase de production (empreinte de la clé
      Play), Play App Signing, test interne Play, puis production.
- [ ] **T — Liens universels** : empreinte SHA-256 dans `public/.well-known/assetlinks.json`, Team ID dans
      `apple-app-site-association` (docs/application-mobile.md, « Reste à faire »).
- [ ] **T — Google Cloud › Identifiants** : origine `https://staging.fairide.be` (connexion Google sur le staging) ;
      clients OAuth Android et iOS pour la connexion native.
- [ ] ⚪️ **F — La promesse « applications le 6 octobre »** (`appStoresAt`, `src/launch.js`) est passée : la retirer ou
      la dater juste.

## 5. Le staging (tester sans toucher aux vraies données)

En place depuis le 15/10 (détail : `fairide-backend/docs/staging.md`). Option A : **le staging suit `main`**,
chaque fusion part en production *et* sur le staging.

| Quoi | Où | Suit |
|---|---|---|
| Serveur | `https://fairide-backend-staging.up.railway.app` (Railway, environnement `staging`) | `main` |
| Site | `https://staging.fairide.be` (environnement Vercel `staging`) | branche `staging`, recopiée de `main` par GitHub |
| Android de test | « Fairide Test », envoyée aux testeurs par Firebase App Distribution | chaque push sur `main` |

Stripe en mode **test** (carte `4242 4242 4242 4242`), dates d'ouverture passées, base séparée avec les 29 commerces
de démonstration. Le compte `contact@fairide.be` y est admin.

- [ ] **T — DNS chez OVH** : CNAME `staging` → `25fbe1a85acf72dc.vercel-dns-017.com.` (sans lui, le site de staging
      demande une connexion Vercel).
- [ ] **D — Un commerce et un livreur de test** sur le staging, paiements Stripe (test) activés, pour les commandes
      complètes.
- [ ] Passer à l'**option B** (fusionner d'abord dans `staging`, tester, puis `staging` → `main`) quand il y aura de vrais
      clients : supprimer `.github/workflows/staging-miroir.yml` et retourner les deux branches.

## 6. Ménage des accès (avant le 15 novembre)

Des clés ont circulé pendant la mise en place du staging, le 15/10. À faire, dans cet ordre :
- [ ] **T — Vercel** : supprimer la clé « Protection Bypass for Automation » (Settings › Deployment Protection) dès que
      `staging.fairide.be` répond, puis le jeton Vercel.
- [ ] **F — Railway** : supprimer le jeton d'accès créé le 15/10 (Account Settings › Tokens).
- [ ] **F — GitHub** : supprimer le jeton à grain fin du 15/10 (Settings › Developer settings).
- [ ] **F — Stripe** : régénérer (« roll ») la clé secrète de **test**, puis la remettre dans Railway › staging
      (`STRIPE_SECRET_KEY`).
- [ ] **F — Firebase** : supprimer le fichier de clé du compte de service téléchargé
      (`fairide-7f841-firebase-adminsdk-…json` dans Téléchargements) — la même clé vit déjà dans Railway et GitHub.

---

## Réglé les 14 et 15 octobre (pour ne pas le refaire)

Audit « ce qu'on dit / ce qu'on fait » : livreur à 90 % partout (vélo, commerces qui livrent eux-mêmes), pourboires
100 % ; livraison au prix final TVA comprise (5 € + 0,80 €/km) ; reçus sans double comptage ; remboursement complet
« aucun livreur » ; pas de commission sur une commande remboursée (note de crédit et virement automatiques) ; hausse de
prix arrondie vers le bas (plafond 11,1 %) ; e-mails d'information avec désinscription (opt-out) ; suppression de
compte qui garde la comptabilité 10 ans ; durées de conservation appliquées ; plus de notes ni de classement des
livreurs ; relevé mensuel des ventes du livreur au lieu de l'« autofacturation » ; DAC7 net des remboursements et
frais de système déclarés ; SEO sans « moins cher » ; Google chargé au clic ; CGU-2026-10-14 et CONF-2026-10-14.
Puis : staging complet (Railway, Vercel, Stripe test, Firebase, application Android de test).
