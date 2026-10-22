# Revue de lancement fairide.be — changements à valider

Branche : `revue-lancement` (frontend). Tout ce qui est décrit ici est **déjà écrit sur cette branche** et
visible en local ; rien n'est en ligne tant que la branche n'est pas fusionnée dans `main`.
Les changements non visuels et non juridiques (sécurité, SEO, images, formulaires, 404, cookies) sont, eux,
déjà sur `main` — voir le récapitulatif de session.

## 1. Conditions générales (/cgv, alias 301 depuis /cgu)

Une seule page « Conditions générales d'utilisation et de vente », 16 articles, en trois langues (FR fait foi) :

1. **Qui sommes-nous** — FAIRIDE SRL, BCE/TVA 1042.169.780, RPM Bruxelles, Avenue du Castel 30, 1200 Woluwe-Saint-Lambert, contact@fairide.be.
2. **Objet de la plateforme** — mise en relation ; vente conclue entre le client et le commerce ; livraison par un indépendant.
3. **Les trois services** — livraison (19 communes), à emporter (paiement en ligne ou sur place), réservation de table (acompte possible, annoncé avant confirmation).
4. **Compte utilisateur** — 18 ans ou accord parental, exactitude des informations, suspension en cas de fraude, suppression depuis Mon compte.
5. **Commande et confirmation** — ferme à l'acceptation du commerce et à la validation du paiement ; refus = remboursement intégral ; alcool 18+.
6. **Prix et paiement** — TTC, frais de livraison reversés au livreur, frais de service 10 % du montant de la livraison, Stripe, reçu/facture dans Mon compte.
7. **Annulation et remboursement** — gratuite avant acceptation, remboursement 5 à 10 jours ouvrables, plus d'annulation en ligne une fois la préparation lancée, commande non récupérée due, réservation annulable jusqu'au délai du commerce (acompte conservable), contact@fairide.be pour tout problème.
8. **Droit de rétractation** — exclusion art. VI.53 CDE (denrées périssables, prestations à date fixe).
9. **Solde Fairide** — non convertible, non transférable.
10. **Commission perçue par Fairide** — 10 % HT plafonnés, uniquement commandes payées en ligne et livrées ; réservations et emporter payé sur place non commissionnés.
11. **Avis et contenus** — sincérité, retrait des avis abusifs, note de fiabilité après réservation contestable.
12. **Commerces partenaires et livreurs** — renvoi au contrat RESTO-2026.9 et au contrat de collaboration livreur.
13. **Responsabilité** — pas de garantie de disponibilité continue, produits sous la responsabilité du commerce, droits du consommateur préservés.
14. **Données personnelles** — renvoi vers /confidentialite et /cookies.
15. **Modification des conditions** — version datée, commandes en cours sous l'ancienne version, FR fait foi.
16. **Droit applicable, litiges et médiation** — droit belge, réponse sous 5 jours ouvrables, Service de Médiation pour le Consommateur, tribunaux de Bruxelles sans préjudice des règles impératives.

> Point à valider par un juriste : la formulation de l'article 7 (acompte conservé) et de l'article 10 (mention des taux), ainsi que le délai de remboursement.

## 2. Politique de confidentialité (/confidentialite)

Sections : Responsable du traitement · Données collectées (compte, commandes, paiement Stripe, commerces, livreurs, techniques) · Finalités et bases légales (contrat, obligation légale, intérêt légitime, consentement) · Destinataires et sous-traitants (tableau de 14 prestataires, dont Twilio et Photon ajoutés) · Transferts hors UE (Data Privacy Framework / clauses contractuelles types) · Durées de conservation (compte 3 ans après inactivité, factures 7 ans, contrats 10 ans, pièces livreurs 1 an, support 3 ans, registre RGPD 5 ans, journaux 12 mois, scores 1 an) · Vos droits + réclamation auprès de l'APD (autoriteprotectiondonnees.be) · Cookies et statistiques (Plausible sans cookie documenté) · Sécurité · Formulaire d'exercice des droits (inchangé).

> Point à valider : les durées de conservation sont celles déclarées dans l'admin (module Conformité). Aucune purge automatique n'existe encore côté serveur ; il faudra soit l'ajouter, soit ajuster les durées annoncées.

## 3. Mentions légales (/mentions-legales)

Éditeur (sans l'IBAN, qui était publié en clair), directeur de la publication, hébergeurs avec adresses (Vercel, Railway, Stripe Payments Europe), propriété intellectuelle, responsabilité, réclamations (médiation) et données personnelles (APD).

## 4. Politique des cookies (/cookies)

Date mise à jour ; section « Pas de publicité, pas de traceurs » réécrite pour documenter Plausible (statistiques sans cookie ni identifiant, hébergé dans l'UE) et rappeler que seule la remontée d'erreurs Sentry dépend de la bannière.

## 5. Appels à l'action (accueil)

- Bannière : un seul bouton, « Commander maintenant » en lime, sous forme de lien (explorable, ouvrable dans un nouvel onglet). Les deux boutons « Ajouter mon commerce » et « Devenir livreur » disparaissent de la bannière ; la ligne « Commerce ou livreur ? Rejoindre Fairide » juste dessous, la rangée « Rejoindre » et le pied de page les portent.
- Bas de page : « Créer mon compte » passe en contour (secondaire).
- Pages commerçants et livreurs : `/restaurateurs` et `/livreurs` existent désormais comme adresses courtes et redirigent vers l'inscription du bon type de compte, dont le seul bouton principal est « Créer mon compte ». Si tu veux de vraies pages de présentation dédiées, c'est un chantier à part.

## Pour appliquer

```bash
git checkout main && git merge revue-lancement && git push origin main
```
