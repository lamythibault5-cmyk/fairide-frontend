# Provenance des médias du fond d'accueil

Ces fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/` et non par un lien vers le fichier.

## `cuisine.mp4` (1920 × 1080, 6,5 Mo) et `cuisine-4k.mp4` (3840 × 2160, 28,3 Mo)

Le même montage, dans deux définitions. `CuisineBackdrop.jsx` ne sert la 4K qu'au-delà de **2560
pixels réels** (`innerWidth × devicePixelRatio`) : un écran de 1920 points à dpr 1 n'affiche que
1920 pixels, et la 4K n'y ajoute rien pour quatre fois le poids.

### Ce que montre le montage

Cinq séquences enchaînées par fondus de 1,2 s, 44 s au total :

| Ordre | Pexels | Sujet | Extrait |
|---|---|---|---|
| 1 | [6939328](https://www.pexels.com/video/6939328/) | une jeune femme prépare une salade, cuisine claire | 4 → 14 s |
| 2 | [4252294](https://www.pexels.com/video/4252294/) | mains d'un cuisinier émincent des tomates sur une planche | 20 → 30 s |
| 3 | [3195728](https://www.pexels.com/video/3195728/) | saladier retourné à la pince pour répartir l'assaisonnement | 0,5 → 10,5 s |
| 4 | [5902548](https://www.pexels.com/video/5902548/) | macro : une tranche de tomate au couteau | 10 → 20 s |
| 5 | [4912636](https://www.pexels.com/video/4912636/) | filet d'huile d'olive dans une poêle | 3 → 13 s |

Toutes en 4K à la source (3840 × 2160 ou 4096 × 2160), recadrées en 3840 × 2160, 25 im/s.

**Licence** : Pexels License pour les cinq. Usage commercial autorisé, aucune attribution requise.
La licence interdit de redistribuer les fichiers comme s'il s'agissait de notre propre banque
d'images — les monter en décor d'une page ne pose pas de question.

### Comment le montage a été fait

`ffmpeg` sature si on lui demande de décoder cinq flux 4K dans un seul graphe : la première
tentative a rendu une image en trois minutes avant d'échouer. Il faut procéder par étapes, chacune à
une ou deux entrées.

```
# 1. normaliser chaque plan séparément (10 s chacun, 4K, 25 im/s)
N="scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,fps=25,setsar=1"
ffmpeg -ss <debut> -t 10 -i <source>.mp4 -vf "$N" -an -c:v libx264 -preset ultrafast -crf 18 s<i>.mp4

# 2. les enchaîner DEUX À DEUX (offsets 8.8, 17.6, 26.4, 35.2 ; fondu 1,2 s)
ffmpeg -i <acc>.mp4 -i s<i>.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=1.2:offset=<offset>[o]" -map "[o]" -an \
  -c:v libx264 -preset ultrafast -crf 18 <acc+1>.mp4     # -> 45,2 s

# 3. refermer la boucle : découper tête / queue / milieu, fondre queue sur tête, concaténer
ffmpeg -i m4.mp4 -ss 0    -t 1.2  ... tete.mp4
ffmpeg -i m4.mp4 -ss 44   -t 1.2  ... queue.mp4
ffmpeg -i m4.mp4 -ss 1.2  -t 42.8 ... milieu.mp4
ffmpeg -i queue.mp4 -i tete.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=1.2:offset=0[o]" -map "[o]" ... raccord.mp4
ffmpeg -i raccord.mp4 -i milieu.mp4 -filter_complex "[0:v][1:v]concat=n=2:v=1[o]" -map "[o]" -an \
  -c:v libx264 -preset medium -crf 31 -pix_fmt yuv420p -movflags +faststart cuisine-4k.mp4

# 4. la version 1080p se dérive du master, pour que les deux soient rigoureusement identiques
ffmpeg -i cuisine-4k.mp4 -vf scale=1920:-2 -an -c:v libx264 -preset medium -crf 30 \
  -pix_fmt yuv420p -movflags +faststart cuisine.mp4
```

Le principe de l'étape 3 : la sortie commence par le fondu queue→tête, puis enchaîne le milieu. Sa
première et sa dernière image tombent donc toutes deux sur le même instant du montage.

### Mesures

- **Raccord de boucle** : écart de **6,03** (moyenne des écarts absolus par composante, sur 96 × 54)
  entre la dernière image et la première. Sur le même fichier, deux images consécutives en écartent
  3,02 et trois images 7,00 : le raccord saute donc moins qu'un dixième de seconde de mouvement.
- **Rythme** : **14,6** de différence moyenne par demi-seconde. Le plan unique précédent était à 7,3,
  et un plan qu'il avait fallu ralentir de moitié à 25. Lu à 1×, sans ralenti.

## `cuisine.jpg` (73 Ko)

- Image extraite du montage lui-même (t = 5 s), donc rigoureusement raccord : aucun saut entre
  l'affiche et le premier instant de lecture.
- `ffmpeg -ss 5 -i cuisine-4k.mp4 -frames:v 1 -vf scale=1600:-2 -q:v 4 cuisine.jpg`
- **Rôle** : affiche de la vidéo sur grand écran, et SEUL visuel de fond sur téléphone, en mouvement
  réduit et en économiseur de données — aucune vidéo n'y est téléchargée.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident d'eux-mêmes. Penser à :

1. mettre à jour ce fichier avec la nouvelle provenance ;
2. **refaire le montage de boucle ci-dessus.** C'est le piège : une séquence posée telle quelle saute
   au redémarrage, et ça ne se voit pas sur une vignette — seulement en comparant sa dernière image
   à sa première. Vérifier ensuite que l'écart au raccord reste inférieur à celui de trois images
   consécutives ;
3. produire les deux définitions, la 1080p dérivée du master 4K ;
4. regénérer l'affiche depuis la nouvelle vidéo, pour qu'elle reste raccord ;
5. remesurer le rythme. Au-delà de ~15 par demi-seconde, un ralenti s'impose (`playbackRate`) ;
6. vérifier que le contraste tient. Il ne dépend pas de l'image : c'est le voile blanc à 55 % de
   `.cuisine-fond-voile` qui impose le plancher, quoi qu'affiche la vidéo. Ne pas y toucher sans
   refaire les mesures décrites dans `styles.css`.

`ffmpeg` n'est pas une dépendance du projet — il a été installé le temps du montage avec
`npm i ffmpeg-static --no-save`, qui n'écrit ni dans `package.json` ni dans `package-lock.json`.
