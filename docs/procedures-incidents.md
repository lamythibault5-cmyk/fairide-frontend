# Procédures pour les incidents courants

Pour la personne de permanence (voir `permanence-premiere-semaine.md`). Une fiche par cas : quoi regarder, quels
boutons, qui prévenir. Les noms de boutons sont ceux de l'admin au 6 octobre 2026. Premier jet de Claude (plan de
test OPS-8) : à relire et à corriger par l'équipe après les premiers services.

**Règle générale.** Avant tout geste sur l'argent, ouvre la commande dans **Admin › Commandes** et lis son
historique. Un remboursement Stripe est réel et ne s'annule pas.

**Qui paie un remboursement.** Le bouton **Rembourser** demande toujours « à la charge de » :
- **Resto** : le commerce s'est trompé (plat manquant, mauvaise commande, fermé sans prévenir).
- **Livreur** : faute du livreur (commande abîmée ou perdue en route). À utiliser avec prudence : aucune sanction
  automatique n'existe, et il ne faut jamais en créer une : la notice remise aux livreurs le promet.
- **Fairide** : personne n'est en faute, ou on choisit de faire un geste.

---

## 1. Commande non livrée

**Ce que tu vois.** Le client écrit au support, ou une commande reste « en livraison » bien après l'heure prévue.

1. Admin › Commandes › ouvre la commande. Regarde le statut, le livreur et son téléphone (« Livreur : … »).
2. Appelle le livreur.
   - **Il est en route** : donne une heure au client.
   - **Il ne peut pas terminer** (panne, accident) : il a normalement touché « Je ne peux pas terminer » dans son
     appli, et une tâche est déjà ouverte dans Admin › Tâches. Va au cas 2.
   - **Le client était absent** : le livreur a attendu 10 min puis touché « Clore : client absent ». Il est payé, il
     garde la commande. Le remboursement se décide au cas par cas (règle ACT-5). En pratique : client injoignable,
     pas de remboursement ; adresse fausse de notre faute, remboursement à la charge de Fairide.
3. **Aucun livreur n'a pris la commande.** Au bout de 20 min, le client voit un bouton pour annuler, et il est
   remboursé en entier par Fairide. S'il t'écrit avant : Admin › Commandes › **Réassigner à…** un livreur disponible,
   ou attends qu'il annule lui-même.
4. Note ce qui s'est passé dans le motif du remboursement, ou dans une note sur la fiche client.

## 2. Livreur accidenté ou bloqué en pleine course

**D'abord la personne, ensuite la commande.**

1. Appelle le livreur. Blessure → 112. Il n'a rien à faire pour Fairide tant qu'il n'est pas en sécurité.
2. La commande :
   - **Pas encore récupérée au commerce** : le livreur touche « Rendre la course ». Sinon, fais-le pour lui :
     Admin › Commandes › **Réassigner à…** un autre livreur. Rendre une course n'a aucune conséquence pour le livreur.
   - **Déjà récupérée** : préviens le client. Proposer une nouvelle préparation dépend du commerce : appelle-le. Sinon,
     **Rembourser**, à la charge de **Fairide**.
3. Ce qui est dû au livreur se lit dans la commande (« Dû au livreur »). S'il avait récupéré la commande, il a fait
   sa part : ne le pénalise pas.
4. Accident pendant une course : le livreur est indépendant. Rappelle-lui son assurance accidents, et note les faits
   (heure, lieu, témoins) dans une note sur sa fiche livreur.

## 3. Commerce fermé sans prévenir

**Ce que tu vois.** Des commandes restent « en attente » ; le livreur trouve porte close.

1. Appelle le commerce (téléphone sur sa fiche admin).
2. Les commandes en attente :
   - **Pas acceptées** : elles s'annulent toutes seules et le client est remboursé (après un rappel au commerce). Tu
     peux le faire tout de suite : Admin › Commandes › **Annuler la commande**, PUIS **Rembourser** (le bouton
     « Annuler » ne rembourse pas tout seul), à la charge du **Resto**.
   - **Acceptées, livreur sur place** : le livreur touche « J'attends au commerce » (le commerce le voit). Si personne
     n'ouvre : annule, rembourse (à la charge du Resto) et libère le livreur. Il n'est pas payé pour l'attente (règle
     ACT-5).
3. Pour arrêter les nouvelles commandes :
   - **Le commerce répond** : il touche lui-même son interrupteur « Fermé », ou une pause de 15, 30 ou 60 min.
   - **Il ne répond pas** : Admin › Commerces › fiche du commerce › **Fermer jusqu'à demain** (décision DEC-15). Il
     reste visible, affiché fermé, ne prend plus de commande, et rouvre tout seul le lendemain à 6 h ; le commerçant
     peut lever la fermeture lui-même, et le même bouton la lève depuis l'admin. **Retirer du site** ne sert plus
     qu'à un retrait durable (il faut republier ensuite).
   - **Une commande attend et le commerce est là mais ne voit pas l'écran** (téléphone à la caisse, pas de
     notification) : Admin › Commerces › **Fairide s'en occupe** ouvre son tableau de bord dans un onglet (session de
     8 h, journalisée dans ses notes) ; tu peux accepter la commande pour lui après l'avoir eu au téléphone.
4. Le lendemain : appel au commerce. Si ça se répète, la suspension passe par la décision motivée (cas 4, point 3).

## 4. Client agressif, ou abus

1. **Menace contre un livreur ou un commerçant** : le livreur se met en sécurité et ne livre pas. Il touche
   « Je ne peux pas terminer » : l'équipe est alertée et l'appelle.
2. Note les faits sur la fiche client (Admin › Clients › Suivi), avec date, heure et témoins.
3. Suspendre : Admin › Clients › **Suspendre**. Une fenêtre demande les faits et la clause des CGU : c'est obligatoire
   (sinon l'API refuse). L'exposé des motifs part au client par e-mail, en français. Il peut le contester.
4. Le client suspendu peut encore se connecter pour lire la décision, mais il ne peut plus commander (décision DEC-9
   dans le plan de test).
5. Menace grave ou violence : police (101 ou 112). Garde les messages.

## 5. Client débité deux fois

1. Le site empêche la double commande : un même panier envoyé deux fois ne crée qu'une commande. Un vrai double
   débit est donc rare. Vérifie d'abord dans **Stripe › Paiements** (cherche l'e-mail du client).
2. **Deux paiements pour une seule commande** : un paiement qui arrive sur une commande déjà annulée est remboursé
   tout seul, et une tâche « paiement reçu sur une commande close » s'ouvre. Dans les autres cas, vérifie dans Stripe :
   si le second paiement n'est pas remboursé, rembourse-le depuis Stripe (bouton « Rembourser » du paiement).
3. **Deux commandes réelles** (deux onglets, deux paniers) : demande au client laquelle garder. Annule l'autre, puis
   **Rembourser**, à la charge de **Fairide** si le commerce ne l'a pas encore préparée, du **Resto** sinon.
4. **Le montant débité ne correspond pas au total** : une tâche « écart de paiement » s'ouvre automatiquement, avec
   les deux montants. Stripe fait foi.

## 6. Litige bancaire (le client conteste auprès de sa banque)

1. Une tâche « Litige Stripe ouvert » s'ouvre dans Admin › Tâches, avec l'échéance de réponse de Stripe.
2. Réponds dans **Stripe › Litiges** avant l'échéance : ticket de commande, code de remise saisi par le livreur,
   échanges avec le client.
3. Décide ensuite qui supporte la perte. Le commerce et le livreur ont déjà été payés.

## 7. Fairide dépasse le seuil de la franchise TVA

**Ce que tu vois.** Admin › Comptabilité › Obligations : le compteur « Franchise » (seuilFranchise.js) passe à 70 %, puis
90 %. Un e-mail `[Compta]` part à l'équipe à 70 %, 90 % et 100 %, une fois chacun (`alerterSeuil`, passage quotidien). À 100 %, **le régime a pris fin avec l'opération qui a fait dépasser
25 000 €** (pas au 31 décembre). Préparé le 2026-10-15 (plan-franchise-tva-2026-10-15.md, phase 4), jamais encore joué.

**Avant 100 % — dès l'alerte à 90 %, pas après.**
1. Prévenir le comptable : déclaration de changement de régime au bureau de gestion, première déclaration périodique.
2. **Décider ce que devient la commission**, parce que l'interrupteur seul la change. Avec `FAIRIDE_VAT_REGIME=assujetti`,
   `getPricing()` reprend les taux enregistrés (`vatRateCommission` 21 %) et Fairide prend **10 % HTVA + 21 % = 12,1 %** du
   prix payé : le commerce passe de 90 % à 87,9 % de ses ventes, sans l'avoir accepté. Deux choix :
   - **garder 10 % TVA comprise** pour le commerce : poser `commission_rate` à **0,0826** (0,10 / 1,21) dans Admin ›
     Paramètres *en même temps* que l'interrupteur ; rien ne change pour lui, Fairide encaisse un peu moins ;
   - **passer à 10 % HTVA** (12,1 % TVA comprise) : c'est un changement de prix pour le commerce → nouvelle version du
     contrat `RESTO-2026.x` (restaurantContract.js), préavis du contrat, et textes fr/en/nl.
   La hausse maximale du commerce suit toute seule (`hausseMaxPourcent`) : 11,1 % avec le premier choix, 13,7 % avec le
   second.
3. Abonnement (20 €) et mises en avant : décider s'ils deviennent 20 € HTVA (+ TVA) ou 20 € TVA comprise. Textes et CGU.

**Le jour du dépassement.**
1. Si premier choix : Admin › Paramètres › taux de commission à **0,0826** d'abord. Puis Railway › service
   `fairide-backend` › Variables : `FAIRIDE_VAT_REGIME=assujetti` ; le redéploiement suit tout seul. Aucune commande passée
   n'est recalculée : chaque ligne garde la TVA de son jour.
2. Vérifier sur une commande de test (commerce « ZZ Test ») : reçu client avec TVA sur les frais de système, facture de
   commission avec TVA et catégorie Peppol `S`, **sans** la mention de franchise.
3. Admin › Comptabilité › TVA : les grilles de la déclaration périodique réapparaissent ; les dépenses redeviennent
   déductibles à partir de cette date (pas avant).
4. Mettre à jour la section « Pricing model » de CLAUDE.md (les deux dépôts) et `docs/comptabilite.md` (backend).

**Revenir en arrière** n'est pas un geste technique : une fois assujettie, Fairide ne retrouve la franchise que sur
décision de l'administration. Ne jamais remettre `franchise` pour « annuler » une erreur.
