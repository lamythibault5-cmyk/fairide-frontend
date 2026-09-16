# Audit de sécurité Fairide

Audit des 17 catégories de `AI-CHECKLIST.md`, passé sur les deux dépôts — frontend (React/Vite,
Vercel) et backend (Express/Postgres, Railway) — le **16 septembre 2026**.

Méthode : trois inventaires croisés du code, puis **relecture manuelle à la source de chaque faille
avant de l'écrire ici**, puis exploitation réelle contre un serveur local branché sur la base de
test. Rien dans ce document n'est repris d'un rapport sans avoir été vérifié. Ce qui n'a pas pu être
prouvé est dit comme tel.

Correctifs : branche `hotfix/securite-critique` (backend, urgente, partie de `main`) et
`fix/securite` (les deux dépôts).

---

## Résumé

**Trois failles ouvraient la plateforme entière, et elles étaient sur `main`, donc en production.**
La première — un jeton d'administrateur délivré à qui connaît une adresse e-mail — n'était pas une
subtilité : une requête suffisait, et l'adresse est publiée sur le site.

Le reste du tableau est meilleur que la moyenne. Aucun secret n'a jamais été commité, CORS est une
vraie liste blanche, les montants de paiement sont toujours recalculés en base, la signature Stripe
est vérifiée et refuse en production si la clé manque, les rejeux de webhook sont bloqués par mise à
jour conditionnelle, bcrypt est partout, l'appartenance des ressources est vérifiée sur ~110 routes
commerçant sans une seule exception, et **il n'y a aucune injection SQL** — les fragments dynamiques
sont tous des constantes ou des listes blanches.

| # | Catégorie | Avant | Après |
|---|---|---|---|
| 1 | Secrets | 🔴 CRITIQUE | ✅ corrigé (1 point ouvert) |
| 2 | Accès base de données | 🟡 FAIBLE | 🟡 inchangé, documenté |
| 3 | Authentification | 🔴 CRITIQUE | ✅ corrigé |
| 4 | Contrôle d'accès | 🟠 ÉLEVÉ | ✅ corrigé |
| 5 | Secrets côté navigateur | ✅ CONFORME | ✅ conforme |
| 6 | SSRF | 🔴 CRITIQUE | ✅ corrigé |
| 7 | CSRF | ✅ SANS OBJET | ✅ sans objet (1 point ouvert) |
| 8 | En-têtes de sécurité | 🟠 ÉLEVÉ | ✅ corrigé (CSP en observation) |
| 9 | CORS | ✅ CONFORME | ✅ conforme |
| 10 | Limitation de débit | 🟡 PARTIEL | ✅ corrigé |
| 11 | Injection SQL | ✅ CONFORME | ✅ conforme |
| 12 | XSS | 🟠 ÉLEVÉ | ✅ corrigé |
| 13 | Webhooks de paiement | 🟡 MOYEN | ✅ corrigé |
| 14 | Téléversements | 🟠 ÉLEVÉ | 🟠 **2 points ouverts** |
| 15 | Gestion des erreurs | 🟡 MOYEN | ✅ corrigé (21 points mineurs) |
| 16 | Mots de passe | 🟡 MOYEN | ✅ corrigé (2 points ouverts) |
| 17 | Dépendances | 🟠 ÉLEVÉ | ✅ 0 vulnérabilité |

---

## Les trois failles critiques, en détail

### 1. Un jeton d'administrateur contre une adresse e-mail — `routes/auth.js`

```js
if (user.email_verified) {
  const token = jwt.sign({ id: user.id, role: user.role, ... }, JWT_SECRET, { expiresIn: '30d' });
  return res.json({ token, user: publicUser(user) });   // le code n'est JAMAIS comparé
}
```

`POST /api/auth/verify-email` exigeait que `code` soit non vide, puis ne comparait jamais sa valeur
si le compte était déjà confirmé. La comparaison existait bien — trois lignes plus bas, inatteignable
pour ces comptes.

`{"email":"contact@fairide.be","code":"x"}` renvoyait un jeton valable 30 jours sur le compte
fondateur. Tout compte confirmé de la plateforme se prenait de la même façon. Le limiteur (10 par
quart d'heure) ne protégeait rien : une requête suffit.

**Vérifié à l'exécution** : avant, jeton délivré ; après, HTTP 400 sans jeton, et le parcours normal
d'inscription (mauvais code refusé, bon code accepté) fonctionne toujours.

### 2. Commander sans payer — `routes/orders.js`

Les prix sont correctement relus en base, mais `qty` était pris tel quel dans la requête : aucun
contrôle d'entier ni de signe, nulle part. Une ligne à `qty: -50` rendait le total négatif, et
`payments.js` traite un total ≤ 0 comme « entièrement couvert par le solde » — commande marquée
payée, commerçant prévenu, rien encaissé.

**Circonstance atténuante, vérifiée** : les commandes en ligne sont fermées par une garde de date
jusqu'au **10 octobre 2026**, donc cette faille n'était pas exploitable au moment de l'audit. Elle le
serait devenue à l'ouverture.

**Vérifié à l'exécution** : `-50`, `0`, `2.5`, `1000`, `null` et `"abc"` refusés en 400 ; une
commande normale passe (2 × 3 € = 11,04 € avec les frais).

### 3. Devenir administrateur en changeant son adresse — `routes/auth.js`

Les rôles de l'équipe se décident sur l'**adresse** (`ADMIN_EMAILS`, `admin_members`), pas sur une
colonne du compte. Trois portes étaient ouvertes :

- le garde-fou existant ne bloquait qu'un sens (admin → non-admin), jamais l'inverse ;
- le code de confirmation partait à l'**ancienne** adresse, donc à l'attaquant : il prouvait qu'on
  tient le compte, jamais qu'on possède l'adresse demandée ;
- le code n'est pas attaché à la valeur demandée — on pouvait en obtenir un pour une adresse
  anodine, puis confirmer avec une adresse d'administrateur.

Et `requireAdmin` lit `req.user.email` **depuis le jeton**, réémis à la confirmation.

**Vérifié à l'exécution**, avec une vraie ligne `admin_members` créée pour le test : demande refusée
en 403, confirmation refusée en 403 même avec un code valide, adresse du compte inchangée, et le code
d'un changement légitime part bien à la nouvelle adresse (trace serveur à l'appui).

---

## Les 17 catégories

### 1. Secrets — ✅ corrigé

- **CRITIQUE, corrigé** : `JWT_SECRET` retombait en silence sur `'dev-secret-change-me-in-production'`,
  une chaîne publique du dépôt. Si la variable disparaissait d'un redéploiement, rien ne cassait : le
  site signait les jetons avec une valeur lisible par tous. Le serveur **refuse désormais de démarrer
  en production sans elle**. Vérifié : refus immédiat avec message explicite, avant même la base ;
  démarrage normal quand elle est présente.
- **CONFORME** : aucun secret n'a jamais été commité. `CLES-VAPID-A-COLLER.txt` est ignoré et
  n'apparaît dans aucun commit (`git log --all` vide). `.env.example` ne contient que des
  emplacements. Aucun `sk_live_`, `whsec_`, `AKIA` dans le code suivi.
- **Reste ouvert** : `COURIER_DATA_KEY` absente fait dériver la clé de chiffrement des **numéros de
  registre national** des livreurs depuis `JWT_SECRET`. Le chiffrement lui-même est correct
  (AES-256-GCM, IV aléatoire, tag d'authentification vérifié). Voir §17 d'`AVANT-MISE-EN-LIGNE.md` :
  **changer la clé rend les données existantes illisibles**, il faut un script de re-chiffrement.

### 2. Accès base de données — 🟡 documenté, non corrigé

Postgres applicatif, pas Supabase : il n'y a ni RLS ni clé anonyme, l'API est le seul chemin vers les
données et c'est elle qui porte les contrôles (§3 et §4). La question de la checklist ne s'applique
donc pas telle quelle.

Un point réel : `db.js` se connecte avec `ssl: { rejectUnauthorized: false }`, le réglage habituel
sur Railway, dont le certificat n'est pas reconnu par défaut. La liaison est chiffrée mais le
certificat n'est pas vérifié. Sur le réseau interne de Railway le risque est faible ; c'est noté, pas
corrigé, parce que le corriger demande de fournir le certificat de l'hébergeur.

### 3. Authentification — ✅ corrigé

- **CRITIQUE, corrigé** : voir faille n° 1 ci-dessus.
- **ÉLEVÉ, corrigé** : Express route sans distinguer la casse, et le routage strict n'était pas
  activé. `PATCH /api/admin/Settings` atteignait la page Réglages, mais la table des rôles (écrite en
  minuscules) ne correspondait plus — l'adresse passait pour « ouverte à tout membre actif ». Un rôle
  `support` atteignait Équipe & accès et pouvait s'attribuer `owner`. Routage strict activé **et**
  chemin normalisé dans `requireAdmin`, pour que chaque protection tienne seule.
- **CONFORME** : les 15 fichiers `routes/admin*.js` montent tous `requireAuth, requireAdmin` avant
  leur première route. Aucune route de débogage, de test ou de réinitialisation oubliée. Les rôles
  sont relus en base à chaque requête (cache 60 s) plutôt que lus dans le jeton — un rôle retiré
  prend effet tout de suite, ce qui est un bon choix de conception. `role` n'est pas auto-attribuable
  (liste blanche `client`/`restaurant`/`driver`).

### 4. Contrôle d'accès — ✅ corrigé

- **ÉLEVÉ, corrigé** : `GET /api/restaurants/:id` servait n'importe quel commerce **quel que soit son
  statut**, y compris en cours d'inscription — dénomination légale, numéro d'entreprise, TVA, nom du
  responsable, e-mail et téléphone du propriétaire, à qui connaît un identifiant. La liste filtrait,
  la fiche non. Elle applique maintenant la règle de la liste, avec deux exceptions (son propre
  commerce, l'équipe) via une authentification optionnelle. Réponse **404 et non 403** : « interdit »
  confirmerait l'existence du commerce. Vérifié à l'exécution sur les quatre cas.
- **FAIBLE, corrigé** : `DELETE /push/subscribe` supprimait par adresse d'abonnement sans vérifier le
  propriétaire.
- **CONFORME, et c'est le point fort du code** : environ 110 routes commerçant appellent
  `ownRestaurantOr403` en première instruction, et **chaque identifiant imbriqué est en plus borné au
  commerce** (`WHERE id = $1 AND restaurant_id = $2`). Les routes client comparent `client_id`, les
  routes livreur `driver_id`, les factures portent l'appartenance dans le `WHERE` plutôt que dans un
  test après lecture. Aucune exception trouvée.

### 5. Secrets côté navigateur — ✅ conforme

Quatre variables `VITE_*`, toutes légitimement publiques : l'URL de l'API, le DSN Sentry (public par
conception), l'**identifiant** client Google (pas un secret), et un drapeau de fonctionnalité. Aucune
clé en dur, aucun appel direct du navigateur à un service tiers qui demanderait un secret. **Il n'y a
aucune clé Stripe côté navigateur** : les paiements passent par une redirection créée côté serveur.

### 6. SSRF — ✅ corrigé

**CRITIQUE, corrigé.** La garde existait et était correcte (schéma http/https, 127/8, 10/8,
172.16/12, 192.168/16, **169.254/16 — les métadonnées du cloud**, `::1`), mais elle ne servait qu'à
l'adresse saisie :

- `fetch` suivait les redirections sans rien revérifier : un site public répondant « 302 vers
  `http://169.254.169.254/` » était suivi jusqu'au bout ;
- le contenu récupéré est **renvoyé à l'appelant** — ce n'était donc pas un SSRF aveugle mais une
  primitive de lecture du réseau interne ;
- l'adresse d'entrée `GET /restaurants/lookup/enrich?website=` n'exige **aucun compte** ;
- deux appels internes rappelaient le téléchargement sur des liens récupérés dans la page distante,
  sans repasser par la garde du tout.

Correction : la vérification vit maintenant **dans la fonction qui télécharge**, et elle est refaite à
chaque saut de redirection (cinq au plus) — aucun appelant ne peut l'oublier. Le plafond de taille
s'applique pendant la lecture et non après, la réponse entière n'étant plus chargée en mémoire avant
d'être mesurée.

**Vérifié à l'exécution** avec un serveur piège local : redirection vers `169.254.169.254` refusée,
réponse de 9 Mo refusée, page normale lue correctement (témoin positif), adresse interne directe et
schéma `file://` refusés.

**Écart assumé au plan** : `/lookup/enrich` **reste ouverte sans compte**. Elle préremplit la fiche
*pendant* l'inscription, donc avant qu'un compte existe — exiger un jeton aurait cassé l'inscription
des commerçants. Le SSRF lui-même étant fermé, le risque restant était le coût : un appel peut
déclencher trois appels facturés à Claude, et le plafond était de 200 par quart d'heure. Il est
descendu à 20, sur un limiteur dédié.

### 7. CSRF — ✅ sans objet

L'authentification est exclusivement `Authorization: Bearer`. Aucun cookie nulle part (zéro
occurrence de `res.cookie`, `req.cookies`, `sameSite`, pas de `cookie-parser`), donc une requête
inter-site ne porte aucune autorité. La contrepartie assumée est que le jeton vit dans
`localStorage`, ce qui déplace le risque vers le XSS — traité en §12.

**Reste ouvert** : l'agenda iCal est une URL à jeton, sans session (les agendas ne savent pas
s'authentifier). Le jeton fait 192 bits de hasard cryptographique, donc **non devinable**, et la
réponse est identique pour un jeton malformé ou inconnu. Le risque n'est pas la devinette mais la
circulation : l'URL est collée dans Google/Apple Calendar, et quand l'option « détails » est active
le flux expose téléphone et e-mail des clients. À revoir (défaut, rotation, journalisation).

### 8. En-têtes de sécurité — ✅ corrigé, CSP en observation

Il n'y en avait **aucun**, ni sur l'API ni sur les pages : ni HSTS, ni `nosniff`, ni
`X-Frame-Options`, ni politique de référent. `X-Powered-By: Express` était laissé.

- **API** : `helmet` avec HSTS 180 jours, `nosniff`, référent restreint,
  `Cross-Origin-Resource-Policy: cross-origin` (sans quoi le frontend, sur un autre domaine, ne
  pourrait plus lire les réponses). Politique de contenu désactivée : sur une API JSON elle ne protège
  personne. Vérifié en lisant les en-têtes d'une réponse réelle, et CORS vérifié intact après coup.
- **Pages (`vercel.json`)** : HSTS, `nosniff`, `X-Frame-Options`, politique de référent, politique de
  permissions (géolocalisation et caméra limitées à notre origine — le suivi du livreur et la photo
  des documents en dépendent).
- **La CSP est en `Report-Only`, délibérément.** Posée d'un coup, une politique stricte casse
  silencieusement Leaflet, la connexion Google ou Sentry, et un site cassé se découvre en production.
  Les origines autorisées ont toutes été relevées dans le code. **À faire** : ouvrir la console du
  navigateur sur l'accueil, une fiche commerce, la carte, le paiement et la console admin, puis
  retirer `-Report-Only` s'il n'y a rien à signaler.

### 9. CORS — ✅ conforme, déjà

Liste blanche explicite (`fairide.be`, `www.fairide.be`, deux origines locales), surchargeable par
variable. Comparaison par égalité exacte, pas de préfixe ni d'expression régulière. `credentials`
n'est pas activé, ce qui est correct pour une authentification par jeton. `trust proxy` est réglé sur
`1` et non `true`, donc `req.ip` ne peut pas être maquillé — ce qui compte pour le limiteur.

Détail mineur non corrigé : une origine refusée produit un 500 (l'erreur remonte au gestionnaire
global) là où un 403 serait plus juste. Sans conséquence de sécurité, mais cela bruite Sentry.

### 10. Limitation de débit — ✅ corrigé

Un limiteur en mémoire par IP existait déjà sur l'inscription, la connexion, les codes, le mot de
passe oublié, le formulaire de contact et les recherches d'adresse.

- **Corrigé** : les **sept routes qui appellent Claude** (lecture de carte par photo, PDF, page web
  ou texte collé, traduction, lecture de plan de salle, suggestions de photos) n'avaient aucune
  limite. Un seul compte commerçant pouvait vider le budget d'IA.
- **Corrigé** : `POST /auth/balance/redeem` créditait de l'argent réel sans limiter les tentatives.
  Vérifié : la 11ᵉ tentative répond 429 avec `Retry-After`.
- **Corrigé** : le compteur ne faisait jamais de ménage — une entrée par IP vue depuis le démarrage,
  gardée à vie. Fuite de mémoire lente, maintenant balayée toutes les dix minutes.
- **Limite connue, écrite dans le fichier** : le compteur vit dans le processus. Deux conteneurs
  doubleraient chaque plafond, et un redéploiement remet à zéro. C'est un garde-fou contre l'abus
  courant et les frais qui s'envolent, pas contre un attaquant distribué.

### 11. Injection SQL — ✅ conforme

Balayage de tous les appels `.query(` des routes et des modules racine. **Aucune injection.** Les
fragments interpolés sont soit des constantes de module, soit des noms de table issus d'une liste
blanche, soit des colonnes lues dans le catalogue Postgres. Aucun `ORDER BY`, `LIMIT` ou `OFFSET`
dynamique. Les ~60 constructeurs `WHERE ... join(' AND ')` poussent tous des `$n`.

Corrigé au passage, sans rapport avec la sécurité : quatre emplacements auxquels il manquait le `$`,
qui cassaient deux routes (renommer un brouillon de carte, filtrer les avis masqués côté admin) —
elles répondaient 500 systématiquement.

### 12. XSS — ✅ corrigé

**ÉLEVÉ, corrigé.** Leaflet n'est pas React : `bindPopup()` insère la chaîne reçue comme du **HTML
brut**. La carte de navigation du livreur y passait directement le nom du commerce ou l'adresse du
client, deux chaînes saisies par quelqu'un d'autre et jamais échappées côté serveur. Un commerce
nommé `<img src=x onerror=…>` exécutait son script dans le navigateur du livreur — là où vit le jeton
de session, en `localStorage`, valable trente jours. **XSS stocké, inter-locataire, menant à la prise
de contrôle du compte.**

L'échappement était déjà écrit, correctement, dans la carte de la console admin ; les trois autres
cartes ne l'avaient jamais repris. Il devient un module partagé (`src/escapeHtml.js`), utilisé aux
quatre endroits. Vérifié contre des charges réelles, dont l'exfiltration de `localStorage`.

**CONFORME par ailleurs** : zéro `dangerouslySetInnerHTML` dans tout le frontend, pas d'`eval`, pas de
`postMessage`. Les `divIcon({ html })` n'interpolent que des émojis et des valeurs d'énumération. Les
liens `href` alimentés par des données sont assainis côté serveur (protocole forcé en `https`). Et
côté backend, `email.js` échappe **toutes** les interpolations dans les e-mails HTML, les factures
PDF passent par pdfkit qui n'a pas de couche HTML.

### 13. Webhooks de paiement — ✅ corrigé

- **CONFORME** : le corps brut est bien préservé (la route est exclue du parseur JSON global), la
  signature est vérifiée, et une clé de webhook absente **refuse** la requête en production au lieu de
  faire confiance. Les montants ne viennent jamais du client : ils sont recalculés depuis la base, et
  le paiement vérifie l'appartenance de la commande.
- **CONFORME** : les rejeux sont bloqués par mise à jour conditionnelle (`WHERE ... AND paid = false`)
  à chaque écriture d'argent — un événement rejoué ne fait rien.
- **Corrigé** : toute erreur de traitement était avalée et **200 renvoyé quand même**. Stripe
  considérait l'événement comme traité et ne le rejouait jamais : base indisponible au mauvais moment
  = carte débitée, commande impayée pour toujours. Renvoie maintenant 500, ce qui déclenche les
  réessais — sans danger précisément parce que l'idempotence ci-dessus tient.
- **Corrigé** : les **litiges** (`charge.dispute.*`) n'étaient pas traités du tout. Ils sont
  désormais signalés immédiatement, avec la commande concernée. Ce qu'il faut faire ensuite —
  reprendre la part virée au commerce, contre-passer les écritures — est une décision commerciale et
  n'a pas été inventée ici.
- **Corrigé** : les paiements à notification différée (`async_payment_succeeded` / `_failed`)
  n'étaient pas gérés.

### 14. Téléversements — 🟠 deux points ouverts

- **CONFORME** : les six points d'entrée utilisent `memoryStorage`, rien ne touche le disque, les
  fichiers vont directement chez Cloudinary qui attribue l'identifiant — **un utilisateur ne peut pas
  écraser le fichier d'un autre**. Les limites de taille sont appliquées côté serveur partout.
- **OUVERT 🟠** : les **documents d'identité des livreurs** (carte d'identité, permis, titre de
  séjour) sont stockés à des URL Cloudinary **publiques, permanentes et non signées**. La route de
  l'API est protégée, le fichier ne l'est pas : l'URL suffit. Les identifiants sont aléatoires, donc
  non énumérables, mais pour des pièces d'identité c'est une livraison signée qu'il faut. Corriger
  invalide les URL déjà en base → migration à planifier. Voir §17 d'`AVANT-MISE-EN-LIGNE.md`.
- **OUVERT 🟡** : le type de fichier n'est validé que par le `mimetype` **déclaré par le client**.
  L'impact est borné pour les images (Cloudinary ré-encode et impose `resource_type: 'image'`) ; la
  voie `auto` (documents livreur, pièces jointes de support) mériterait une vérification des octets
  magiques.

### 15. Gestion des erreurs — ✅ corrigé

- **CONFORME** : un gestionnaire global existe et renvoie un message générique. Aucune pile d'appels
  n'est envoyée au client (zéro `.stack` dans le code suivi). Sentry est initialisé avant tout le
  reste et branché dans le bon ordre.
- **Corrigé** : le dépôt d'un document livreur renvoyait `e.message` brut — **la seule occurrence sur
  une route non-admin**, où une erreur Postgres livrait le SQL et les noms de colonnes à un
  utilisateur ordinaire.
- **Reste, mineur** : 21 autres emplacements interpolent le message d'exception, tous sur des routes
  réservées à l'équipe. La plupart sont des messages du SDK Stripe, pas de Postgres.
- **Reste, par choix** : la connexion distingue « compte inconnu », « compte supprimé » et « mot de
  passe faux », ce qui permet de tester si une adresse est inscrite. C'est un compromis d'ergonomie
  assumé ; le mot de passe oublié, lui, répond correctement la même chose dans tous les cas.

### 16. Mots de passe — ✅ corrigé, deux points ouverts

- **CONFORME** : bcrypt sur tous les chemins, coût 10, aucune exception. **Aucun MD5 ni SHA-1** dans
  le dépôt. Les jetons de réinitialisation font 256 bits de hasard cryptographique, expirent en une
  heure et sont à usage unique.
- **Corrigé** : cinq générateurs utilisaient `Math.random()`, dont l'état interne se reconstitue à
  partir de quelques tirages observés — et l'attaquant peut s'en faire émettre autant qu'il veut. Le
  plus monnayable était le **code de bon cadeau**, un titre au porteur déductible d'une commande.
  Venaient ensuite les codes de confirmation à six chiffres (qui gardent le changement d'adresse de la
  faille n° 3) et les codes de remise en main propre. Tous passent à `crypto.randomInt`.
- **OUVERT 🟡** : la règle est de **5 caractères** sur une plateforme qui détient des moyens de
  paiement et des pièces d'identité — et elle est incohérente d'un écran à l'autre. Décision du
  propriétaire, déjà §16 d'`AVANT-MISE-EN-LIGNE.md`.
- **OUVERT 🟢** : `reset_token` et `verification_code` sont stockés **en clair**. Les stocker hachés
  rendrait inerte une fuite de sauvegarde. Défense en profondeur, pas une faille exploitable seule.

### 17. Dépendances — ✅ 0 vulnérabilité

`npm audit` est passé de **5 vulnérabilités (1 élevée, 4 moyennes) à 0**.

- `multer` 2.2.0 → 2.4.0 : quatre avis, dont **un contournement de la limite de taille** — or ces
  limites étaient le seul contrôle de volume côté serveur (§14).
- `uuid` retiré : il n'était appelé nulle part et portait le dernier avis restant.
- Le verrou de dépendances est bien commité. Les 17 dépendances directes sont toutes des paquets
  connus et maintenus ; aucun typosquat, aucun script d'installation.

---

## Ce qui reste, et pourquoi

Rien de ce qui suit ne se règle en écrivant du code seul — il faut une clé, un compte, une migration
ou une décision. Le détail est dans le **§17 d'`AVANT-MISE-EN-LIGNE.md`**.

| Priorité | Sujet |
|---|---|
| 🔴 | **Fusionner et déployer `hotfix/securite-critique`** — les failles 1 et 3 sont ouvertes en production |
| 🔴 | **Vérifier `JWT_SECRET` sur Railway** avant de fusionner `fix/securite`, sinon le site ne démarre plus |
| 🟠 | **Changer `JWT_SECRET`** une fois le correctif déployé — seul moyen de révoquer les jetons éventuellement émis. Déconnecte tout le monde |
| 🟠 | **Documents d'identité** : livraison signée chez Cloudinary + migration des URL existantes |
| 🟠 | **`COURIER_DATA_KEY`** : poser une vraie clé, avec un script de re-chiffrement — sinon les numéros de registre national existants deviennent illisibles |
| 🟡 | Passer la CSP de `Report-Only` à bloquant après vérification en console |
| 🟡 | Octets magiques sur les téléversements en `resource_type: 'auto'` |
| 🟡 | Règle de mot de passe (décision) · agenda iCal (défaut « détails », rotation) |
| 🟢 | Hacher les jetons au repos · `CORS_ORIGINS` sans localhost en production · vérifier que Railway construit avec `npm ci` |

## Ce qui n'a pas pu être prouvé

Par honnêteté sur la méthode :

- **Aucune preuve n'a été cherchée que la faille n° 1 a été exploitée.** Les journaux de connexion
  Railway le diraient ; c'est à faire, et s'il y a eu exploitation, la notification RGPD est une
  obligation, pas une option.
- L'environnement de test n'a **pas d'accès internet sortant** : le SSRF a donc été prouvé contre un
  serveur piège local, avec la résolution DNS simulée pour l'adresse d'entrée. Le comportement des
  redirections a bien été exercé ; il ne l'a pas été contre un redirecteur public réel.
- La faille n° 2 a été prouvée maillon par maillon et corrigée, mais l'attaque complète n'a jamais été
  jouée en production — la garde de date la rendait de toute façon inatteignable.
