# Provenance des médias du fond d'accueil

Ces fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/` et non par un lien vers le fichier.

## `cuisine.mp4` (3840 × 2160, 72 s, 37 Mo)

Une seule définition, servie à tous ceux qui reçoivent la vidéo — donc jamais un téléphone, jamais
en mouvement réduit, jamais en économiseur de données. Une version antérieure livrait du 1080p sous
2560 pixels réels ; ce n'est plus le cas. Le même fond sert à la page d'accueil et à la page de
connexion / inscription, pour un visiteur non connecté seulement (voir Layout.jsx, `fondCuisine`).

### Ce que montre le montage

Douze séquences de 8 s enchaînées par fondus de 2,0 s (septembre 2026 : quatre plans de plus qu'avant,
le premier remplacé, et des fondus plus longs — 1,6 s auparavant — pour des transitions plus douces).
L'ordre alterne cuisine claire et plans sombres, et espace les temps forts (flambé, poêle fumante) au
lieu de les enchaîner.

| Ordre | Pexels | Sujet | Extrait | Source |
|---|---|---|---|---|
| 1 | [4253330](https://www.pexels.com/video/4253330/) | un cuisinier au fourneau, poêle en main | 4 → 12 s | 4096 × 2160 |
| 2 | [8626269](https://www.pexels.com/video/8626269/) | un chef en veste blanche dresse une assiette | 4 → 12 s | 4K |
| 3 | [3195369](https://www.pexels.com/video/3195369/) | du sel tombe dans la fumée, fond sombre | 4 → 12 s | 4K |
| 4 | [20315773](https://www.pexels.com/video/20315773/) | on mélange un bol de légumes frais | 5 → 13 s | 3840 × 2160 |
| 5 | [3195728](https://www.pexels.com/video/3195728/) | saladier retourné à la pince | 0,5 → 8,5 s | 4K |
| 6 | [34720127](https://www.pexels.com/video/34720127/) | flambé en cuisine professionnelle | 2 → 10 s | 4K |
| 7 | [3298789](https://www.pexels.com/video/3298789/) | du sel sur un bol fumant, fond sombre | 0,6 → 8,6 s | 4K |
| 8 | [8627116](https://www.pexels.com/video/8627116/) | on garnit une pizza | 1 → 9 s | 3840 × 2160 |
| 9 | [5902548](https://www.pexels.com/video/5902548/) | macro : une tranche de tomate au couteau | 10 → 18 s | 4K |
| 10 | [8627105](https://www.pexels.com/video/8627105/) | un chef prépare un plat, cuisine sombre | 4 → 12 s | 3840 × 2160 |
| 11 | [8626681](https://www.pexels.com/video/8626681/) | une poêle fumante | 6 → 14 s | 2560 × 1440, agrandie |
| 12 | [8626278](https://www.pexels.com/video/8626278/) | un chef assaisonne un poisson | 3 → 11 s | 4K |

Recadrées en 3840 × 2160, 25 im/s. Le plan 11 est le seul dont Pexels ne fournit pas de 4K ; agrandi
d'une fois et demie, sous le voile, l'écart ne se voit pas. Le plan retiré était [6939328](https://www.pexels.com/video/6939328/),
une salade préparée dans une cuisine claire — plan calme dont on faisait vite le tour.

**Licence** : Pexels License pour les douze. Usage commercial autorisé, aucune attribution requise.
La licence interdit de redistribuer les fichiers comme s'il s'agissait de notre propre banque
d'images — les monter en décor d'une page ne pose pas de question.

### Comment le montage a été fait

`ffmpeg` sature si on lui demande de décoder plusieurs flux 4K dans un seul graphe : une première
tentative a rendu une image en trois minutes avant d'échouer. Il faut procéder par étapes, chacune
à une ou deux entrées. Passer `-nostdin`, faute de quoi ffmpeg avale le heredoc de la boucle shell
et le prend pour des commandes interactives. Le script complet est `public/_probe/montage12.sh`
(dossier non versionné, à recréer au besoin) ; en résumé :

```
S=8  F=2.0   # durée par plan, durée de fondu

# 1. normaliser chaque plan séparément
N="scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160,fps=25,setsar=1"
ffmpeg -nostdin -ss <debut> -t $S -i <source>.mp4 -vf "$N" -an \
  -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p h<i>.mp4

# 2. les enchaîner DEUX À DEUX, le plan i à l'offset i*(S-F) = 6, 12, … 66
ffmpeg -nostdin -i <acc>.mp4 -i h<i>.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=$F:offset=<offset>[o]" -map "[o]" -an \
  -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p <acc+1>.mp4      # -> 74 s

# 3. refermer la boucle : tête 0-2 s, queue 72-74 s, milieu 2-72 s ; fondre la queue sur la tête
ffmpeg -nostdin -i queue.mp4 -i tete.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=fade:duration=$F:offset=0[o]" -map "[o]" ... raccord.mp4
ffmpeg -nostdin -i raccord.mp4 -i milieu.mp4 -filter_complex "[0:v][1:v]concat=n=2:v=1[o]" \
  -map "[o]" -an -c:v libx264 -preset medium -crf 35 -pix_fmt yuv420p \
  -movflags +faststart cuisine.mp4                                          # -> 72 s
```

Le principe de l'étape 3 : la sortie commence par le fondu queue→tête, puis enchaîne le milieu. Sa
première et sa dernière image tombent donc toutes deux sur le même instant du montage.

### Mesures

- **Raccord de boucle** : **0,95** (moyenne des écarts absolus, en gris, sur 96 × 54) entre la
  dernière image et la première. Des images consécutives en écartent **2,90** en moyenne, relevé HORS
  FONDU au milieu de chaque plan. Le raccord vaut le tiers d'un vingt-cinquième de seconde de mouvement
  ordinaire — la version à huit plans était à 3,07 pour 7,02.
- **Rythme** : **18,8** par demi-seconde, contre 12,9 pour le montage à huit plans : les plans ajoutés
  — fourneau, bol mélangé, pizza garnie, poêle fumante — bougent plus que les plans de sel qu'ils
  entourent. Lu à 1×, sans ralenti.
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
