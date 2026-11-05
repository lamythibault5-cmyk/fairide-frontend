# Mises à jour des applis : une décision par changement

Owen, 2026-11-04 : personne ne règle rien dans l'Admin. **Claude décide, dans la proposition de fusion qui change l'appli**,
si les gens doivent être invités à mettre à jour, et écrit ce qui change. La fusion par Owen vaut accord.

Le trajet : un fichier ici → le build iPhone (à chaque fusion) ou Android (lancé à la main) l'envoie au serveur avec son
numéro de build (`scripts/mises-a-jour.mjs envoyer`) → le serveur lit toutes les 6 heures quelle version est vraiment en
ligne sur l'App Store et Google Play, et applique la décision seulement quand une version qui la contient y est
(`fairide-backend/versionsApplis.js`). Un écran obligatoire sans version à télécharger bloquerait les gens : c'est pour ça
qu'il attend le store.

**Depuis le 2026-11-05, les écrans arrivent aussi sans store** (mise à jour directe, `docs/agents/appli.md`) : une
correction de `src/` atteint au prochain démarrage les applis qui ont le greffon. Ces fichiers ne concernent que les
**versions des stores** : à écrire quand un changement a besoin de la coque native (greffon, permission, `ios/`,
`android/`), ou doit atteindre les applis trop anciennes pour les mises à jour directes. Le serveur ne montre jamais la
notification, la rangée ni l'écran obligatoire à une appli qui a déjà ces écrans par mise à jour directe, sur la même coque
(`fairide-backend/versionsApplis.js`, `couverture`).

## Quand écrire un fichier

Seulement si le changement **arrive dans l'appli** (les écrans sont embarqués dans l'app : tout ce qui est dans `src/`,
`public/`, `android/`, `ios/`). Un changement du seul site, du seul backend ou des docs : pas de fichier.

| Niveau | Quand | Ce que voient les gens |
|---|---|---|
| *(pas de fichier)* | Retouches, petites corrections, la plupart des changements. Les téléphones se mettent à jour seuls (mises à jour automatiques, actives par défaut). | Une rangée discrète « Nouvelle version prête » en tête de Mon compte, rien d'autre. |
| `conseillee` | Quelque chose qu'un client, un commerce ou un livreur remarquera et voudra : une nouveauté, un bug qui le gênait vraiment. | La notification de verre en haut, seulement aux applis qui ont **7 jours de retard** sur la version en ligne ; « Plus tard » : revient après 3 jours, puis une semaine de calme. Plus la rangée et un point sur l'onglet Compte. |
| `obligatoire` | **Rare.** L'ancienne appli casserait : une commande, un paiement, une inscription ou une connexion qui échouerait avec le serveur d'aujourd'hui (route ou champ retiré ou renommé, nouveau champ exigé), ou un texte légal à accepter. Jamais pour une nouveauté. | L'écran plein, sans refus, dès que la version est en ligne. Il attend toujours la fin d'une commande en cours, d'une course ou d'une commande à accepter. |

En cas de doute entre `conseillee` et rien : rien. Entre `obligatoire` et `conseillee` : `conseillee`, sauf si quelque chose
casse vraiment. **Pour `obligatoire`, le dire en clair dans la description de la PR** (une ligne : ce qui casserait), pour
qu'Owen le voie avant de fusionner. Un changement du backend qui casse les anciennes applis fait de même, dans la PR
frontend qui va avec (`fairide-backend/CLAUDE.md`).

## Le fichier

`mises-a-jour/AAAA-MM-JJ-sujet.json` (minuscules, chiffres, tirets ; un fichier par PR, jamais modifié après la fusion) :

```json
{
  "niveau": "conseillee",
  "raison": "Inscription sans code : plus simple pour les nouveaux clients.",
  "lignes": {
    "fr": ["Inscription plus rapide, sans code", "Ton adresse se remplit toute seule"],
    "nl": ["Sneller registreren, zonder code", "Je adres vult zichzelf in"],
    "en": ["Faster sign-up, no code", "Your address fills itself in"]
  }
}
```

- `raison` : une phrase pour l'équipe (jamais montrée aux gens).
- `lignes` : 0 à 3 lignes par langue, 80 caractères au plus, **autant dans chaque langue**. Écrites pour les gens, à la
  manière de Fairride (`docs/agents/voix.md` : tu, phrases courtes, ce que ça change pour eux, jamais de jargon ni
  de « corrections de bugs »). Sans lignes, la notification dit seulement qu'une version est prête.
- Plusieurs changements entre deux versions : la notification montre les lignes les plus récentes d'abord, trois au plus.

`npm run check:mises-a-jour` vérifie ces règles ; la CI aussi. Les fichiers restent : le serveur sait lesquels il a déjà
vus. On peut supprimer ceux de plus de six mois.
