# Avant la mise en ligne

Ce qu'il reste à faire avant d'ouvrir Fairide à de vrais commerçants et de vrais clients.

Établi le 30 août 2026, après une revue complète du frontend et une lecture du backend.
Mis à jour le 3 septembre 2026 (refonte visuelle, inscription par étapes, traduction des cartes).
Mis à jour le 12 septembre 2026 (référencement : pré-rendu, plan du site, adressage par langue — §11).
**Mis à jour le 16 septembre 2026** : chaque point a été re-vérifié contre le code, l'historique git
et l'API de production. Sept étaient devenus faux — le code avait avancé sans que le document suive.
Ce qui a été traité ce jour-là vit sur les branches `fix/avant-mise-en-ligne` des deux dépôts.

Chaque point a été vérifié dans le code — rien ici n'est supposé.

**Mis à jour le 16 septembre 2026 (soir)** : audit de sécurité des 17 catégories d'`AI-CHECKLIST.md`
sur les deux dépôts — voir **§17**, et le rapport dans [security/AUDIT.md](security/AUDIT.md). Trois
failles ouvraient la plateforme entière et étaient en production ; elles sont corrigées sur
`hotfix/securite-critique` et `fix/securite`.

**Mis à jour le 18 septembre 2026** : ces trois branches sont **fusionnées dans `main`** des deux
côtés — vérifié, zéro commit absent. La phrase qui disait qu'elles « restaient à fusionner » était
donc devenue fausse, et elle aurait fait perdre du temps le jour de la mise en ligne, voire fait
croire à un danger qui n'existe plus. Il n'y a plus rien à fusionner côté sécurité.

Un second audit, le même jour, a couvert les cinq failles les plus fréquentes du code généré
(injection, XSS, secrets en dur, authentification, IDOR) et la liste de contrôle avant déploiement :
`npm audit` propre sur les deux dépôts, en-têtes de sécurité mesurés sur le serveur et non lus dans
la configuration, requêtes toutes paramétrées, propriété vérifiée dans le `WHERE`. Deux failles
trouvées et corrigées : une session qui survivait au changement de mot de passe, et un joker `LIKE`
qui permettait de viser le dossier d'identité d'un autre livreur.

**Légende :** 🔴 bloquant · 🟠 obligation légale · 🟡 fiabilité · ⚪️ qualité

---

## Ce qui reste à faire, dans l'ordre

Tout le reste de ce document est du contexte. Voici la liste courte, et elle ne contient plus que
des choses qui demandent **un compte, une clé, un appareil ou une décision** — rien qui s'écrive.

0. 🔴 **SÉCURITÉ** (§17) — les correctifs sont fusionnés, il ne reste que ce qui ne s'écrit pas :
   **vérifier `JWT_SECRET` sur Railway, puis changer ce secret, puis regarder les journaux.** Le
   changement de secret déconnecte tout le monde d'un coup, ce qui est justement le but après une
   faille qui délivrait un jeton d'administrateur contre une simple adresse e-mail. (Depuis le
   18 septembre, une réinitialisation de mot de passe ferme aussi les sessions du compte concerné,
   sans toucher aux autres — voir `token_version`.)
1. **Faire passer un commerce par les quatre conditions, puis une vraie commande** (§1)
2. **Vérifier `STRIPE_SECRET_KEY`, `APP_URL`, `STRIPE_WEBHOOK_SECRET` sur Railway** (§2)
3. **Poser `VITE_STOCK_DISH_PHOTOS=off` sur Vercel, PUIS reconstruire** — avant le premier vrai
   commerce (§9). Les clés VAPID sont posées sur Railway depuis le 16 septembre ; reste à vérifier
   une notification sur un vrai téléphone (§6) — les branches sont fusionnées, plus rien n'attend.
4. **Faire relire les pages légales** : il manque des engagements, pas du texte (§4), et au regard
   du **règlement P2B**, qui s'applique dès le premier restaurant vendeur (§18.4)
5. **Signer les accords de sous-traitance (DPA)** des huit prestataires qui traitent des données
   personnelles — administratif, quelques minutes chacun (§18.2)
6. **Essayer une restauration de sauvegarde** dans une base vide, avant le premier vrai commerce :
   une sauvegarde jamais restaurée est une supposition (§18.3)
7. **Trancher la promesse d'application mobile** affichée sur l'accueil (§14)
8. **Automatiser la purge des données** aux durées que la politique annonce (§18.1) — le seul point
   où le site promet une chose que le système ne fait pas. Pas bloquant le jour J, mais à ne pas
   laisser traîner : c'est ce qu'un auditeur regarde en premier.
9. Puis : Search Console et mesure d'audience (§11), traduction des dernières chaînes (§10)

`schema.sql` ne figure plus dans cette liste : il s'applique tout seul au démarrage du serveur,
donc déployer suffit (§13).

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

**Il y a une cinquième condition, absente de ce tableau jusqu'ici :** une date. `routes/orders.js`
refuse chaque service avant son ouverture — réservation et à emporter le **5 octobre 2026**,
livraison le **15**. Chacune est pilotée par sa propre variable (`FAIRIDE_DINE_IN_OPEN_AT`,
`FAIRIDE_PICKUP_OPEN_AT`, `FAIRIDE_DELIVERY_OPEN_AT`), donc déplaçable sans redéploiement. Les
comptes administrateurs et de test passent outre, ce qui permet d'essayer avant l'ouverture.

**Relevé le 16 septembre 2026 sur les 90 commerces de production** (l'API publique expose les trois
conditions de données) :

| Condition | Remplie |
|---|---|
| `subscription_status` actif | **90 / 90** ✅ |
| `admin_status` = `approved` | **90 / 90** ✅ |
| `stripe_connect_status` = `active` | **0 / 90** ❌ |
| Commerces réels (hors démo) | **0** |

Autrement dit : **les 90 commerces en ligne sont des jeux de démonstration**, et aucun n'a configuré
ses paiements. Le blocage ne tient donc pas au code mais à l'absence de vrais commerçants.

À noter, c'est moins bloquant qu'il n'y paraît : sans Stripe Connect, un commerce peut quand même
prendre des **réservations de table** (gratuites) et des **commandes à emporter payées sur place**
(`routes/orders.js`, deux exemptions explicites). Ce qui reste impossible, c'est la livraison et tout
paiement en ligne. Et pour la livraison, chaque **livreur** doit lui aussi avoir son Stripe Connect
actif avant de pouvoir accepter une course.

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

> **Région d'hébergement : EU West** — vérifié dans le tableau de bord Railway le 18 septembre 2026.
> Base de données et backend sont donc dans l'Union européenne. Ce n'est pas qu'une case RGPD : ça
> rend exacte la phrase « plateforme belge, données en Europe », et ça retire le sujet de la table
> quand un commerçant ou un journaliste posera la question. À ne pas perdre lors d'une migration.

**Relevé le 16 septembre 2026 sur `/api/health` en production** — le serveur expose lui-même quelles
variables sont présentes (sans jamais révéler leur valeur) :

| Variable | Présente ? |
|---|---|
| `APP_URL` | ✅ |
| `STRIPE_SECRET_KEY` | ✅ |
| `STRIPE_WEBHOOK_SECRET` | ✅ |
| e-mail (Resend) | ✅ |
| `ANTHROPIC_API_KEY` | ✅ |
| PEPPOL | ✅ |
| SMS (Twilio) | ❌ — facultatif, les codes repartent par e-mail |
| itsme | ❌ — l'identité passe par Stripe Identity |

- [x] `APP_URL` est bien définie — le point le plus risqué du §5 est donc sans objet en production
- [x] `STRIPE_WEBHOOK_SECRET` est définie
- [ ] **Reste à vérifier : la clé Stripe est-elle `sk_test_` ou `sk_live_` ?** `/api/health` dit
      seulement qu'elle existe, pas laquelle. À lire dans les variables Railway, ou dans le tableau
      de bord Stripe (bascule Test / Live). Il faut le savoir avant d'annoncer quoi que ce soit à un
      commerçant : avec une clé de test, aucun argent ne bouge.

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
| backend | `fix/avant-mise-en-ligne` | replis `APP_URL`, refus du caractère illisible, Web Push, fusion de `main` |

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

- [x] **Générer une paire VAPID et la poser sur Railway** (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
      `VAPID_SUBJECT`) — **fait le 16 septembre 2026.** Sans elles, la fonction se serait déclarée
      inactive sans rien casser : les commandes seraient restées notifiées par e-mail.
      Pas encore vérifiable : la route `/api/push/key` n'existera en production qu'une fois la branche
      backend fusionnée. Après la fusion, ouvrir
      `https://fairide-backend-production.up.railway.app/api/push/key` : elle doit répondre
      `"enabled": true` et une longue clé. Si elle répond `false`, les variables ne sont pas prises.
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

- [ ] **Poser la variable sur Vercel, puis reconstruire.** Marche à suivre :
      1. vercel.com → projet **fairide-frontend** → **Settings** → **Environment Variables**
      2. **Add** : nom `VITE_STOCK_DISH_PHOTOS`, valeur `off` (trois lettres, minuscules, sans espace)
      3. Cocher **Production** — et **Preview** aussi, si les aperçus doivent être propres
      4. **Save**
      5. **Deployments** → le déploiement le plus récent → **⋯** → **Redeploy**

⚠️ **L'étape 5 n'est pas optionnelle.** Vite lit les variables `VITE_*` *pendant la construction* et
inscrit leur valeur dans le JavaScript produit ; le site en ligne ne relit jamais la variable.
Poser la variable sans reconstruire ne change donc rien du tout — contrairement à Railway, où le
serveur relit ses variables à chaque démarrage.

⚠️ **Seule la valeur exacte `off` désactive.** `Off`, `OFF`, `false`, `0` ou un espace en trop
laissent les photos **actives** (`menuCategories.js`, le test est `!== 'off'`). Le défaut est `on` :
une faute de frappe échoue donc du mauvais côté. Le défaut peut être inversé pour que l'oubli coupe
au lieu d'activer — au prix des démonstrations, qui s'en trouveraient dépeuplées. À décider.

**Pour vérifier :** ouvrir une fiche de commerce sur fairide.be dont des plats n'ont pas de vraie
photo. Ils doivent montrer l'emoji de leur catégorie, et non une photo. Si les photos sont toujours
là, c'est la reconstruction qui manque, pas la variable.

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

- [x] **Appliquer `schema.sql` sur Railway — RIEN À FAIRE À LA MAIN.** Le fichier est rejoué à
      chaque démarrage du serveur (`initSchema()` dans `db.js`, appelé par `server.js` ; la première
      ligne de `schema.sql` le dit). Tout est en `CREATE TABLE IF NOT EXISTS`, donc c'est sans risque
      pour les données. **Déployer, c'est appliquer le schéma** : les deux tables qui attendent
      (`menu_item_translations` et `push_subscriptions`) arriveront à la fusion des branches. Aucune
      console SQL, aucune commande.
- [ ] **Vérifier `ANTHROPIC_API_KEY`.** Déjà requise par l'import de menu : si l'import fonctionne,
      la clé est là.
- [ ] **Tester sur UN seul commerce** avant d'annoncer le bouton aux autres.

**Coût, calculé sur les données réelles :** 3 628 plats, 81 609 caractères, 121 appels par lots de
30 → **0,66 $ une seule fois** pour rattraper les 91 cartes.

---

## ✅ 14. Les dates s'accordent enfin — reste la promesse d'application

**Corrigé entre-temps, par `main`.** Ce point signalait une contradiction réelle : l'accueil invitait
à commander à emporter dès le 5 octobre quand le serveur refusait jusqu'au 10. Les commits du
16 septembre ont refondu le calendrier côté serveur, et les deux côtés disent maintenant la même
chose :

| Service | Ouverture | Où |
|---|---|---|
| Réservation de table | 5 octobre | `FAIRIDE_DINE_IN_OPEN_AT` |
| À emporter | 5 octobre | `FAIRIDE_PICKUP_OPEN_AT` |
| Livraison | 15 octobre | `FAIRIDE_DELIVERY_OPEN_AT` |
| Abonnement commerce | 1er octobre | `FAIRIDE_SUBSCRIPTION_OPEN_AT` |

Ce qui correspond à l'accueil : « réserve ta table ou commande à emporter dès le 5 octobre, en
livraison dès le 15 ». Vérifié à l'écran sur la fiche d'un commerce, qui affiche exactement cette
phrase. Les anciennes variables (`FAIRIDE_ORDERS_OPEN_AT`, `FAIRIDE_RESERVATIONS_OPEN_AT`) portaient
l'ancien calendrier et sont désormais ignorées — ne pas les reposer sur Railway.

**Reste la promesse d'application mobile.** L'accueil annonce l'appli « le 1er octobre sur iOS,
Android et AppGallery ». Il n'y a pas de projet natif. La PWA est maintenant installable, ce qui
n'est pas la même promesse : ajouter un site à son écran d'accueil n'est pas le télécharger sur une
boutique.

- [ ] Décider : livrer un emballage natif, repousser la date, ou retirer la promesse. Les dates
      vivent dans ~14 clés × 3 langues, et les ouvertures de service sont pilotées par les quatre
      variables ci-dessus — donc modifiables sans redéploiement.

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

## ✅ 16. La règle de mot de passe est incohérente — FAIT (18 septembre 2026)

Les trois chemins divergeaient : `Ab12c` ouvrait un compte mais ne pouvait pas devenir le nouveau
mot de passe, et `password` faisait l'inverse — un mot de passe accepté par un écran était refusé
par l'autre, sans que rien ne l'explique.

**Règle unique retenue : au moins 8 caractères, une majuscule, une minuscule.** C'est le seuil que
le changement depuis Mon compte exigeait déjà ; ce sont l'inscription et la réinitialisation qui
étaient en dessous, à 5 — court pour un compte qui porte une adresse de domicile et un historique de
commandes, et sous le minimum recommandé par le NIST.

Appliquée aux **six** endroits, et non aux trois annoncés : les trois contrôles serveur, le contrôle
client de Mon compte (qui ne regardait que la longueur, donc laissait partir une requête que le
serveur refusait en 400), et les textes d'aide — qui annonçaient encore « au moins 5 caractères »
dans les trois langues alors que le serveur en exigeait 8. Un mot de passe annoncé valide était
refusé à l'envoi.

- [x] Règle unique appliquée partout, serveur et client, messages compris

---

## 🔴 17. Sécurité : audit complet du 16 septembre 2026

Les 17 catégories de `AI-CHECKLIST.md` ont été passées sur les deux dépôts. Le rapport détaillé est
dans **[security/AUDIT.md](security/AUDIT.md)** ; ce qui suit est seulement ce qui **ne se règle pas
en écrivant du code** — il faut une clé, un accès, une migration ou une décision.

L'essentiel du travail est fait : sur les 17 catégories, 13 sont conformes après correctifs, et
`npm audit` est passé de 5 vulnérabilités à 0. Mais **trois failles ouvraient la plateforme entière,
et elles étaient sur `main`** — donc en production pendant que ce document existait.

### 17.1 🔴 À FAIRE EN PREMIER : fusionner et déployer le correctif d'urgence

Branche `hotfix/securite-critique` (backend), partie de `main`, trois fichiers.

Ce qui était ouvert, vérifié en l'exploitant pour de vrai :

| Faille | Ce qu'elle donnait |
|---|---|
| `verify-email` ne comparait pas le code | Un jeton **administrateur** de 30 jours contre une simple adresse e-mail — et l'adresse est publiée sur le site |
| Adresse d'équipe prenable | S'inscrire avec, ou y basculer son e-mail, donnait les droits admin |
| Quantité de commande non validée | Total négatif → commande **marquée payée sans encaissement** |

La troisième n'était pas encore exploitable : les commandes en ligne sont fermées jusqu'au
10 octobre. Les deux premières l'étaient.

- [ ] Fusionner `hotfix/securite-critique` et vérifier que Railway a bien redéployé

### 17.2 🔴 Vérifier `JWT_SECRET` sur Railway — AVANT de fusionner `fix/securite`

Le secret de signature retombait en silence sur une chaîne publique écrite dans le dépôt. Le serveur
**refuse désormais de démarrer en production sans cette variable** — c'est voulu : un site éteint se
remarque et se répare, un site ouvert à tous non.

Conséquence directe : **si la variable n'existe pas sur Railway, ce correctif coupe le site.**

- [ ] Railway → Variables → confirmer que `JWT_SECRET` existe et n'est pas vide
- [ ] Seulement ensuite, fusionner `fix/securite`

### 17.3 🟠 Changer `JWT_SECRET`, une fois le 17.1 déployé

Tant que la première faille était ouverte, n'importe qui a pu se délivrer des jetons valables
30 jours. Les corriger ne les révoque pas : un jeton déjà émis reste valable jusqu'à son échéance.
Changer le secret est le seul moyen de tous les invalider.

**Effet de bord assumé : tout le monde est déconnecté** et devra se reconnecter. C'est le prix, et il
est faible.

À faire dans cet ordre, sinon ça ne sert à rien : d'abord déployer 17.1, ensuite changer le secret.

- [ ] Changer `JWT_SECRET` sur Railway par une longue chaîne aléatoire, puis redéployer

### 17.4 🔴 Regarder si la faille a servi

Je n'en ai trouvé aucune trace, mais **je n'ai pas cherché dans les journaux de production** — je n'y
ai pas accès. Un appel à `POST /api/auth/verify-email` suivi d'une activité administrateur
inattendue est le motif à chercher.

Si la faille a été exploitée, la notification à l'Autorité de protection des données est une
obligation légale (72 heures), pas une option. C'est une décision qui t'appartient.

- [ ] Parcourir les journaux Railway sur les semaines écoulées

### 17.5 🟠 Documents d'identité des livreurs : URL publiques

Les cartes d'identité, permis et titres de séjour envoyés par les livreurs sont stockés chez
Cloudinary à des adresses **publiques, permanentes et non signées**. La route de l'API est bien
protégée ; le fichier, lui, ne l'est pas — l'adresse suffit à le télécharger, sans compte.

Les identifiants sont aléatoires, donc personne ne peut les deviner. Mais une adresse qui apparaît
une fois dans un journal, un ticket de support ou un en-tête de référent reste valable pour toujours.
Pour des pièces d'identité sous RGPD, c'est une livraison signée qu'il faut (`type: 'authenticated'`,
URL à durée limitée).

Ce n'est pas un simple réglage : **les adresses déjà enregistrées en base deviendront invalides**, il
faut migrer l'existant. Je peux écrire la migration, dis-le-moi.

- [ ] Décider, puis planifier la migration

### 17.6 🟠 `COURIER_DATA_KEY` : attention, piège

Les numéros de registre national des livreurs sont bien chiffrés (AES-256-GCM, correctement mis en
œuvre). Mais faute de clé dédiée, la clé est **dérivée de `JWT_SECRET`**.

D'où le piège, qui touche aussi le 17.3 : **changer `JWT_SECRET` sans poser d'abord
`COURIER_DATA_KEY` rendra les numéros déjà chiffrés illisibles.** Il faut un script qui déchiffre
avec l'ancienne clé et rechiffre avec la nouvelle, lancé pendant que les deux sont connues.

- [ ] Me demander le script de re-chiffrement avant de toucher à l'une ou l'autre variable

### 17.7 🟡 Passer la politique de contenu en mode bloquant

`vercel.json` pose maintenant une politique de sécurité du contenu, mais en **observation seule** :
posée d'un coup en mode bloquant, une politique stricte casse silencieusement Leaflet, la connexion
Google ou Sentry. Les origines ont été relevées dans le code, mais seule la vraie page le dira.

- [ ] Après déploiement, ouvrir la console du navigateur (F12) sur : l'accueil, une fiche commerce,
      la carte, le paiement, la console admin
- [ ] Si rien n'est signalé, retirer `-Report-Only` du nom de l'en-tête dans `vercel.json`

### 17.8 🟡 Les décisions qui restent

- **Règle de mot de passe** : 5 caractères aujourd'hui, sur une plateforme qui détient des moyens de
  paiement et des pièces d'identité. Voir §16 — c'est le même sujet, vu sous l'angle sécurité.
- **Agenda iCal** : le jeton n'est pas devinable, mais l'URL circule dans Google/Apple Calendar, et
  l'option « détails » y expose téléphone et e-mail des clients. Le défaut mériterait d'être inversé.
- **`CORS_ORIGINS`** : poser la variable en production pour retirer les origines `localhost` de la
  liste par défaut.
- **Railway** : vérifier que la construction utilise `npm ci` et non `npm install`, sinon le verrou
  de dépendances ne sert à rien.

### 17.9 Ce qui a été corrigé, pour mémoire

Sans action de ta part, déjà sur les branches : le SSRF non authentifié (redirections revérifiées à
chaque saut), les accès admin ouverts par la casse de l'URL et par la méthode HTTP, le XSS stocké des
cartes (un nom de commerce s'exécutait dans le navigateur du livreur), les en-têtes de sécurité des
deux côtés, les générateurs de codes prévisibles (dont les bons cadeaux, remboursables en argent),
les limites manquantes sur les appels d'IA et sur les codes de solde, les litiges Stripe qui
n'étaient pas traités, le webhook qui avalait ses erreurs, la fiche des commerces non publiés qui
exposait leur identification légale, et `npm audit` ramené à zéro.

---

## 🟠 18. Conformité : l'écart entre ce qu'on promet et ce que la machine fait

Ajouté le 18 septembre 2026, après un second audit (les cinq failles les plus fréquentes du code
généré, la liste de contrôle avant déploiement, et un passage d'OWASP ZAP sur l'instance locale :
0 High, 0 Medium, 0 Low).

**Le code est en bon état.** Ce qui reste n'est presque pas du code : c'est l'écart entre ce que la
politique de confidentialité promet et ce qu'un programme exécute réellement. C'est exactement ce
qu'un auditeur, une banque ou un commerçant un peu regardant ira vérifier en premier.

### 18.1 🟠 La purge des données n'est pas automatique

`routes/adminCompliance.js` le dit en toutes lettres : « Rétention : volumes concernés par la
politique de conservation (**informatif, aucune purge automatique ici**) ». L'écran admin **compte**
les données périmées — tickets de plus de 3 ans, scores de plus d'un an, commandes de plus de 7 ans —
il n'en supprime aucune.

Or la politique promet : compte anonymisé **3 ans** après la dernière activité, journaux techniques
**12 mois**, demandes au support **3 ans**, demandes RGPD **5 ans**. Personne n'exécute ces durées.
C'est le seul point où le site promet une chose que le système ne fait pas.

- [ ] Une tâche planifiée qui applique les durées annoncées, et qui **journalise ce qu'elle a
      supprimé** (une purge silencieuse est impossible à prouver à un auditeur)
- [ ] La faire tourner d'abord en mode « compte seulement », comparer avec l'écran Rétention, puis
      l'activer

### 18.2 🟠 Les accords de sous-traitance (DPA) ne sont pas signés

La politique nomme **14 sous-traitants** (Stripe, Resend, Cloudinary, Sentry, Vercel, Railway,
Anthropic, Twilio, Google, itsme, Nominatim, Photon, OSRM, Unsplash). Les nommer est l'obligation de
transparence ; l'article 28 du RGPD demande en plus un **contrat écrit** avec chacun de ceux qui
traitent des données personnelles pour votre compte.

Ce n'est pas du code, c'est de l'administratif — la plupart se signent en ligne en quelques minutes.

- [ ] Signer le DPA de Stripe, Resend, Cloudinary, Sentry, Vercel, Railway, Anthropic, Twilio
- [ ] Ranger les copies au même endroit, avec la date

### 18.3 🟡 Sauvegardes : aucune trace dans le code

Je n'ai trouvé **aucune politique de sauvegarde** dans les deux dépôts. Railway en propose, mais une
sauvegarde dont la restauration n'a jamais été essayée n'est pas une sauvegarde : c'est une
supposition. À faire avant le premier vrai commerce, pas après.

- [ ] Vérifier ce que Railway sauvegarde, à quelle fréquence, et combien de temps il le garde
- [ ] **Restaurer une copie dans une base vide et vérifier qu'elle démarre** — c'est possible depuis
      le 18 septembre : le schéma sait enfin se créer de zéro en une passe (il en fallait deux avant,
      voir le correctif `securite/cache-et-schema`)

### 18.4 🟠 Règlement P2B : il s'applique dès le premier restaurant

Le règlement (UE) 2019/1150 vise les **intermédiaires en ligne pour des professionnels** — ce que
Fairide est, dès qu'un commerçant y vend. Il impose des conditions générales claires, un **préavis
avant toute modification**, un **motif écrit** en cas de suspension ou de déréférencement d'un
commerce, et un **système interne de traitement des plaintes**.

`RestaurantContract` et les CGV en couvrent une partie. Ce n'est pas une obligation qu'on découvre
au premier litige.

- [ ] Faire relire les CGV commerçants au regard du P2B
- [ ] Vérifier qu'une suspension de commerce (`PATCH /admin/restaurants/:id/status`) produit bien un
      motif communiqué au commerçant, et pas seulement une ligne en base

### 18.5 ⚪️ DSA et AI Act : exposition faible, à connaître quand même

- **DSA** : Fairide est une plateforme en ligne. Sous 50 salariés et 10 M€ de chiffre d'affaires,
  les obligations lourdes ne s'appliquent pas, mais le **point de contact** et le **mécanisme de
  signalement** restent dus.
- **AI Act** : l'IA ne sert qu'à lire une carte (photo, adresse, texte collé), traduire des plats et
  lire un plan de salle. Ni haut risque, ni interdit — l'obligation est la transparence, et la
  politique cite déjà Anthropic. Le risque réel est commercial, pas réglementaire : **une carte mal
  lue affiche un mauvais prix**, d'où la relecture par le restaurateur, qui existe déjà.
- **DAC7** : déjà construit (`/admin/couriers/export/dac7` et l'export 281.29). En avance.

### 18.6 🔴 Rappel : ce qui reste de l'audit du 16 septembre

- [ ] **Vérifier puis changer `JWT_SECRET` sur Railway.** Tant que ce secret n'a pas tourné, tout
      jeton forgé à l'époque de la faille administrateur reste valable jusqu'à son expiration.
      `ANCIEN_JWT_SECRET` existe pour faire la rotation sans déconnecter tout le monde d'un coup.
- [ ] Valider la signature du jeton itsme via le JWKS (`ITSME_VERIFY_JWKS`), quand le contrat itsme
      sera en place. Le jeton arrive par un appel serveur-à-serveur en TLS direct, ce qu'OIDC Core
      §3.1.3.7 admet en remplacement — mais ce n'est pas une raison de s'en passer une fois possible.
