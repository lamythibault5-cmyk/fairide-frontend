# Avant la mise en ligne

Ce qu'il reste à faire avant d'ouvrir Fairide à de vrais commerçants et de vrais clients.

Établi le 30 août 2026, après une revue complète du frontend et une lecture du backend.
Chaque point a été vérifié dans le code — rien ici n'est supposé.

**Légende :** 🔴 bloquant · 🟠 obligation légale · 🟡 fiabilité · ⚪️ qualité

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

- [ ] Faire passer **au moins un commerce** par les quatre conditions, de bout en bout
- [ ] Passer **une vraie commande complète** : panier → paiement → réception côté commerçant →
      attribution à un livreur → livraison confirmée. Cela n'a encore jamais été fait.

Tant que ce n'est pas fait, on ne sait pas si la plateforme fonctionne.

---

## 🔴 2. Configuration Stripe et Railway

- [ ] **Vérifier `STRIPE_SECRET_KEY`** : `sk_test_` (aucun argent réel) ou `sk_live_` ?
      Il faut le savoir avant d'annoncer quoi que ce soit à un commerçant.
- [ ] **Vérifier `APP_URL` sur Railway.** Si elle est absente, le code retombe sur
      `http://localhost:3000` (`routes/payments.js`) : **les clients seraient renvoyés vers
      une page inexistante après avoir payé.** Vérification de 10 secondes, conséquence majeure.
- [ ] Confirmer que `STRIPE_WEBHOOK_SECRET` reste définie (elle l'est aujourd'hui — voir §5).

---

## 🔴 3. Fusionner la branche de corrections

La branche `fix/production-readiness` corrige des défauts qui feraient perdre des commandes
dès le premier jour : panier vidé avant paiement, page de confirmation qui annonçait le succès
sans rien vérifier, session expirée qui bloquait l'application sans issue, page blanche à la
moindre erreur d'affichage.

- [ ] Relire et fusionner la branche
- [ ] Vérifier le déploiement Vercel après fusion

---

## 🟠 4. Obligations légales

### 4.1 Sous-traitants non déclarés (RGPD)

La politique de confidentialité ne cite que **Google, Stripe et Resend**. Or ces services
reçoivent aussi des données personnelles, vérifié dans le code :

| Service | Ce qu'il reçoit | Où |
|---|---|---|
| **Nominatim** (OpenStreetMap) | **l'adresse du domicile des clients**, pour la géolocaliser | `geocode.js` |
| **Anthropic** | **le texte que les clients écrivent** dans l'assistant | `routes/assistant.js` |
| **OSRM** | position du livreur et adresse de livraison | `DeliveryTrackingMap.jsx` |
| **Cloudinary** | photos envoyées par les commerçants | `cloudinary.js` |
| **Sentry** | adresse IP et pages visitées (désormais après consentement) | `main.jsx` |

- [ ] Ajouter ces cinq sous-traitants à la politique de confidentialité
- [ ] Vérifier que Nominatim et OSRM (serveurs de démonstration publics, sans engagement
      contractuel) sont acceptables pour un usage commercial — sinon prévoir un service payant

### 4.2 Mentions légales

- [ ] Compléter avec les informations réelles de la société : dénomination, numéro
      d'entreprise (BCE), numéro de TVA, siège social, RPM

### 4.3 Accessibilité

L'Acte européen sur l'accessibilité s'applique au commerce en ligne depuis juin 2025. Les
étiquettes de formulaire n'ont été corrigées que sur l'inscription et le paiement.

- [ ] Étendre aux autres formulaires (tableaux de bord notamment)

### 4.4 Déjà réglé ✅

- Bandeau cookies avec refus aussi accessible que l'acceptation
- Suivi des erreurs (Sentry) démarré uniquement après consentement

---

## 🟠 5. Trois replis dangereux côté backend

Aucun n'est ouvert aujourd'hui. Tous s'ouvriraient **silencieusement** si une variable
d'environnement disparaissait — rotation de clé, migration de projet, faute de frappe. Dans
les trois cas, le code choisit l'option permissive au lieu de refuser.

| Où | Repli actuel | Correction |
|---|---|---|
| `routes/payments.js` (webhook) | sans `STRIPE_WEBHOOK_SECRET`, accepte **tout POST non signé** comme un événement Stripe authentique — donc marquer n'importe quelle commande payée | exiger la signature en production |
| `routes/payments.js` (paiement) | sans `STRIPE_SECRET_KEY`, marque la commande payée sans paiement | refuser en production |
| `routes/payments.js` (redirections) | sans `APP_URL`, renvoie vers `localhost` | refuser au démarrage |

- [ ] Corriger les trois (une dizaine de lignes au total)

---

## 🟡 6. Les commerçants ne sont prévenus que si l'onglet reste ouvert

Il n'existe aujourd'hui **aucune notification** hors de l'onglet : ni service worker, ni Web
Push. La branche de corrections ajoute un son, un compteur dans le titre de l'onglet et une
notification système — mais les trois exigent que la page reste ouverte et l'appareil allumé.

Un commerçant qui verrouille sa tablette pendant le service **rate la commande**.

- [ ] **Court terme :** l'écrire noir sur blanc dans le contrat et le mode d'emploi
      (« l'onglet doit rester ouvert pendant le service »)
- [ ] **Avant d'accueillir plus de deux ou trois commerces :** implémenter le Web Push
      (service worker côté site + clés VAPID et stockage des abonnements côté serveur)

C'est aussi ce qui débloquerait les notifications de promotions aux clients.

---

## 🟡 7. Le suivi du livreur s'interrompt à l'extinction de l'écran

La géolocalisation en arrière-plan **n'existe pas sur le web**. Le suivi s'arrête quand le
téléphone du livreur se verrouille, et rien ne peut y remédier côté site.

**Décision recommandée :** ne pas développer d'application mobile maintenant. Le coût n'est
justifié qu'une fois plusieurs commerces réellement actifs. En attendant :

- [ ] Demander aux livreurs de garder l'écran allumé (déjà affiché dans leur tableau de bord)
- [ ] Exposer `orders.driver_location_updated_at` au client — **la colonne existe déjà et est
      remplie à chaque envoi de position**, elle n'est simplement pas renvoyée. Une ligne dans
      le mapper de commande, et le client voit une information exacte plutôt qu'une carte figée
      indiscernable d'un livreur à l'arrêt.
- [ ] **Plus tard :** emballage Capacitor. Il réutilise le code du site tel quel, donne de
      vraies applications App Store / Play Store, la géolocalisation en arrière-plan **et** les
      notifications natives — ce qui réglerait aussi le §6, y compris sur iPhone.

---

## 🟡 8. Pas d'environnement de test

Sans fichier de configuration local, `npm run dev` parle **à la base de production**. Toute
manipulation depuis un poste de développement touche les vraies données, sans aucun signal.

- [ ] Créer une seconde base de données pour les essais (un service gratuit type Neon suffit,
      rien à installer)
- [ ] Y placer un commerce de test remplissant les quatre conditions du §1
- [ ] Chaque personne qui développe copie `.env.example` en `.env.local` et pointe dessus

C'est le prérequis pour tester sans risque tout ce que ce document demande de tester.

---

## ⚪️ 9. Photos de plats : décision prise

Aujourd'hui, un plat sans photo reçoit automatiquement une image de banque d'images choisie
d'après son nom. Parfait pour une maquette ; à ne pas garder avec de vrais commerçants :
présenter une photo générique comme le plat d'un commerçant donné est une pratique commerciale
trompeuse, et c'est **le commerçant** qui reçoit la réclamation quand l'assiette ne ressemble
pas à la photo.

**Décision : couper à la mise en ligne**, garder actif pour les démonstrations.

- [ ] Ajouter `VITE_STOCK_DISH_PHOTOS=off` sur Vercel avant le premier vrai commerce
- [ ] Prévoir à la place un accompagnement photo à l'inscription (les commerçants peuvent déjà
      choisir une photo par plat ou par section)

---

## ⚪️ 10. Les tableaux de bord sont en français uniquement

Les traductions existent en français, anglais et néerlandais, mais **seules 12 pages sur 50**
les utilisent. Traduits : tout le parcours public et client. Non traduits : **l'intégralité des
espaces commerçant, livreur et administration**, ainsi que les pages légales.

Un commerçant néerlandophone à Bruxelles reçoit donc un back-office uniquement en français.
C'est une objection commerciale, pas un détail cosmétique.

- [ ] Traduire en priorité le tableau de bord commerçant — c'est l'écran montré en démonstration
- [ ] Traduire les pages légales (CGV, confidentialité, mentions)

---

## ⚪️ 11. Le référencement ne fonctionne pas encore

Les fiches de commerce sont volontairement publiques pour être indexables par Google. Mais le
site est entièrement construit dans le navigateur, sans pré-rendu, et le plan du site ne liste
que l'accueil et les pages légales — **pas les fiches de commerce**, précisément celles qui
apporteraient du trafic.

L'intention est bonne, la plomberie manque.

- [ ] Générer le plan du site depuis le serveur, avec une entrée par commerce
- [ ] Ajouter un pré-rendu des deux pages publiques (liste et fiche)

---

## ⚪️ 12. Aucun test automatisé

Il n'existe aucun test dans le projet. La seule vérification est `npm run lint`.

Ce n'est pas anormal à ce stade, mais chaque modification du parcours de paiement devra
continuer d'être vérifiée à la main — d'où l'importance du §8.

- [ ] À envisager après la mise en ligne, en commençant par le parcours de commande

---

## Résumé : l'ordre à suivre

1. Environnement de test (§8) — sans lui, rien ne peut être vérifié sans risque
2. Un commerce qui remplit les quatre conditions (§1)
3. Une commande complète de bout en bout (§1)
4. Vérifier `APP_URL` et les clés Stripe (§2)
5. Fusionner la branche de corrections (§3)
6. Compléter les mentions légales et la politique de confidentialité (§4)
7. Corriger les trois replis backend (§5)
8. Couper les photos automatiques (§9)
9. Puis : Web Push (§6), traductions (§10), référencement (§11)
