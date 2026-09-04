# Provenance des médias du fond d'accueil

Ces deux fichiers sont servis par Fairide et non par un CDN tiers. Ils étaient auparavant appelés
directement chez Pixabay et Pexels : ça fonctionnait, mais la page d'accueil aurait perdu son fond
le jour où l'un des deux aurait bloqué le lien direct — Pexels le fait déjà pour ses vidéos, dont
le téléchargement passe par `pexels.com/download/video/<id>/` et non par un lien vers le fichier.

## `cuisine.mp4`

- **Sujet** : une jeune femme prépare une salade dans un intérieur clair — laitue, tomates cerises,
  grenade, un saladier en verre, une tablette posée sur le plan de travail. Caméra sur pied, lumière
  naturelle, faible profondeur de champ.
- **Source** : Pexels, vidéo 6939328 — https://www.pexels.com/video/6939328/
- **Original** : 4096 × 2160 (4K), 43,92 s, 52 Mo, 24 im/s.
- **Livré** : 1920 × 1012, 42,44 s, 25 im/s, **2,79 Mo**. La définition est réduite parce que le
  voile blanc à 55 % détruit de toute façon tout détail fin : servir la 4K coûterait cinquante fois
  le poids pour une différence invisible à l'écran.
- **Licence** : Pexels License. Usage commercial autorisé, aucune attribution requise. La licence
  interdit de redistribuer le fichier comme s'il s'agissait de notre propre banque d'images —
  l'utiliser comme décor d'une page ne pose pas de question.

### La boucle a été fabriquée

Aucune séquence de banque ne boucle d'elle-même : coupée où elle s'arrête, elle saute au
redémarrage. La queue du plan a donc été fondue par-dessus sa tête, de sorte que la dernière image
du fichier coïncide avec la première.

```
D=43.92  F=1.5  E=$(D-F)=42.42
ffmpeg -i source.mp4 -filter_complex "
  [0:v]scale=1920:-2,setsar=1,fps=25,split=3[a][b][c];
  [a]trim=0:$F,setpts=PTS-STARTPTS[head];
  [b]trim=$E:$D,setpts=PTS-STARTPTS[tail];
  [c]trim=$F:$E,setpts=PTS-STARTPTS[mid];
  [tail][head]xfade=transition=fade:duration=$F:offset=0[mix];
  [mix][mid]concat=n=2:v=1[out]" -map "[out]" -an \
  -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart cuisine.mp4
```

Le principe : la sortie commence par le fondu queue→tête, puis enchaîne le milieu du plan. Sa
première et sa dernière image tombent donc toutes deux sur l'instant `D-F` de la source.

**Mesuré après montage** : l'écart au raccord vaut 1,98 (moyenne des écarts absolus par composante,
sur 96 × 54). Pour comparaison, sur le même fichier, deux images consécutives en écartent 0,86,
trois images 2,50. Le raccord est donc moins visible qu'un dixième de seconde de mouvement
ordinaire.

**Vitesse** : lue à 1×. Le plan est sur pied et ne bouge que par la personne — 7,3 de différence
moyenne par demi-seconde, contre 25 pour la séquence précédente qu'il fallait ralentir à 0,5×.

## `cuisine.jpg`

- **Sujet** : une image extraite de la vidéo elle-même (t = 5 s), donc rigoureusement raccord — il
  n'y a aucun saut entre l'affiche et le premier instant de lecture.
- **Fabrication** : `ffmpeg -ss 5 -i cuisine.mp4 -frames:v 1 -vf scale=1600:-2 -q:v 4 cuisine.jpg`
- **Poids** : 69 Ko.
- **Rôle** : affiche de la vidéo sur grand écran, et SEUL visuel de fond sur téléphone, en mouvement
  réduit et en économiseur de données — la vidéo n'y est jamais téléchargée.

## Si l'on remplace ces fichiers

Garder les mêmes noms suffit : ils sont importés depuis `CuisineBackdrop.jsx`, et Vite recalcule
l'empreinte du nom livré à partir du contenu — les caches se vident d'eux-mêmes. Penser à :

1. mettre à jour ce fichier avec la nouvelle provenance ;
2. **refaire le montage de boucle ci-dessus.** C'est le piège : une séquence posée telle quelle
   saute au redémarrage, et ça ne se voit pas sur une vignette — seulement en comparant sa dernière
   image à sa première. Vérifier ensuite que l'écart au raccord reste inférieur à celui de trois
   images consécutives ;
3. regénérer l'affiche depuis la nouvelle vidéo, pour qu'elle reste raccord ;
4. remesurer le mouvement. Au-delà de ~15 par demi-seconde, un ralenti s'impose (`playbackRate`) ;
5. vérifier que le contraste tient. Il ne dépend pas de l'image : c'est le voile blanc à 55 % de
   `.cuisine-fond-voile` qui impose le plancher, quoi qu'affiche la vidéo. Ne pas y toucher sans
   refaire les mesures décrites dans `styles.css`.

`ffmpeg` n'est pas une dépendance du projet — il a été installé le temps du montage avec
`npm i ffmpeg-static --no-save`, qui n'écrit ni dans `package.json` ni dans `package-lock.json`.
