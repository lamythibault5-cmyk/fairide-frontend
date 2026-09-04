# Provenance des médias du fond d'accueil

Ces fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/` et non par un lien vers le fichier.

## `cuisine.mp4` (3840 × 2160, 51,2 s, 22 Mo)

Une seule définition, servie à tous ceux qui reçoivent la vidéo — donc jamais un téléphone, jamais
en mouvement réduit, jamais en économiseur de données. Une version antérieure livrait du 1080p sous
2560 pixels réels ; ce n'est plus le cas.

### Ce que montre le montage

Huit séquences de 8 s enchaînées par fondus de 1,6 s. L'ordre n'est pas indifférent : les deux plans
sombres de sel et de fumée encadrent le flambé, pour monter vers le pic et en redescendre plutôt que
d'enchaîner deux temps forts.

| Ordre | Pexels | Sujet | Extrait |
|---|---|---|---|
| 1 | [6939328](https://www.pexels.com/video/6939328/) | une salade préparée dans une cuisine claire | 4 → 12 s |
| 2 | [8626269](https://www.pexels.com/video/8626269/) | un chef en veste blanche dresse une assiette | 4 → 12 s |
| 3 | [3195369](https://www.pexels.com/video/3195369/) | du sel tombe dans la fumée, fond sombre | 4 → 12 s |
| 4 | [3195728](https://www.pexels.com/video/3195728/) | saladier retourné à la pince | 0,5 → 8,5 s |
| 5 | [34720127](https://www.pexels.com/video/34720127/) | flambé en cuisine professionnelle | 2 → 10 s |
| 6 | [3298789](https://www.pexels.com/video/3298789/) | du sel sur un bol fumant, fond sombre | 0,6 → 8,6 s |
| 7 | [5902548](https://www.pexels.com/video/5902548/) | macro : une tranche de tomate au couteau | 10 → 18 s |
| 8 | [8626278](https://www.pexels.com/video/8626278/) | un chef assaisonne un poisson | 3 → 11 s |

Toutes en 4K à la source (3840 × 2160 ou 4096 × 2160), recadrées en 3840 × 2160, 25 im/s.

**Licence** : Pexels License pour les huit. Usage commercial autorisé, aucune attribution requise.
La licence interdit de redistribuer les fichiers comme s'il s'agissait de notre propre banque
d'images — les monter en décor d'une page ne pose pas de question.

### Comment le montage a été fait

`ffmpeg` sature si on lui demande de décoder plusieurs flux 4K dans un seul graphe : une première
tentative a rendu une image en trois minutes avant d'échouer. Il faut procéder par étapes, chacune
à une ou deux entrées. Passer `-nostdin`, faute de quoi ffmpeg avale le heredoc de la boucle shell
et le prend pour des commandes interactives.

```
S=8  F=1.6   # durée par plan, durée de fondu

# 1. normaliser chaque plan séparément
N="scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,fps=25,setsar=1"
ffmpeg -nostdin -ss <debut> -t $S -i <source>.mp4 -vf "$N" -an \
  -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p h<i>.mp4

# 2. les enchaîner DEUX À DEUX (offsets 6.4, 12.8, 19.2, 25.6, 32.0, 38.4, 44.8)
ffmpeg -nostdin -i <acc>.mp4 -i h<i>.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=$F:offset=<offset>[o]" -map "[o]" -an \
  -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p <acc+1>.mp4      # -> 52,8 s

# 3. refermer la boucle : découper tête / queue / milieu, fondre la queue sur la tête, concaténer
ffmpeg -nostdin -i w7.mp4 -ss 0    -t 1.6  ... tete.mp4
ffmpeg -nostdin -i w7.mp4 -ss 51.2 -t 1.6  ... queue.mp4
ffmpeg -nostdin -i w7.mp4 -ss 1.6  -t 49.6 ... milieu.mp4
ffmpeg -nostdin -i queue.mp4 -i tete.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=$F:offset=0[o]" -map "[o]" ... raccord.mp4
ffmpeg -nostdin -i raccord.mp4 -i milieu.mp4 -filter_complex "[0:v][1:v]concat=n=2:v=1[o]" \
  -map "[o]" -an -c:v libx264 -preset medium -crf 35 -pix_fmt yuv420p \
  -movflags +faststart cuisine.mp4
```

Le principe de l'étape 3 : la sortie commence par le fondu queue→tête, puis enchaîne le milieu. Sa
première et sa dernière image tombent donc toutes deux sur le même instant du montage.

### Mesures

- **Raccord de boucle** : **3,07** (moyenne des écarts absolus par composante, sur 96 × 54) entre la
  dernière image et la première. Trois images consécutives en écartent **7,02** en moyenne, relevé
  HORS FONDU en huit points du montage — mesurer pendant un fondu gonfle la référence et fausse la
  comparaison. Le raccord est deux fois plus discret qu'un dixième de seconde de mouvement.
- **Rythme** : **12,9** par demi-seconde. Le plan unique était à 7,3, le montage à six plans à 14,1,
  et un plan qu'il avait fallu ralentir de moitié à 25. Deux plans de plus et le rythme baisse : les
  nouveaux — sel qui tombe, bol fumant — sont lents. Lu à 1×, sans ralenti.
- **Coût de la compression** : à CRF 35 contre CRF 31, l'écart vaut 1,57 en brut et **0,71 une fois
  le voile appliqué** — quatre fois moins qu'une seule image de mouvement (3,02), pour une douzaine
  de mégaoctets économisés à chaque visite. C'est ce qui rend la 4K servable à tout le monde.

## `cuisine.jpg` (73 Ko)

- Image extraite du montage lui-même (t = 5 s), donc rigoureusement raccord : aucun saut entre
  l'affiche et le premier instant de lecture.
- `ffmpeg -ss 5 -i cuisine.mp4 -frames:v 1 -vf scale=1600:-2 -q:v 4 cuisine.jpg`
- **Rôle** : affiche de la vidéo sur grand écran, et SEUL visuel de fond sur téléphone, en mouvement
  réduit et en économiseur de données — aucune vidéo n'y est téléchargée.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident d'eux-mêmes. Penser à :

1. mettre à jour ce fichier avec la nouvelle provenance ;
2. **refaire le montage de boucle ci-dessus.** C'est le piège : une séquence posée telle quelle saute
   au redémarrage, et ça ne se voit pas sur une vignette — seulement en comparant sa dernière image
   à sa première. Vérifier ensuite que l'écart au raccord reste inférieur à celui de trois images
   consécutives, relevé hors fondu ;
3. regénérer l'affiche depuis la nouvelle vidéo, pour qu'elle reste raccord ;
4. remesurer le rythme. Au-delà de ~15 par demi-seconde, un ralenti s'impose (`playbackRate`) ;
5. vérifier que le contraste tient. Il ne dépend pas de l'image : c'est le voile blanc à 55 % de
   `.cuisine-fond-voile` qui impose le plancher, quoi qu'affiche la vidéo. Ne pas y toucher sans
   refaire les mesures décrites dans `styles.css`.

Les rushes téléchargés vivent dans `public/_probe/`, ignoré par git : un `git add -A` avait embarqué
520 Mo de sources dans un commit avant que le dossier ne soit exclu.

`ffmpeg` n'est pas une dépendance du projet — il a été installé le temps du montage avec
`npm i ffmpeg-static --no-save`, qui n'écrit ni dans `package.json` ni dans `package-lock.json`.
