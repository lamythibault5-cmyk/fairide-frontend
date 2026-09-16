# Avant la mise en ligne

Ce qu'il reste à faire avant d'ouvrir Fairide à de vrais commerçants et de vrais clients.

Établi le 30 août 2026, après une revue complète du frontend et une lecture du backend.
Mis à jour le 3 septembre 2026 (refonte visuelle, inscription par étapes, traduction des cartes).
Mis à jour le 12 septembre 2026 (référencement : pré-rendu, plan du site, adressage par langue — §11).
**Mis à jour le 16 septembre 2026** : chaque point a été re-vérifié contre le code, l'historique git
et l'API de production. Sept étaient devenus faux — le code avait avancé sans que le document suive.
Ce qui a été traité ce jour-là vit sur les branches `fix/avant-mise-en-ligne` des deux dépôts.

Chaque point a été vérifié dans le code — rien ici n'est supposé.

**Légende :** 🔴 bloquant · 🟠 obligation légale · 🟡 fiabilité · ⚪️ qualité

---

## Ce qui reste à faire, dans l'ordre

Tout le reste de ce document est du contexte. Voici la liste courte, et elle ne contient plus que
des choses qui demandent **un compte, une clé, un appareil ou une décision** — rien qui s'écrive.

1. **Faire passer un commerce par les quatre conditions, puis une vraie commande** (§1)
2. **Vérifier `STRIPE_SECRET_KEY`, `APP_URL`, `STRIPE_WEBHOOK_SECRET` sur Railway** (§2)
3. **Poser les clés VAPID sur Railway** et vérifier une notification sur un vrai téléphone (§6)
4. **Appliquer `schema.sql` sur Railway** — deux nouvelles tables attendent (§13)
5. **Poser `VITE_STOCK_DISH_PHOTOS=off` sur Vercel** avant le premier vrai commerce (§9)
6. **Trancher les dates affichées** : elles se contredisent entre elles (§14)
7. **Faire relire les pages légales** : il manque des engagements, pas du texte (§4)
8. Puis : Search Console et mesure d'audience (§11), traduction des dernières chaînes (§10)

---

## 🔴 1. Personne ne peut passer commande aujourd'hui

C'est le point le plus important du document, et il ne vient pas d'un bug : il vient de
l'état des données.

Pour qu'une commande soit acceptée, un commerce doit remplir **quatre** conditions
(`routes/orders.js`, création de commande) :

| Condition | Valeur par défaut à la création | Qui peut la changer |
|---|---|---|
| Être ouvert selon ses horaires | saisi par le commerçant | le commerçant |
| `subscription_status` = `active` ou `trialing` | `inactive` | Stripe uniquement |
| `admin_status` = `approved` | `pending` | console admin |
| `stripe_connect_status` = `active` | `not_started` | Stripe uniquement |

Un commerce fraîchement créé échoue donc sur **trois conditions sur quatre**. Deux d'entre
elles ne peuvent venir que de Stripe : aucune manipulation dans l'application ne les force.

**Il y a une cinquième condition, absente de ce tableau jusqu'ici :** une date. `routes/orders.js:11`
refuse toute commande en ligne avant le **10 octobre 2026**, réservations exceptées (1er octobre).
Elle est pilotée par `FAIRIDE_ORDERS_OPEN_AT`. Voir §14 : cette date ne correspond pas à ce que
l'accueil promet.

- [ ] Faire passer **au moins un commerce** par les quatre conditions, de bout en bout
- [ ] Passer **une vraie commande complète** : panier → paiement → réception côté commerçant →
      attribution à un livreur → livraison confirmée. Cela n'a encore jamais été fait.

**Ce qui a été fait le 16 septembre, et qui ne remplace pas ce point :** le parcours panier →
création de commande → paiement → e-mails de confirmation a été joué de bout en bout sur la base de
test locale, avec un paiement **simulé** (aucune clé Stripe en local) et la date d'ouverture
contournée par sa variable d'environnement. Cela prouve que la mécanique tient. Cela ne prouve rien
sur Stripe, sur l'attribution à un livreur, ni sur la livraison.

---

## 🔴 2. Configuration Stripe et Railway

- [ ] **Vérifier `STRIPE_SECRET_KEY`** : `sk_test_` (aucun argent réel) ou `sk_live_` ?
      Il faut le savoir avant d'annoncer quoi que ce soit à un commerçant.
- [ ] **Vérifier `APP_URL` sur Railway.** Vérification de 10 secondes, conséquence majeure.
- [ ] Confirmer que `STRIPE_WEBHOOK_SECRET` reste définie.

Le code ne retombe plus sur `localhost` quand ces variables manquent (voir §5), mais il **refuse**
alors de servir : paiement, abonnement, inscription Stripe et lien de réinitialisation répondent
503. Une variable absente est donc devenue visible au lieu d'être silencieuse — ce qui ne dispense
pas de la vérifier.

---

## ✅ 3. Fusionner les branches en attente — FAIT

`design/iris-5a` est dans `main` côté frontend. `feat/menu-translations` est dans `main` côté
backend. Vérifié le 16 septembre 2026 par `git branch --merged main` dans les deux dépôts.

Deux branches attendent maintenant une relecture, toutes deux du 16 septembre :

| Dépôt | Branche | Contenu |
|---|---|---|
| frontend | `fix/avant-mise-en-ligne` | robots.txt, sous-traitants RGPD, PWA + Web Push, accessibilité, quartier admin |
| backend | `fix/avant-mise-en-ligne` | replis `APP_URL`, refus du caractère illisible, Web Push |

⚠️ **Le frontend et le backend doivent partir ensemble.** Le frontend seul afficherait un bouton
« Activer les notifications » dont l'API n'existe pas encore côté serveur.

---

## 🟠 4. Obligations légales

### 4.1 Sous-traitants — ✅ déclarés, reste à faire relire

La politique de confidentialité ne citait que Google, Stripe et Resend. Elle liste désormais
**douze** sous-traitants dans un tableau, avec ce que chacun reçoit : Stripe, Resend, Google,
Nominatim, OSRM, OpenStreetMap, Anthropic, Cloudinary, Sentry, Vercel, Railway, Unsplash. La liste
vient de la relecture des appels réellement émis, fichier par fichier.

Corrigé au passage : `privacy.cookies` affirmait « aucun cookie publicitaire ou de tracking tiers »
alors que la politique cookies documente ceux de Stripe et de Google.

- [ ] **Vérifier que Nominatim et OSRM** (serveurs de démonstration publics, sans engagement
      contractuel) sont acceptables pour un usage commercial — sinon prévoir un service payant
- [ ] **Faire relire par un juriste** ce qui n'a volontairement pas été écrit, faute de pouvoir le
      vérifier : aucun délégué à la protection des données, aucun représentant UE, aucune clause de
      transfert hors UE alors que plusieurs prestataires sont établis aux États-Unis

### 4.2 Mentions légales — ✅ FAIT

Dénomination, BCE 1042.169.780, TVA, RPM Bruxelles, siège social, représentant légal et IBAN sont
renseignés (`translations.js`, espace `legalNotice`). Le document les croyait manquants.

### 4.3 Accessibilité — ✅ étiquettes faites, champs anonymes restants

L'Acte européen sur l'accessibilité s'applique au commerce en ligne depuis juin 2025.

Mesuré le 16 septembre avant travaux : **472 étiquettes, dont 153 associées** ; 86 enveloppent leur
champ, ce qui est valide ; **233 étaient orphelines**, sans aucun lien programmatique avec le champ
qu'elles nomment. Et **404 champs sans nom accessible**.

Après : **0 étiquette orpheline**, sur les quatre espaces (client, commerçant, livreur, admin).
L'identifiant vient de `useId()` là où le composant peut se répéter, et de la clé de
l'enregistrement dans les listes.

- [ ] Reste **~150 champs sans étiquette visible ni placeholder**, surtout dans la console admin :
      aucun nom ne peut en être tiré sans l'inventer, il faut décider quoi écrire. Ce chiffre
      surestime le problème — il ne voit pas à travers l'injection d'identifiant du composant
      `Champ` de l'inscription livreur, dont les champs sont bien nommés à l'exécution.

### 4.4 Déjà réglé ✅

- Bandeau cookies avec refus aussi accessible que l'acceptation
- Suivi des erreurs (Sentry) démarré uniquement après consentement
- Les 35 `<img>` ont toutes un `alt` ; un seul bouton sur 992 n'a pas de nom accessible

---

## ✅ 5. Trois replis dangereux côté backend — FAIT, et il y en avait cinq

Les trois replis signalés (webhook non signé accepté, commande marquée payée sans Stripe,
redirection vers `localhost`) sont corrigés dans `routes/payments.js` depuis le commit `c978922`.

**Mais le même repli `APP_URL || 'http://localhost:3000'` était resté nu dans quatre autres
fichiers**, non repérés à l'époque :

| Fichier | Ce qui cassait |
|---|---|
| `routes/auth.js` | **le lien de réinitialisation de mot de passe pointait vers `localhost`** |
| `routes/restaurants.js` (×2) | portail de facturation et abonnement Stripe revenaient nulle part |
| `stripeConnect.js` | l'inscription Stripe Connect revenait nulle part |

Celui d'`auth.js` était le pire : pas une redirection après paiement, mais un lien mort posé dans
une boîte mail, découvert par quelqu'un qui n'a plus accès à son compte.

Le repli vit maintenant dans `config.js`, à côté de la valeur qu'il protège : **un seul endroit
écrit `localhost`, et il refuse de le faire en production**. Sur oubli de mot de passe, le refus
intervient avant la recherche du compte, pour ne pas révéler quels e-mails sont inscrits.

---

## 🟡 6. Web Push — ✅ construit, reste les clés et un vrai appareil

Il n'existait **aucune** notification hors de l'onglet. Un commerçant qui verrouillait sa tablette
pendant le service ratait la commande.

C'est construit, des deux côtés :

- table `push_subscriptions` (une ligne par **navigateur**, pas par personne : la tablette de
  comptoir et le téléphone doivent sonner tous les deux) ;
- `pushService.js`, `routes/push.js`, et **un seul point d'accroche** : `markPaidAndNotify`, par où
  passe tout ce qui devient payé — solde, simulé, webhook Stripe, réservation ;
- `public/sw.js` côté site, qui **ne met rien en cache** délibérément, plus un bouton d'activation
  à côté de l'interrupteur de son existant ;
- les abonnements morts (404/410) sont supprimés à l'envoi, sans quoi la table se remplirait
  d'adresses qu'on retenterait à chaque commande.

- [ ] **Générer une paire VAPID et la poser sur Railway** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT`). Sans elles, la fonction se déclare inactive et rien ne casse : les commandes
      restent notifiées par e-mail.
- [ ] **Vérifier la réception sur un vrai téléphone.** Ce point n'a pas pu être vérifié : le
      navigateur piloté refuse la permission de notification sans interface, donc aucun abonnement
      réel n'a pu être créé. Ce qui a été vérifié : signature VAPID, envoi HTTP réel, purge d'une
      adresse morte, et dégradation propre sans clés.

⚠️ **Sur iPhone et iPad, le push n'arrive que si le site a été ajouté à l'écran d'accueil**
(iOS 16.4+). Un commerçant qui reste dans Safari ne recevra rien. La PWA est maintenant installable
(vraies icônes PNG, service worker), ce qui rend ce geste possible — pas automatique. Seul un
emballage natif (§7) lève la condition.

---

## 🟡 7. Le suivi du livreur s'interrompt à l'extinction de l'écran

La géolocalisation en arrière-plan **n'existe pas sur le web**. Le suivi s'arrête quand le
téléphone du livreur se verrouille, et rien ne peut y remédier côté site.

- [x] **Exposer `orders.driver_location_updated_at` au client — FAIT.** Le champ est renvoyé par le
      mapper de commande et consommé par `DeliveryTrackingMap`, qui compare ce **timestamp serveur**
      à l'horloge locale et affiche trois messages distincts selon que la position est fraîche,
      périmée (plus de deux minutes) ou seulement observée localement.
- [ ] Demander aux livreurs de garder l'écran allumé (déjà affiché dans leur tableau de bord)
- [ ] **Plus tard :** emballage Capacitor. Il réutilise le code du site tel quel, donne de vraies
      applications, la géolocalisation en arrière-plan **et** les notifications natives — ce qui
      réglerait la limite iOS du §6.

---

## 🟡 8. Environnement de test — ✅ en local, reste à le partager

Sans fichier de configuration local, `npm run dev` parle **à la base de production**.

- [x] `.env.local` en place, pointant sur un backend local (port 3001)
- [x] Base PostgreSQL jetable dans Docker (`fairide-test-db`, port 5433)
- [x] Un commerce de test y remplit les quatre conditions du §1
- [ ] **Une base de test hébergée** (Neon ou équivalent) : celle qui tourne n'existe que sur une
      seule machine, donc personne d'autre ne peut vérifier quoi que ce soit

Comptes de test, mot de passe `Fairide2026` : `client.test@fairide.local`,
`demo.woluwe.healthy@fairide.be`, `livreur.test@fairide.local`, `contact@fairide.be` (admin).

---

## ⚪️ 9. Photos de plats : décision prise

Un plat sans photo reçoit automatiquement une image de banque d'images choisie d'après son nom.
Présenter une photo générique comme le plat d'un commerçant donné est une pratique commerciale
trompeuse, et c'est **le commerçant** qui reçoit la réclamation.

**Décision : couper à la mise en ligne**, garder actif pour les démonstrations.

- [ ] Ajouter `VITE_STOCK_DISH_PHOTOS=off` sur Vercel avant le premier vrai commerce

⚠️ Le défaut est `on`, et **seule la valeur exacte `off` désactive** : une faute de frappe laisse les
photos actives. Le défaut peut être inversé pour que l'oubli coupe au lieu d'activer — au prix des
démonstrations, qui s'en trouveraient dépeuplées. À décider.

---

## ⚪️ 10. Les tableaux de bord sont en français uniquement — largement périmé

Le document annonçait « 12 pages sur 50 » traduites et « l'intégralité des espaces commerçant,
livreur et administration » non traduits. Ce n'est plus vrai : l'espace commerçant compte **625
appels `t()` sur 11 fichiers sur 12**, et `npm run check:i18n` donne **6 284 clés par langue, en
parité stricte** entre français, anglais et néerlandais.

- [ ] Deux chaînes françaises en dur subsistent côté commerçant : les motifs de suppression
      (`EditPage.jsx`) et une ligne de réservation (`OrdersPage.jsx`)
- [ ] Les pages légales sont, elles, entièrement traduites — le document les croyait à faire

---

## ⚪️ 11. Référencement : la plomberie est posée, deux branchements restent

Pré-rendu à la construction, plan du site produit depuis l'API, adressage par langue, `robots.txt`,
page « Notre histoire » : tout cela est en place.

**Une faille a été trouvée et corrigée le 16 septembre.** `robots.txt` interdisait onze espaces
privés — `/account`, `/orders`, `/dashboard`, `/admin`… — mais **à la racine seulement**. Comme
`/nl/…` et `/en/…` sont des URL de plein droit et non des redirections, `/nl/account` et `/en/admin`
étaient explorables : deux tiers de la surface privée restaient ouverts. Au passage, deux routes
protégées ne figuraient nulle part, même à la racine : `/map` et `/panier`. La liste suit désormais
exactement les routes portant `ProtectedRoute`, dans les trois langues.

- [ ] **Search Console** : vérifier la propriété du domaine, puis soumettre le plan du site
- [ ] **Mesure d'audience** : Plausible ou Matomo plutôt que Google Analytics — pas de cookie, donc
      pas de catégorie supplémentaire dans la bannière ni de sous-traitant de plus au §4.1

---

## ⚪️ 12. Aucun test automatisé

Il n'existe aucun test dans le projet. La seule vérification automatique est `npm run lint`, plus
`npm run check:i18n` pour la parité des traductions.

Décision du 16 septembre : **on n'introduit pas de cadre de test maintenant.** Chaque modification du
parcours de paiement continue d'être vérifiée à la main — d'où l'importance du §8.

---

## 🔴 13. Traduction des cartes : appliquer le schéma

Le code est écrit et fusionné dans `main`. Rien n'a encore été exécuté contre la base de production.

- [ ] **Appliquer `schema.sql` sur Railway.** Tout est en `CREATE TABLE IF NOT EXISTS`, donc rejouer
      le fichier entier est sans risque. **Deux tables attendent maintenant** : `menu_item_translations`
      et `push_subscriptions` (§6).
- [ ] **Vérifier `ANTHROPIC_API_KEY`.** Déjà requise par l'import de menu : si l'import fonctionne,
      la clé est là.
- [ ] **Tester sur UN seul commerce** avant d'annoncer le bouton aux autres.

**Coût, calculé sur les données réelles :** 3 628 plats, 81 609 caractères, 121 appels par lots de
30 → **0,66 $ une seule fois** pour rattraper les 91 cartes.

---

## 🟠 14. Les dates affichées se contredisent

Le document signalait une promesse d'application au 15 octobre. Le problème est plus large : **le
site et le serveur n'annoncent pas les mêmes dates.**

| Où | Ce qui est dit |
|---|---|
| Accueil (`landing.appSoonSub`) | appli le **1er octobre**, emporter dès le **5**, livraison dès le **15** |
| Serveur (`routes/orders.js:11`) | commandes en ligne — livraison **et** emporter — le **10 octobre** |
| Serveur (`routes/orders.js:15`) | réservations le **1er octobre** |
| Serveur (`routes/restaurants.js:36`) | abonnement le **15 octobre** |

Un client qui lit l'accueil essaiera donc de commander à emporter le 5 octobre et sera refusé
pendant cinq jours, avec un message qui lui annonce le 10. Ce n'est pas un choix de date : c'est une
contradiction entre deux fichiers.

**Et l'application mobile n'existe pas.** Il n'y a pas de projet natif ; la PWA est désormais
installable, ce qui n'est pas la même promesse que « sur iOS, Android et AppGallery ».

- [ ] **Trancher, et aligner les deux côtés.** Les dates vivent dans ~14 clés × 3 langues côté site,
      et dans trois variables d'environnement côté serveur (`FAIRIDE_ORDERS_OPEN_AT`,
      `FAIRIDE_RESERVATIONS_OPEN_AT`, `FAIRIDE_SUBSCRIPTION_OPEN_AT`) — donc modifiables sans
      redéploiement.
- [ ] Décider ce que devient la promesse « iOS, Android et AppGallery »

---

## ✅ 15. Quatre quartiers ont l'accent cassé en base — FAIT

Vérifié le 16 septembre en interrogeant l'API de production : **zéro caractère U+FFFD sur les 90
commerces**. `Barrière`, `Châtelain`, `Mérode` et `Étangs` sont correctement accentués.

La réparation venait d'un correcteur au démarrage (`server.js`), qui répare à partir d'un
dictionnaire de mots connus. **Mais il devinait le reste** : tout U+FFFD non répertorié devenait
« é ». Un « Ch�telain » absent de la liste serait devenu « Chételain » — un mot visiblement cassé
remplacé par un mot plausiblement faux, donc plus difficile à repérer, et impossible à distinguer
d'une faute de frappe du commerçant.

Depuis le 16 septembre : le dictionnaire reste, la devinette part. Ce qu'il ne sait pas réparer est
laissé intact et **signalé nommément au démarrage**, avec sa table, sa colonne et son identifiant.
Surtout, le caractère est maintenant **refusé à l'écriture** sur les deux routes qui écrivent les
champs texte d'un commerce — le seul moment où la lettre d'origine existe encore.

- [x] Les quatre valeurs sont correctes en production
- [x] Refuser un U+FFFD à l'écriture — c'était marqué « optionnel »
- [x] Le quartier est devenu modifiable depuis la console admin : l'API l'acceptait déjà, seul le
      formulaire ne l'offrait pas, ce qui obligeait à se connecter sous le compte du commerçant

---

## 🟡 16. La règle de mot de passe est incohérente

Découvert hors document, non corrigé : une règle de sécurité ne se change pas sans arbitrage.

| Où | Règle |
|---|---|
| Inscription (`auth.js:194`) | ≥ 5 caractères, une majuscule, une minuscule |
| Réinitialisation (`auth.js:392`) | ≥ 5 caractères, une majuscule, une minuscule |
| Changement (`auth.js:800`) | ≥ 8 caractères, **aucune contrainte de casse** |

Donc `Ab12c` ouvre un compte mais ne peut pas devenir le nouveau mot de passe, et `password` fait
l'inverse. Cinq caractères est par ailleurs court pour un compte qui porte une adresse de domicile
et un historique de commandes.

- [ ] Choisir une règle unique et l'appliquer aux trois endroits
