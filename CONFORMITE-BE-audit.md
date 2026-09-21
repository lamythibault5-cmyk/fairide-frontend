# Audit de conformité — Fairide vs. checklist légale belge

Confronte la checklist légale (statut livreurs, Stripe Connect, KYC/KYB, RGPD, dossier audit-ready,
AFSCA, BCE, assurance, contrat, alcool) à **ce qui existe réellement dans le code** — front
(`fairide-frontend`) et back (`fairide-backend`), vérifié fichier par fichier le 21/09/2026.

> **Mise à jour du 21/09/2026.** La branche `conformite/commerces-et-registre` (front + back) traite
> la plupart des points techniques listés ici. Le tableau de synthèse ci-dessous garde l'état
> **d'origine** — il sert de point de comparaison ; la section 6, en fin de document, dit ce qui a été
> fait et ce qui reste.

Ce document n'est pas un avis juridique. Il dit ce que la plateforme fait, ce qu'elle ne fait pas,
et ce qu'il faudrait construire. Le tranchage juridique reste celui de l'avocat.

**Verdict global : la partie « livreurs » est de loin la mieux couverte du projet — sans doute
meilleure que ce que la checklist suppose. Le trou béant est du côté *restaurants*, où six
obligations sur six ne sont que du texte contractuel sans aucun contrôle en base.**

---

## 1. Tableau de synthèse

| # | Exigence | État | Où ça vit |
|---|---|---|---|
| 1 | Statut livreurs — clauses anti-présomption de salariat | ✅ **Fait** | `courierContracts.js` |
| 2 | Avis d'avocat écrit sur le statut | ❌ **Absent** | — |
| 3 | Stripe Connect « separate charges and transfers » | ✅ **Fait** | `routes/payments.js`, `stripeConnect.js` |
| 4 | Trace écrite de la structure de paiement (preuve en cas de contrôle) | ⚠️ **Partiel** — décrit en commentaires de code, nulle part ailleurs | `stripeConnect.js` |
| 5 | KYC livreurs (identité + selfie) | ✅ **Fait** | `identityVerification.js` |
| 6 | KYB restaurants (bénéficiaires effectifs) | ❌ **Cassé** — `entity_type: 'individual'` en dur | `stripeConnect.js:33` |
| 7 | Anti-fraude maison (comptes partagés) | ✅ **Fait** — concordance de noms | `identityVerification.js` |
| 8 | Durcissement Stripe 01/04/2026 | ⚠️ **Non suivi** — pas de webhook de capacité | `stripeConnect.js` (commenté) |
| 9 | AIPD / DPIA (données biométriques) | ❌ **Absent** | — |
| 10 | Durées de conservation définies | ✅ **Fait** | `routes/adminCompliance.js` (`POLITIQUE`) |
| 11 | Durées de conservation **appliquées** | ⚠️ **Partiel** — pièces d'identité non purgées | `retentionPurge.js` |
| 12 | Registre des traitements (art. 30 RGPD) | ❌ **Absent** (≠ registre des demandes, qui existe) | — |
| 13 | Dossier audit-ready (statuts, UBO, avis…) | ⚠️ **Partiel** — module générique, pas de dossier Fairide | `routes/adminDocuments.js` |
| 14 | **Numéro AFSCA du restaurant** | ❌ **Absent** — clause contractuelle seule | `restaurantContract.js:92` |
| 15 | **Food Hygiene Rating** | ❌ **Absent** — zéro occurrence dans le code | — |
| 16 | **BCE restaurant : validation + code NACE Horeca** | ❌ **Absent** — champ texte libre, non validé | `routes/restaurants.js:1387` |
| 17 | **Assurance RC exploitation restaurant** | ❌ **Absent** — pas de document requis | — |
| 18 | Contrat écrit commission + répartition des responsabilités | ✅ **Fait** | `restaurantContract.js` |
| 19 | **Licence débit de boissons + vérification d'âge** | ❌ **Absent** — clause contractuelle seule | `restaurantContract.js:92` |

---

## 2. Ce qui est déjà solide (ne pas y toucher)

### 2.1 Statut des livreurs — le point « critique » est le mieux traité du projet

`courierContracts.js` génère trois contrats distincts (`p2p`, `student_independent`, `independent`),
en PDF, signés électroniquement (nom tapé + case cochée + horodatage + IP + **empreinte SHA-256**),
archivés sur Cloudinary, empreinte en base (`courier_contracts`). On peut prouver qui a signé quoi.

Les clauses anti-requalification demandées par la checklist sont **toutes présentes** :

- **Liberté d'accepter/refuser** : clause « Liberté d'organisation » — *« Fairide n'impose ni horaire,
  ni créneau, ni volume minimal, ni taux d'acceptation, et n'applique aucune sanction liée à un refus
  de course »*. Et ce n'est pas que du texte : `grep` sur un score d'acceptation ou une pénalité de
  refus dans `couriers.js` / `routes/couriers.js` ne remonte **rien**. Le code ne contredit pas le
  contrat, ce qui est exactement ce qu'un inspecteur ONSS regarde.
- **Absence de subordination** : clause explicite, directive UE 2024/2831 citée, *« aucune déclaration
  Dimona n'est faite par Fairide »*.
- **Pas d'exclusivité** : le plafond P2P est calculé « toutes plateformes confondues », donc le fait
  que le livreur travaille ailleurs est assumé dans le contrat lui-même.
- **Cadre P2B** (Règlement UE 2019/1150) : motivation de toute suspension, procédure de réclamation.
- **DAC7** (loi-programme 26/12/2022) et **autofacturation Peppol**.

Et surtout — `couriers.js:391` :

```js
if (!(await drapeau('p2p_enabled'))) throw ... 'Fairide attend son agrément du SPF Finances.'
```

Le statut « économie collaborative » est **derrière un drapeau, fermé par défaut**. La checklist dit
« ne comptez pas sur l'agrément » : le code ne compte déjà pas dessus. Point de désaccord mineur avec
la checklist, à confirmer avec l'avocat : l'agrément P2P n'est pas *inadapté* du fait que les
restaurants sont professionnels — c'est le **prestataire** (le livreur) qui doit être un particulier
hors activité professionnelle, pas le donneur d'ordre. Le vrai risque est ailleurs : le plafond
annuel, le caractère répétitif de l'activité, et le fait qu'un livreur régulier ressemble
économiquement à un indépendant. Les deux autres statuts existent, ce qui protège.

**Ce qui manque quand même** : `sous-traitance autorisée`. La checklist la cite comme critère
anti-salariat, et aucune clause des trois contrats ne dit que le Coursier peut se faire remplacer.
C'est l'un des indices les plus lourds dans la jurisprudence belge.

### 2.2 Stripe Connect — le flux est bien en « separate charges and transfers »

- **Encaissement** : Checkout Session sur le compte plateforme (`routes/payments.js`).
- **Reversement** : `stripe.transfers.create({ destination: connect_account_id, transfer_group: order.id })`
  — un transfert restaurant (`transferRestaurantShare`), un transfert livreur (`courierPay`).
- **Comptes connectés** : API Accounts **v2**, configuration `recipient`, capacité `stripe_transfers`
  seule. Ils ne traitent jamais de carte eux-mêmes.
- **Versements** : hebdomadaires, lundi (`configurerVersementsHebdo`).
- **Remboursements** : `stripe.refunds.create` + `transfers.createReversal` (`routes/orders.js:1414`).

C'est bien le mécanisme recommandé. Deux nuances à porter à l'avocat plutôt qu'à les tenir pour
acquises :

1. Les fonds **transitent par le solde Stripe de Fairide** avant transfert. L'argument « pas de
   licence BNB » ne repose donc pas sur « Fairide ne détient jamais les fonds » au sens littéral,
   mais sur l'exemption d'**agent commercial** (PSD2 art. 3(b)) et sur le fait que Stripe est le PSP
   agréé. C'est défendable, mais c'est ce raisonnement-là qu'il faut faire écrire noir sur blanc.
2. `defaults.responsibilities = { fees_collector: 'application', losses_collector: 'application' }` :
   Fairide assume les pertes et les litiges. Choix assumé et cohérent avec le contrat restaurateur
   (clause rétrofacturations), mais c'est un engagement financier à quantifier.

### 2.3 KYC livreurs et anti-fraude

`identityVerification.js` : trois voies (Stripe Identity / itsme / manuel), et pour Stripe Identity
`require_matching_selfie: true` **et** `require_live_capture: true`. Plus fort que la checklist ne
demande.

L'anti-fraude « comptes partagés » est là et bien pensée : `nomsConcordent()` compare le nom du
document vérifié avec le nom du compte Fairide **et** avec le titulaire du compte Stripe Connect,
avec une normalisation tolérante (accents, ordre des mots, second prénom). C'est précisément le
contrôle qui casse la location de comptes.

Données sensibles chiffrées en AES-256-GCM (`chiffrement.js`) : numéro de registre national, IBAN.
Validation de checksum sur le NRN (modulo 97) et sur la BCE **du livreur** (`bceValide`).

### 2.4 RGPD opérationnel

- Registre des demandes (accès, suppression, rectification, portabilité, opposition), délai d'un mois,
  accusé de réception automatique, formulaire public sur `/confidentialite`.
- Export complet des données d'un compte (art. 15 et 20), avec exclusions documentées dans le fichier
  exporté lui-même (`meta.excluded`).
- Suppression de compte avec anonymisation.
- Politique de rétention explicite en 10 catégories, affichée à l'admin.
- Tableau des sous-traitants sur la page publique (7 entrées : Stripe, Resend, Google, Cloudinary,
  Sentry, Unsplash…).
- Purge automatique des positions GPS des livreurs (`retentionPurge.js`) — le commentaire de tête de
  ce fichier est un modèle : il explique pourquoi une politique affichée mais non appliquée n'est pas
  de la conformité.

### 2.5 Contrat restaurateur

`restaurantContract.js`, version `RESTO-2026.9`, versionné, avec journal des changements affiché,
acceptation obligatoire avant visibilité (`CONDITION_CONTRAT_ACCEPTE` dans la requête de listing).
Il couvre déjà : commission 10 % HTVA, répartition des responsabilités (le Commerce seul responsable
de la qualité et de la sécurité des produits), conformité AFSCA, allergènes, alcool et tabac, caisse
enregistreuse, DAC7, médiation entre professionnels, conditions de fin de contrat.

---

## 3. Les manques, par ordre de gravité

### 3.1 🔴 KYB restaurants : `entity_type: 'individual'` en dur

```js
// stripeConnect.js:33 — appelé par routes/auth.js:1033 (livreur) ET routes/restaurants.js:3007 (restaurant)
identity: { country: 'BE', entity_type: 'individual' },
```

Une seule fonction sert les deux parcours. Un restaurant constitué en SRL/SA se voit donc créer un
compte Stripe de **personne physique**. Conséquences :

- Stripe ne déclenche **jamais** la vérification des bénéficiaires effectifs (UBO) — exactement ce
  que la checklist demande au point 4.
- Le nom du compte Stripe est celui du gérant, pas celui de la société : la concordance avec la BCE
  du restaurant ne peut pas être vérifiée.
- Risque de blocage Stripe au moment du durcissement d'avril 2026, et de versements gelés.

**Correctif** : passer `entity_type` en paramètre (`'company'` pour un restaurant avec BCE société,
`'individual'` pour un indépendant personne physique et pour les livreurs), et transmettre
`identity.business_details` (numéro d'entreprise, raison sociale). C'est une modification courte et
à faire avant l'ouverture des paiements.

### 3.2 🔴 Aucun contrôle réglementaire sur les restaurants

Six exigences de la checklist restaurant (AFSCA, hygiene rating, NACE Horeca, RC exploitation,
licence alcool, vérification d'âge) reposent **uniquement** sur une clause du contrat où le
restaurateur déclare respecter la loi. Rien n'est demandé, rien n'est stocké, rien n'est vérifié.

La table `restaurants` porte `company_number` et `vat_number`, mais :

```js
// routes/restaurants.js:1387 — la seule validation
if (!companyNumber.trim()) return res.status(400).json({ error: "Le numéro d'entreprise est requis." });
```

Champ texte non vide. Pas de checksum — alors que `bceValide()` existe déjà dans `couriers.js` et est
appliqué aux livreurs. Deux poids, deux mesures dans le même code.

**C'est le trou qui expose le plus Fairide** : en cas d'intoxication alimentaire, la défense
« le restaurant s'était engagé par contrat » est faible face à « la plateforme n'a jamais demandé le
numéro AFSCA qu'elle citait pourtant dans son propre contrat ».

### 3.3 🟠 AIPD (analyse d'impact) absente alors qu'elle est obligatoire

Zéro occurrence de `AIPD` / `DPIA` dans les deux dépôts. Or la plateforme réunit **quatre** critères
qui, pris ensemble, rendent l'AIPD obligatoire (lignes directrices CEPD, seuil de 2 critères) :

1. **Données biométriques** — le selfie Stripe Identity avec `require_matching_selfie`, catégorie
   particulière (art. 9 RGPD).
2. **Données de localisation** — `driver_lat` / `driver_lng` à chaque ping de livraison.
3. **Évaluation systématique** — notation des livreurs, avis sur la fiabilité des clients
   (`RESTO-2026.8`), qui est un *scoring de personnes physiques*.
4. **Traitement à grande échelle** + **données de personnes vulnérables** (étudiants-indépendants).

L'absence d'AIPD est en soi une infraction sanctionnable, indépendamment de la qualité technique du
reste — qui est bonne.

### 3.4 🟠 Registre des traitements (art. 30) absent

À ne pas confondre avec le registre des **demandes** (`privacy_requests`), qui lui existe et
fonctionne bien. Le registre de l'art. 30 liste les *traitements* : finalité, base légale, catégories
de personnes, catégories de données, destinataires, transferts hors UE, durée de conservation,
mesures de sécurité.

Bonne nouvelle : **80 % de la matière est déjà écrite dans le code**, dispersée.

- Durées → `POLITIQUE` dans `routes/adminCompliance.js`
- Destinataires → `SOUS_TRAITANTS` dans `src/pages/legal/Privacy.jsx`
- Bases légales → citées dans les contrats (RGPD art. 6.1 b et c)
- Mesures de sécurité → `chiffrement.js`, `octetsMagiques.js`, la branche `securite/documents-prives`

Il s'agit de **rassembler**, pas d'inventer.

### 3.5 🟡 Rétention : la partie la plus sensible n'est pas purgée

`retentionPurge.js` le dit lui-même, en toutes lettres (c'est à son crédit) :

> « 2. Documents justificatifs expirés (pièces d'identité). Même problème Cloudinary, et c'est la
> catégorie la plus sensible : une erreur ici détruit une pièce qu'un livreur devra refournir. »

Donc : les pièces d'identité et les tickets de support restent sur Cloudinary au-delà de la durée
annoncée. La politique affichée promet « supprimés à l'expiration ou 1 an après la fin de la
relation » et ce n'est pas tenu. C'est le reproche que le fichier fait lui-même à l'état antérieur,
appliqué à une autre catégorie.

### 3.6 🟡 Statut Connect suivi par sondage, pas par webhook

`stripeConnect.js`, commentaire de tête :

> « le statut d'un compte v2 n'est pas notifié par un webhook "account.updated" classique mais par un
> système de "thin events" séparé […]. Pour rester simple en Phase 1, le statut est donc rafraîchi
> activement (fetchConnectStatus) […] — appelé au retour de l'onboarding hébergé par Stripe. »

Conséquence : si Stripe **révoque** une capacité après coup (c'est exactement ce qui arrivera au
durcissement du 01/04/2026, sur des comptes déjà onboardés), Fairide ne l'apprend qu'au prochain
passage du partenaire dans son espace. Entre-temps, les `transfers.create` échouent silencieusement —
`transferRestaurantShare` attrape l'erreur et se contente d'un `console.error`, la commande restant
marquée payée. Un restaurant peut donc ne pas être payé sans que personne ne le sache.

### 3.7 🟡 Dossier audit-ready : le contenant existe, le contenu non

`routes/adminDocuments.js` est un bon module documentaire générique (types, dates d'expiration,
statuts de vérification, filtres « expirés »/« expire bientôt »). Mais ses `TARGET_TYPES` sont
`['restaurant', 'driver', 'client', 'order', 'crm_prospect', 'ticket']` — **il n'y a pas de cible
« Fairide »**. Impossible d'y ranger les statuts de la société, l'extrait UBO, le contrat Stripe,
l'AIPD, ou l'avis juridique sur le statut des livreurs.

L'identité légale de Fairide, elle, est bien tenue (`fairideCompanyInfo.js` : SRL, BCE 1042.169.780,
RPM Bruxelles, IBAN, adresse — avec surcharge par variables d'environnement).

---

## 4. Comment tacler — plan par vagues

### Vague 1 — avant l'ouverture des paiements (20 octobre 2026)

Ce sont les points qui, non traités, bloquent ou exposent dès le premier euro encaissé.

| Action | Effort | Où |
|---|---|---|
| `entity_type` paramétrable + `business_details` pour les restaurants sociétés | ~1 j | `stripeConnect.js`, 2 appelants |
| Appliquer `bceValide()` au `company_number` des restaurants (fonction déjà écrite) | ~2 h | `routes/restaurants.js:1387` |
| Champ `afsca_number` + document `afsca_autorisation` requis avant `admin_status = 'approved'` | ~1 j | migration + `routes/restaurants.js` + `AdminRestaurantsPage.jsx` |
| Document `rc_exploitation` requis, avec date d'expiration (le module Documents la gère déjà) | ~0,5 j | `routes/adminDocuments.js` — juste un type de plus |
| Alerte admin (tâche) quand un `transfers.create` échoue, au lieu du `console.error` muet | ~0,5 j | `routes/payments.js` |
| Clause de **sous-traitance / remplacement** dans les trois contrats livreur | ~2 h + avocat | `courierContracts.js` |

### Vague 2 — pendant le mois d'ouverture

| Action | Effort | Où |
|---|---|---|
| Rédiger l'AIPD (biométrie + géoloc + scoring) | avocat/DPO + ~1 j de collecte | nouveau doc |
| Registre des traitements art. 30 — **générer depuis le code existant** | ~1,5 j | nouvelle route `/admin/compliance/registre` |
| Cible `fairide` dans le module Documents = le dossier audit-ready | ~1 j | `routes/adminDocuments.js`, `TARGET_TYPES` |
| Purge Cloudinary des pièces d'identité expirées (supprimer le fichier **avant** la ligne) | ~1,5 j | `retentionPurge.js` + `cloudinary.js` |
| Webhook Stripe v2 thin events `capability_status_updated` | ~1 j | `routes/payments.js` |
| Note écrite sur la structure de paiement (extraite des commentaires de `stripeConnect.js`) | ~0,5 j | dossier audit-ready |

### Vague 3 — dans le trimestre

| Action | Effort | Notes |
|---|---|---|
| Food Hygiene Rating AFSCA | ~2-3 j | Vérifier d'abord si l'AFSCA expose une API ou seulement une recherche web. À défaut : champ « score relevé le … » saisi à la validation du restaurant, avec rappel annuel — le module Documents gère déjà les expirations. **Argument commercial** en plus : « tous nos partenaires sont notés X ou mieux ». |
| Code NACE Horeca | ~1 j | Même question d'API (BCE Public Search / KBO Open Data). Sinon : saisie admin + capture d'écran de la fiche BCE en pièce jointe. |
| Licence débit de boissons + drapeau `contient_alcool` sur les plats | ~2-3 j | Drapeau sur `menu_items` → confirmation d'âge au panier → mention sur le ticket livreur. Le tableau `menuSectionRules.js` connaît déjà les sections « Alcools forts », « Boissons & bières » : la détection initiale peut être pré-remplie automatiquement. |
| Alertes proactives d'expiration de documents | ~1 j | Déjà identifié dans le code comme « phase 6 (Automatisations) » — le moteur `automationEngine.js` existe. |

### Ce que le code ne peut pas faire

Deux points de la checklist ne sont pas des tâches de développement et ne doivent pas être traités
comme telles :

- **L'avis d'avocat écrit sur le statut des livreurs.** C'est le point n° 1 de la checklist et la
  seule chose ici qui ne s'implémente pas. Le travail préparatoire, lui, est fait : les trois
  contrats, leurs clauses, et le fait qu'aucun mécanisme de sanction de refus n'existe dans le code
  sont exactement ce qu'un avocat a besoin de lire. Lui envoyer `courierContracts.js` tel quel fait
  gagner une consultation.
- **L'extrait UBO** (registre des bénéficiaires effectifs de Fairide SRL) : formalité au guichet
  d'entreprises, à ranger ensuite dans le dossier audit-ready une fois la cible `fairide` créée.

---

## 5. Un principe transverse

L'écart le plus révélateur de cet audit n'est pas juridique, il est de cohérence interne :

- **Livreur** : BCE validée par checksum, documents obligatoires par statut, identité vérifiée par
  selfie, concordance de noms, contrat signé et haché.
- **Restaurant** : BCE non vide, contrat coché.

Le contrat restaurateur affirme que le Commerce « dispose des autorisations, assurances et
enregistrements requis ». Le système ne le demande jamais. Combler cet écart — appliquer aux
restaurants la rigueur déjà écrite pour les livreurs — traite d'un coup les points 1, 3, 4 et 5 de la
checklist restaurant, et réutilise massivement du code qui existe déjà.


---

## 6. État après la branche `conformite/commerces-et-registre`

### Fait, et vérifié par les tests (`npm test` : 42/42)

| # | Exigence | Ce qui a été construit |
|---|---|---|
| 6 | KYB restaurants | `entity_type` paramétrable dans `stripeConnect.js` ; un commerce ouvre désormais un compte `company` avec son numéro d'entreprise et sa raison sociale, ce qui déclenche la vérification UBO de Stripe |
| 16 | BCE / TVA restaurants | `identiteEntreprise.js` : clé de contrôle BCE (la fonction n'existait que pour les livreurs), validation TVA et **contrôle de concordance TVA ↔ BCE**. Appliqué à la saisie et avant l'ouverture du compte Stripe |
| 14 | Numéro AFSCA | Champ `afsca_number` (unité d'établissement, distincte du numéro d'entreprise), saisi par le restaurateur, + document `afsca_autorisation` exigé |
| 17 | RC exploitation | Document `rc_exploitation` exigé, avec date d'expiration — une attestation périmée bloque comme une attestation absente |
| 19 | Licence alcool | Déclaration `sells_alcohol` + licence exigée + engagement horodaté de vérification d'âge. **Backfill** : les cartes contenant déjà de l'alcool basculent automatiquement |
| 15 | Food Hygiene Rating | Champ A/B/C/D relevé par l'équipe, avec date, qui périme au bout d'un an ; un score C ou D lève une alerte |
| 16 | Code NACE | Relevé par l'équipe ; un code non alimentaire **bloque** la validation |
| — | Garde-fou à la validation | `PATCH /admin/restaurants/:id/status` refuse en 409 si un manquement bloquant subsiste. Passer outre exige `force` + un motif, journalisés sur la fiche |
| 12 | Registre art. 30 | `registreTraitements.js` : 11 traitements assemblés **depuis le code**, durées importées de la politique de rétention (donc jamais désynchronisées), export Markdown |
| 9 | AIPD | Pas rédigée (ce n'est pas du code), mais son obligation est **calculée** : 3 critères sur un seuil de 2, affichés en rouge avec leur motif |
| 13 | Dossier audit-ready | Cible `fairide` dans le module Documents — elle n'existait pas, d'où l'absence d'endroit où ranger statuts, UBO, AIPD, avis juridique. Checklist de 12 pièces avec état |
| 11 | Rétention appliquée | Purge Cloudinary des documents expirés (délai de grâce d'un an, **interrupteur `PURGE_DOCUMENTS_EXPIRES`, éteint par défaut**) ; le fichier est supprimé avant la ligne, et la ligne n'est supprimée que si Cloudinary confirme |
| — | Virements en échec | Les deux `console.error` muets (`transferRestaurantShare`, `courierPay`) créent une tâche admin prioritaire. Un partenaire pouvait n'être jamais payé sans que personne ne le sache |
| 1 | Clause de sous-traitance | Ajoutée aux trois contrats livreur (`2026.5`) : l'indice anti-requalification le plus lourd, qu'aucun des contrats ne portait |
| — | Documents en privé | Le module Documents montait encore ses fichiers en adresse publique permanente — alors qu'il porte le type `piece_identite`. Passé en accès signé, comme les pièces livreur l'étaient déjà |

Deux corrections au passage : `retentionHint` promettait « aucune purge automatique » alors que trois
catégories sont purgées, et le tableau de rétention omettait la position GPS des livreurs — la seule
donnée réellement effacée en continu, et la plus sensible.

### À vérifier avant la mise en production

1. **`entity_type: 'company'` en mode test Stripe.** Le nom exact des champs de
   `identity.business_details` dépend de la version de l'API Accounts v2. Un refus de Stripe empêche
   un commerce de configurer ses versements — à tester avant le 20 octobre.
2. **Le texte de la clause de sous-traitance**, par l'avocat. Le bump `2026.5` oblige les livreurs déjà
   inscrits à re-signer (ils apparaissent dans Conformité › Contrats, avec une relance en un clic).
3. **`PURGE_DOCUMENTS_EXPIRES`** reste à `false`. Tant qu'il l'est, la purge compte sans supprimer :
   regarder le compteur dans les journaux avant de l'activer.

### Non fait, et pourquoi

- **Webhook Stripe v2 `capability_status_updated`** : demande une configuration côté tableau de bord
  Stripe que je ne peux pas vérifier d'ici. L'alerte sur virement en échec couvre le symptôme le plus
  grave en attendant.
- **Vérification d'âge côté client au panier** : touche le parcours de commande sur plusieurs écrans.
  La base est posée (`sells_alcohol` par commerce) ; il manque un drapeau par plat, ce qui est une
  tâche à part entière.
- **API BCE / AFSCA** : ni l'une ni l'autre n'expose de service utilisable ici. Les deux champs sont
  donc relevés à la main sur les registres publics — et le dire est plus honnête que de fabriquer un
  contrôle automatique qui n'en serait pas un.
