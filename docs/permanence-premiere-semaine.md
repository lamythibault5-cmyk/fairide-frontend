# Permanence — première semaine après le lancement

Plan de test LCH-10. Modèle à remplir par l'équipe (premier jet de Claude) : les cases vides sont des noms, des
numéros et des heures que seule l'équipe connaît. Une fois rempli, à partager avec toutes les personnes de la liste.

## Qui est joignable, et avec quels accès

Pendant chaque service, une personne au moins doit pouvoir **à la fois** décrocher et agir. Sinon elle ne peut que
transmettre.

| Personne | Téléphone | Admin Fairide | Stripe | Railway / Vercel | Double authentification activée |
|---|---|---|---|---|---|
| | | ☐ | ☐ | ☐ | ☐ |
| | | ☐ | ☐ | ☐ | ☐ |
| | | ☐ | ☐ | ☐ | ☐ |

- **Admin Fairide** : Commandes, Rembourser, Réassigner, Suspendre (voir `procedures-incidents.md`).
- **Stripe** : litiges, remboursement direct, vérifier un paiement.
- **Railway / Vercel** : seulement si le site tombe. Sinon, on n'y touche pas pendant un service.

## Tableau des services

Heures de service à confirmer avec les commerces : par exemple de 11 h 30 à 14 h 30 le midi et de 18 h à 22 h 30 le soir.

| Jour | Midi : de garde | Midi : renfort | Soir : de garde | Soir : renfort |
|---|---|---|---|---|
| Lancement (J1) | | | | |
| J2 | | | | |
| J3 | | | | |
| J4 | | | | |
| J5 | | | | |
| J6 | | | | |
| J7 | | | | |

Le jour J1, deux personnes par service, pas une.

## Début de service (5 minutes)

1. Le site s'ouvre : fairide.be, puis la liste des commerces.
2. Admin › Tâches : rien d'urgent en retard ?
3. Admin › Commandes : aucune commande bloquée depuis le service précédent.
4. Les commerces du jour sont ouverts, et leur terminal imprime (appel rapide en cas de doute, surtout la première
   semaine).
5. Au moins un livreur est connecté pour chaque zone servie.

## Pendant le service

- Les alertes arrivent :
  - par e-mail sur contact@fairide.be (commande en attente, problème signalé) ;
  - dans Admin › Tâches (litige, écart de paiement, livreur qui ne peut pas terminer) ;
  - par l'alerte de panne (UptimeRobot, plan de test OPS-6), quand elle sera en place.
- Pour chaque incident : la fiche correspondante dans `procedures-incidents.md`.
- On ne déploie rien pendant un service.

## Fin de service (5 minutes)

1. Admin › Commandes : plus rien « en cours » d'anormal.
2. Écrire dans le canal de l'équipe ce qui s'est passé : incidents, remboursements faits et à la charge de qui, ce qui
   reste à faire.
3. Transmettre à la personne du service suivant.

## Si le site tombe

1. Vérifier sur un autre appareil et un autre réseau (4G).
2. Railway › fairide-backend › Deployments : un déploiement en échec ? Revenir au précédent (« Redeploy » sur le
   dernier vert).
3. Prévenir les commerces par téléphone : les commandes ne passent plus pour le moment.
4. Écrire ce qui s'est passé, avec les heures : c'est utile pour la suite (plan de test OPS-6 et OPS-12).
