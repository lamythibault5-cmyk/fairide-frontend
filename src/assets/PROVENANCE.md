# Provenance des médias du fond d'accueil

Ces deux fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/?w=<largeur>` et non par un lien direct
vers le fichier.

## `cuisine.mp4`

- **Sujet** : une assiette gastronomique dressée — protéine, courgettes, pommes de terre — que le
  chef achève de garnir, puis plan fixe.
- **Source** : Pexels, vidéo 28743417 — https://www.pexels.com/video/28743417/
- **Fichier d'origine** : rendu `?w=960` du point de téléchargement Pexels (960 × 540, 13 s,
  1 755 947 octets), repris tel quel, sans ré-encodage.
- **Licence** : Pexels License. Usage commercial autorisé, aucune attribution requise. La licence
  interdit de redistribuer le fichier tel quel comme s'il s'agissait de notre propre banque
  d'images — l'utiliser comme décor d'une page, ce qui est le cas ici, ne pose pas de question.
- **Attention si on la remplace** : cette séquence s'ouvre et se ferme sur un fondu au noir. Mesurée
  image par image, la différence entre deux images vaut 3 à 5 sur toute la partie utile et bondit à
  138 à 1,2 s et à 12,2 s : ce sont les deux coupes. `CuisineBackdrop.jsx` ne joue donc que
  l'intervalle 1,5 s – 11,9 s. Une autre vidéo aura d'autres bornes, ou aucune : les constantes
  `DEBUT` et `FIN` sont à revérifier avec elle, sinon le fond clignotera au noir à chaque boucle.

## `cuisine.jpg`

- **Sujet** : une assiette dressée — viande en sauce, cubes de pomme de terre, verdure et
  champignons. Palette proche de celle de la vidéo, pour que le passage de l'affiche au film ne se
  remarque pas.
- **Source** : Pexels, photo 28705621 — https://www.pexels.com/photo/28705621/
- **Fichier d'origine** : variante `w=1280` de l'API d'images Pexels (179 973 octets).
- **Licence** : Pexels License, mêmes termes que ci-dessus.
- **Rôle** : affiche de la vidéo sur grand écran, et SEUL visuel de fond sur téléphone, en mouvement
  réduit et en économiseur de données — la vidéo n'y est jamais téléchargée.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident donc d'eux-mêmes. Penser à :

1. mettre à jour ce fichier avec la nouvelle provenance ;
2. revérifier les bornes `DEBUT` / `FIN` (voir ci-dessus) ;
3. vérifier que le contraste tient. Il ne dépend pas de l'image : c'est le voile blanc à 55 % de
   `.cuisine-fond-voile` qui impose le plancher, quoi qu'affiche la vidéo. Ne pas y toucher sans
   refaire les mesures décrites dans `styles.css`.
