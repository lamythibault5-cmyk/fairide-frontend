# Provenance des médias du fond d'accueil

Ces deux fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos.

## `cuisine.mp4`

- **Sujet** : un chef prépare un plat sur son plan de travail.
- **Source** : Pixabay, vidéo 4352 — https://pixabay.com/videos/id-4352/
- **Fichier d'origine** : `4352-178434910_small.mp4` (960 × 540, 10,8 s, 2 028 249 octets), repris
  tel quel, sans ré-encodage.
- **Licence** : Pixabay Content License. Usage commercial autorisé, aucune attribution requise.
  La licence interdit de redistribuer le fichier tel quel comme s'il s'agissait de notre propre
  banque d'images — l'utiliser comme décor d'une page, ce qui est le cas ici, ne pose pas de
  question.

## `cuisine.jpg`

- **Sujet** : un chef dresse plusieurs assiettes en cuisine.
- **Source** : Pexels, photo 3933217 — https://www.pexels.com/photo/3933217/
- **Fichier d'origine** : variante `w=1280` de l'API d'images Pexels (141 451 octets).
- **Licence** : Pexels License. Usage commercial autorisé, aucune attribution requise, mêmes
  réserves que ci-dessus sur la redistribution du fichier lui-même.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident donc d'eux-mêmes. Penser à
mettre à jour ce fichier avec la nouvelle provenance, et à vérifier que la photo reste lisible sous
le voile (voir les mesures de contraste décrites dans `CuisineBackdrop.jsx` et `styles.css`).
