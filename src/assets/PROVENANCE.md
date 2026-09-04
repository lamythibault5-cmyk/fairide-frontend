# Provenance des médias du fond d'accueil

Ces deux fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/?w=<largeur>` et non par un lien direct
vers le fichier.

## `cuisine.mp4`

- **Sujet** : une assiette complète posée sur une table dressée — viande grillée, riz, salade et
  tomates, avec les légumes frais et les couverts autour. Un repas équilibré préparé à la maison,
  pas une assiette de restaurant : la viande n'y est qu'un élément parmi d'autres.
- **Source** : Pexels, vidéo 34521341 — https://www.pexels.com/video/34521341/
- **Fichier d'origine** : rendu `?w=960` du point de téléchargement Pexels (8,5 s, 1 600 169 octets),
  repris tel quel, sans ré-encodage.
- **Licence** : Pexels License. Usage commercial autorisé, aucune attribution requise. La licence
  interdit de redistribuer le fichier tel quel comme s'il s'agissait de notre propre banque
  d'images — l'utiliser comme décor d'une page, ce qui est le cas ici, ne pose pas de question.
- **Boucle** : native, sans rognage. Mesurée image par image, la séquence ne contient aucune coupe
  (aucun écart au-dessus de 40, quand un fondu au noir en produit 138), et l'écart entre sa dernière
  et sa première image vaut 45 contre 28 entre deux images voisines : le raccord passe pour un
  mouvement de plus.
- **Vitesse** : le plan est un mouvement d'appareil continu, mesuré à 25 de différence moyenne par
  demi-seconde de film. `CuisineBackdrop.jsx` le joue donc à 0,5×, ce qui le ramène sous le rythme
  de la version précédente.

## `cuisine.jpg`

- **Sujet** : riz, brocolis et poulet épicé sur une assiette sombre. Même composition que la
  vidéo — assiette foncée, riz, légume vert, viande dorée — pour que le passage de l'affiche au
  film ne se remarque pas.
- **Source** : Pexels, photo 36275016 — https://www.pexels.com/photo/36275016/
- **Fichier d'origine** : variante `w=1280` de l'API d'images Pexels (287 027 octets).
- **Licence** : Pexels License, mêmes termes que ci-dessus.
- **Rôle** : affiche de la vidéo sur grand écran, et SEUL visuel de fond sur téléphone, en mouvement
  réduit et en économiseur de données — la vidéo n'y est jamais téléchargée.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident donc d'eux-mêmes. Penser à :

1. mettre à jour ce fichier avec la nouvelle provenance ;
2. **vérifier les coupes et le raccord de boucle.** C'est le piège : une séquence qui s'ouvre ou se
   ferme sur un fondu au noir fera clignoter le fond à chaque tour, et un plan très mobile fera
   sauter le raccord. Ça ne se voit pas sur une vignette, seulement en mesurant l'écart entre images
   successives. Si la séquence a des fondus, il faut rogner à la lecture (une version précédente le
   faisait, avec deux constantes `DEBUT` / `FIN` et un rebouclage manuel) ;
3. régler `VITESSE` en conséquence — un plan fixe supporte 0,75× ; un mouvement d'appareil continu
   demande 0,5× ;
4. vérifier que le contraste tient. Il ne dépend pas de l'image : c'est le voile blanc à 55 % de
   `.cuisine-fond-voile` qui impose le plancher, quoi qu'affiche la vidéo. Ne pas y toucher sans
   refaire les mesures décrites dans `styles.css`.
