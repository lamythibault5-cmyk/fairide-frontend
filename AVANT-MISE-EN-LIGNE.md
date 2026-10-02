# Avant la mise en ligne

Ce qu'il reste à faire avant d'ouvrir Fairide à de vrais commerçants et de vrais clients.

**Réécrit le 2 octobre 2026.** La version précédente (30 août, mise à jour jusqu'au 18 septembre) annonçait
encore les dates du 5 et du 15 octobre, un mot de passe de 8 caractères, une part de Fairide de 9,09 % et
plusieurs manques qui n'en sont plus. Tout ce qui suit a été relu dans le code de `main` (les deux dépôts) ou
mesuré sur la production le 2 octobre, en lecture seule. Ce qui n'a pas pu l'être est dit comme tel.

Le détail test par test, avec les preuves, vit dans [docs/fairide-tests-e2e-standalone.html](docs/fairide-tests-e2e-standalone.html).
Les scénarios rejouables sans intervention humaine sont dans les tests du backend (`npm test`, fichiers
`tests/plan-de-test-*.test.js`, 179 tests au 2 octobre).

**Légende :** 🔴 bloquant · 🟠 obligation légale · 🟡 fiabilité · ⚪️ qualité

---

## Ce qui reste à faire, dans l'ordre

Il n'y a plus rien ici qui s'écrive : chaque point demande **un compte, une clé, un appareil ou une décision**.

1. 🔴 **Sécurité : vérifier puis changer `JWT_SECRET` sur Railway — en posant d'abord `COURIER_DATA_KEY`** (§5).
   Dans cet ordre, sinon les numéros de registre national des livreurs deviennent illisibles.
2. 🔴 **Amener un vrai commerce au bout des conditions de commande, puis passer une vraie commande** (§1).
   Aujourd'hui, aucun commerce réel ne peut recevoir de commande.
3. 🔴 **Savoir si la clé Stripe de production est `sk_test_` ou `sk_live_`** (§2).
4. 🔴 **Supprimer la coupure de 2 minutes à chaque déploiement du backend** (§2) — vue en direct le 2 octobre.
5. 🔴 **Poser sur Vercel, puis reconstruire** : `VITE_STOCK_DISH_PHOTOS=off`, `VITE_PLAUSIBLE_DOMAIN=fairide.be`,
   et les tuiles de carte d'un fournisseur sous contrat (§3).
6. 🟠 **Faire relire les textes juridiques**, signer les **accords de sous-traitance (DPA)** et trancher pour
   Nominatim / Photon / OSRM (§6).
7. 🟡 **Restaurer une sauvegarde dans une base vide** (§7).
8. 🟡 **Applications mobiles** : comptes Apple et Google, et le push natif (§4).
9. ⚪️ Ensuite : console du navigateur sur les pages clés (CSP), Search Console, traduction des cartes (§8).

---

## 🔴 1. Aucun vrai commerce ne peut encore recevoir de commande

**Relevé du 2 octobre 2026 sur l'API publique** : 91 commerces en ligne, dont **90 de démonstration** et
**un seul réel**, Maestro pizza. Il est listé publiquement, mais sa carte n'est pas signée et il ne propose ni
livraison ni à emporter : il ne peut rien recevoir.

Ce que `routes/orders.js` exige d'une commande, dans l'ordre où il le vérifie :

| Condition | Message au client si elle manque |
|---|---|
| Date d'ouverture du service passée (sauf compte admin ou marqué test par l'équipe) | « Les commandes à emporter ouvrent le 1er novembre 2026… » (423) |
| Contrat commerce accepté (version valable) | « Ce restaurant n'est pas encore actif sur Fairide. » |
| Attestation allergènes signée | « Ce commerce finalise son inscription… » |
| Carte signée | « Ce commerce met à jour sa carte… » |
| CGU en vigueur acceptées par le client | demandées au panier (428) |
| Commerce « ouvert » et dans ses horaires (fermetures exceptionnelles comprises) | « Ce restaurant est actuellement fermé. » / « …fermé en ce moment » |
| Service proposé et **abonnement actif** (`active` ou `trialing`) | « Ce restaurant ne propose pas ce mode de commande. » |
| `admin_status = approved` | « Ce restaurant n'est pas encore actif sur Fairide. » |
| **Stripe Connect actif**, sauf à emporter payé sur place | « Ce restaurant n'a pas encore configuré ses paiements Fairide. » |
| Plafond de commandes du jour, rayon de livraison, commune non suspendue | messages dédiés |

Les commerces de démonstration (`is_demo`) sont dispensés des quatre premières lignes : c'est pour ça qu'ils
« marchent » et qu'ils ne prouvent rien. Pour la livraison, chaque **livreur** doit aussi être approuvé, avoir
son Stripe Connect actif, ne pas être en pause et rester sous son plafond légal.

**Les dates**, telles que le serveur les sert (`GET /api/orders/launch`, vérifié en production) :

| Service | Ouverture (heure de Bruxelles) | Variable |
|---|---|---|
| Inscription Stripe des livreurs et commerces | 5 octobre 2026 | `FAIRIDE_PAYMENTS_OPEN_AT` |
| Abonnement commerce (20 €/mois, 1er mois offert) | 6 octobre 2026 | `FAIRIDE_SUBSCRIPTION_OPEN_AT` |
| À emporter **payé sur place** | **1er novembre 2026, 00:00** | `FAIRIDE_PICKUP_OPEN_AT` |
| Livraison **et** paiement en ligne | **10 novembre 2026, 00:00** | `FAIRIDE_DELIVERY_OPEN_AT`, `FAIRIDE_ONLINE_PAYMENT_OPEN_AT` |

Les anciennes variables (`FAIRIDE_ORDERS_OPEN_AT`, `FAIRIDE_RESERVATIONS_OPEN_AT`) sont ignorées : ne pas les
reposer. La réservation de table n'existe plus (retirée le 25 septembre).

- [ ] Faire passer **un** vrai commerce par toutes les conditions ci-dessus
- [ ] Une vraie commande complète : panier → paiement → commerce → livreur → livraison confirmée →
      virements visibles dans Stripe. Le parcours a été joué de bout en bout sur une base en mémoire
      (tests `plan-de-test-*`), jamais avec Stripe réel ni un vrai téléphone.

---

## 🔴 2. Railway et Stripe

**`/api/health` en production, le 2 octobre** : e-mail (Resend), Stripe, secret de webhook, IA, `APP_URL` et
PEPPOL sont configurés ; SMS (Twilio) et itsme ne le sont pas (les codes partent par e-mail, l'identité passe
par Stripe Identity). La route ne dit jamais la valeur d'une clé, seulement sa présence.

- [ ] **Clé Stripe : `sk_test_` ou `sk_live_` ?** À lire dans Railway ou dans Stripe (bascule Test / Live).
      Avec une clé de test, aucun argent ne bouge.
- [ ] **Webhook Stripe** : un seul point d'entrée pour la production, signé avec `STRIPE_WEBHOOK_SECRET`. Un
      webhook non signé est refusé (vérifié) et, depuis le 2 octobre, chaque refus est journalisé.
- [ ] **Coupure à chaque déploiement.** Le 2 octobre entre 09:52 et 09:54 (UTC), l'API a répondu
      « 502 Application failed to respond » pendant environ 2 minutes, le temps du redéploiement. Pendant
      ce temps, un client ne peut pas payer et Stripe voit ses webhooks échouer (il les renvoie, mais le
      paiement paraît bloqué). Railway › service › Settings › **Healthcheck Path** = `/api/health` : l'ancienne
      version reste en ligne jusqu'à ce que la nouvelle réponde. À faire avant le premier vrai client.
- [ ] Vérifier que la construction utilise `npm ci` et non `npm install`.
- [ ] Région **EU West** pour la base et le backend (vérifié le 18 septembre) — à conserver lors d'une migration.

`CORS_ORIGINS` n'est plus indispensable : depuis le 2 octobre, sans elle, la production refuse les serveurs de
développement (`localhost:5173/5174`) et garde les origines de l'application mobile (vérifié en production).

---

## 🔴 3. Trois variables Vercel, puis une reconstruction

Vite inscrit les variables `VITE_*` dans le JavaScript **au moment de la construction** : poser une variable
sans relancer un déploiement ne change rien. Vercel › fairide-frontend › Settings › Environment Variables ›
Production, puis Deployments › le plus récent › ⋯ › **Redeploy**.

| Variable | État au 2 octobre | À poser |
|---|---|---|
| `VITE_STOCK_DISH_PHOTOS` | non vérifiable de l'extérieur ; le défaut du code est `on` | `off` — exactement, en minuscules (`Off`, `false`, `0` laissent les photos **actives**) |
| `VITE_PLAUSIBLE_DOMAIN` | absente : aucune trace de Plausible dans le site servi | `fairide.be` |
| `VITE_MAP_TILE_URL` / `VITE_MAP_TILE_ATTRIBUTION` | absentes : tuiles OpenStreetMap publiques, dont la politique exclut l'usage commercial intensif | gabarit du fournisseur choisi ; ajouter son domaine à `img-src` dans `vercel.json` |

**Photos de stock : c'est devenu urgent.** Un vrai commerce (Maestro pizza) est déjà public. Une photo de
banque d'images présentée comme le plat d'un commerçant est une pratique commerciale trompeuse, et c'est le
commerçant qui reçoit la réclamation. Pour vérifier après reconstruction : ouvrir sa fiche ; un plat sans
vraie photo doit s'afficher en carte texte, sans image.

---

## 🟡 4. Notifications et applications mobiles

- **Web Push** : clés VAPID prises en compte (`/api/push/key` → `enabled: true`, vérifié). Reste à voir une
  notification arriver sur un vrai téléphone, application fermée. Sur iPhone, seulement depuis le site ajouté
  à l'écran d'accueil (iOS 16.4+).
- **Applications iOS et Android** : la coque Capacitor existe (voir [docs/application-mobile.md](docs/application-mobile.md)),
  le push natif aussi côté code, mais `/api/push/key` répond `native: false` : `FCM_SERVICE_ACCOUNT_JSON`
  n'est pas posée. Restent les comptes Apple Developer et Google Play, les certificats et la publication.
- [ ] **Trancher la promesse de l'accueil** : l'API annonce `appStoresAt: 2026-10-06`. Ce qui est écrit doit
      être vrai le jour où c'est lu — applications publiées, date repoussée, ou promesse retirée.
- Le suivi du livreur s'arrête quand son téléphone se verrouille (aucune géolocalisation en arrière-plan, ni
  sur le web ni encore dans la coque). La carte du client l'indique après deux minutes.

---

## 🔴 5. Sécurité : ce qui ne s'écrit pas

Les correctifs des audits du 16 et du 18 septembre sont dans `main` et en production. Le plan de test du
2 octobre en a ajouté d'autres, eux aussi fusionnés : six erreurs au plus par code de remise et par commande
(un code à 4 chiffres se devinait), plafond de connexion **par compte** en plus de celui par adresse IP,
adresse e-mail nettoyée à l'inscription, recherches admin qui ne tombent plus en erreur sur un paramètre
répété. Restent les gestes qui demandent l'accès à Railway :

- [ ] **`JWT_SECRET`** : vérifier qu'il existe. Le serveur refuse de démarrer sans lui **s'il se sait en
      production** (`NODE_ENV=production` ou une `DATABASE_URL` contenant « railway », `config.js`) — d'où
      l'intérêt de le lire plutôt que de le supposer.
- [ ] **`COURIER_DATA_KEY` d'abord.** Sans elle, la clé de chiffrement des numéros de registre national est
      dérivée de `JWT_SECRET` : le changer les rendrait illisibles. Poser la clé, lancer
      `scripts/rechiffrer-donnees-livreurs.js` pendant que les deux clés sont connues, vérifier une fiche livreur.
- [ ] **Puis changer `JWT_SECRET`.** C'est le seul moyen d'invalider les jetons qu'a pu délivrer la faille
      `verify-email` (corrigée le 16 septembre). `ANCIEN_JWT_SECRET` permet une rotation sans déconnecter
      tout le monde d'un coup.
- [ ] **Lire les journaux Railway** des semaines passées : un `POST /api/auth/verify-email` suivi d'une
      activité admin inattendue. Si la faille a servi, la notification à l'Autorité de protection des
      données est due sous 72 heures.
- [ ] **Pièces d'identité des livreurs** : les nouvelles sont privées chez Cloudinary (`type: 'authenticated'`)
      depuis le 21 septembre ; les anciennes passent en privé avec `scripts/passer-documents-en-prive.js`.
      S'assurer qu'il a été lancé : une ancienne adresse ne doit plus s'ouvrir sans compte.
- [ ] itsme : valider la signature du jeton (`ITSME_VERIFY_JWKS`) le jour où le contrat existe.

**Une décision reste ouverte** : la connexion dit « aucun compte avec cette adresse » et « mot de passe
incorrect » de façon différente, ce qui révèle qui est inscrit. Les unifier ne fermerait pas la fuite —
l'inscription doit de toute façon dire « un compte existe déjà avec cet e-mail ». Le choix actuel aide le
client ; le plafond par compte limite l'abus.

`npm audit` : frontend 0 ; backend 0 critique ou haute, 2 modérées (`uuid`, via `exceljs` : la seule
correction rétrograde `exceljs` en 3.4.0, et la faille ne touche pas l'usage qu'en fait `exceljs`).

---

## 🟠 6. Obligations légales

- **Mentions légales** complètes (BCE 1042.169.780, TVA, RPM, siège, représentant, IBAN).
- **Prix et part de Fairide** : la carte affiche le prix en magasin **× 1,121** (10 % hors TVA pour Fairide, plus
  21 % de TVA sur ces 10 %) ; le commerce reçoit exactement son prix en magasin ; le client paie en plus la
  livraison et des frais de service de 10 % de la livraison hors TVA, TVA ajoutée. À emporter payé sur place :
  ni majoration retenue, ni frais. Contrat `RESTO-2026.15`, CGU `CGU-2026-09-25`.
- **Abonnement** : 20 €/mois, premier mois offert, garantie « zéro commande = zéro abonnement » (un mois sans
  commande n'est pas facturé, ou est remboursé).
- **Mot de passe** : 6 caractères au moins, une majuscule, une minuscule, et refus des mots de passe présents
  dans des fuites connues (décision du 23 septembre ; la règle est la même aux trois endroits).
- **Purge des données** : la tâche existe et tourne au démarrage puis toutes les heures (`retentionPurge.js`) ;
  la position du livreur est effacée dès la livraison. Elle écarte volontairement les tickets de support et
  les pièces d'identité, dont les fichiers vivent chez Cloudinary : il faut une décision par catégorie.
- [ ] **Relecture par un juriste** de ce qui n'a pas été écrit faute de pouvoir le vérifier : délégué à la
      protection des données, représentant UE, clauses de transfert hors UE (plusieurs prestataires sont
      américains), et les CGV commerçants au regard du **règlement P2B** (préavis, motifs, plaintes internes).
- [ ] **DPA (RGPD art. 28)** à signer et archiver : Stripe, Resend, Cloudinary, Sentry, Vercel, Railway,
      Anthropic, Twilio. La plupart se signent en ligne en quelques minutes.
- [ ] **Nominatim, Photon, OSRM** : serveurs publics de démonstration, sans engagement. Usage commercial
      acceptable au volume prévu, ou service payant avant le lancement ?
- Accessibilité : au 16 septembre, 0 étiquette orpheline mais ~150 champs sans nom accessible, surtout dans
  la console admin. **Non re-mesuré depuis.**

---

## 🟡 7. Sauvegardes et environnement de test

- [ ] Vérifier ce que Railway sauvegarde, à quelle fréquence, combien de temps.
- [ ] **Restaurer une copie dans une base vide et démarrer le backend dessus.** Une sauvegarde jamais
      restaurée est une supposition. Le schéma sait se créer de zéro en une passe depuis le 18 septembre.
- [ ] Un environnement de test **hébergé** (base et backend séparés, Stripe en mode test) : aujourd'hui, seul
      le poste de développement en a un, et sans `.env.local` le site local parle à la base de production.

---

## ⚪️ 8. Le reste

- [ ] **Console du navigateur** (F12) sur l'accueil, une fiche commerce, la carte, le paiement, la console admin
      et le terminal Goodcom : aucune violation de la politique de sécurité du contenu, qui est en mode bloquant
      (constaté dans les en-têtes le 2 octobre).
- [ ] **Search Console** : un enregistrement `google-site-verification` est déjà dans le DNS de fairide.be ;
      soumettre `https://fairide.be/sitemap.xml` (300 adresses, dont 273 fiches, dans les trois langues).
- [ ] **E-mails** : DKIM et SPF d'envoi en place ; DMARC est en `p=none` (aucune protection contre
      l'usurpation) — passer à `quarantine` une fois les envois vérifiés. Tester le score sur mail-tester.
- [ ] **Traduction des cartes** : essayer sur un seul commerce avant d'annoncer le bouton aux autres.

---

## Réglé depuis la version du 18 septembre

Pour que personne ne refasse ce qui est fait : CSP passée en bloquant ; replis `localhost` supprimés ;
quartiers à l'accent cassé réparés et caractère illisible refusé à l'écriture (0 sur 91 commerces le
2 octobre) ; purge des données construite ; push web en service ; règle de mot de passe unique ; CORS sans
origines de développement en production ; horaires qui passent minuit ; refus de commande avec motif
transmis au client ; aperçu de partage avec la photo du commerce ; page 404 traduite ; tests automatiques du
parcours de commande (il n'en existait aucun côté backend au 16 septembre).
