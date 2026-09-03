# Fairide — direction 5a « The frame »

Spécification de l'identité visuelle, reprise telle quelle du document de direction
artistique. Tout y est littéral : hex, px, ratios. C'est la source de vérité pour
[src/styles.css](src/styles.css) et pour [BrandMark.jsx](src/components/BrandMark.jsx).

---

## 1. Palette

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Surface de marque | Iris | `#3B2FB5` | Icône, blocs de marque, boutons principaux, bannières |
| Accent / marque | Lime | `#C8F03C` | Le vélo sur l'iris, badges d'économie, états actifs |
| Encre | Noir violacé | `#14121F` | Wordmark, titres, texte sur surfaces claires |
| Surface | Blanc | `#FFFFFF` | Cartes, feuilles |
| Filet | Gris chaud | `#DCD8D0` | Bordures 1px, séparateurs |
| Texte secondaire | Gris moyen chaud | `#6B655D` | Texte courant, descriptions |
| Texte tertiaire | Gris clair chaud | `#8A8377` | Légendes, métadonnées |
| Fond de puce | Noir brun | `#1E1A17` | Petits badges sombres à texte blanc |

Deux couleurs de marque, pas une de plus : **iris** et **lime**. Tout le reste est neutre.
Le lime n'apparaît jamais sur du blanc — il vit sur l'iris. L'iris est le cadre de
l'identité ; le lime est l'unique accent à l'intérieur.

Contraste : lime sur iris = élevé. Lime sur blanc = insuffisant, ne pas utiliser.

---

## 2. Typographie

- Famille : **Space Grotesk**, graisses 400 / 500 / 700.
- Wordmark : `fairide`, minuscules, 700, `letter-spacing: -0.03em`, `line-height: 1`,
  `#14121F` sur clair / `#FFFFFF` sur iris.
- Titres : 700–800, `letter-spacing: -0.02em`, `line-height: 1.05`.
- Texte courant : 400, `line-height: 1.45–1.55`, `text-wrap: pretty`.
- Légendes / métadonnées : 12–13px, `#8A8377`, pile monospace en repli.

---

## 3. Formes

- Icône d'application : carré, `border-radius: 24%` du côté (tuile 132px → rayon 32px).
- Cartes : `border-radius: 20px`, `padding: 26px`, `1px solid #DCD8D0`, fond blanc.
- Petites tuiles / puces : `border-radius: 6px`.
- Traits de la marque : extrémités arrondies (`border-radius: 3px` sur les barres),
  trait de 5px pour une marque de 76px de large — soit **trait = 6,6% de la largeur**.
- Aucune ombre, aucun dégradé. Aplats uniquement.
- Mise en page : flex avec `gap` explicite (échelle 10–24px).

---

## 4. La marque (cadre de vélo)

Géométrie, normalisée sur une boîte 76 × 44 :

| Élément | x | y | l | h | note |
|---|---|---|---|---|---|
| Roue arrière | 0 | 14 | 30 | 30 | cercle, trait 5px |
| Roue avant | 46 | 14 | 30 | 30 | cercle, trait 5px |
| Tube supérieur | 16 | 8 | 44 | 5 | barre arrondie |
| Tube de selle | 13 | 20 | 28 | 5 | barre arrondie, `rotate(42deg)` |

La marque est centrée dans la tuile à ~58% de sa largeur (76 / 132).

### SVG (lime sur iris)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132" width="132" height="132">
  <rect width="132" height="132" rx="32" fill="#3B2FB5"/>
  <g transform="translate(28 44)" fill="none" stroke="#C8F03C" stroke-width="5">
    <circle cx="15" cy="29" r="12.5"/>
    <circle cx="61" cy="29" r="12.5"/>
  </g>
  <g transform="translate(28 44)" fill="#C8F03C">
    <rect x="16" y="8" width="44" height="5" rx="2.5"/>
    <rect x="13" y="20" width="28" height="5" rx="2.5" transform="rotate(42 27 22.5)"/>
  </g>
</svg>
```

Remplacer `#C8F03C` par `#3B2FB5` et retirer le `rect` pour la version sur fond clair.

### Repli 24px

À 24px les tubes du cadre disparaissent — on ne garde que les deux roues et le tube supérieur :

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" rx="6" fill="#3B2FB5"/>
  <g fill="none" stroke="#C8F03C" stroke-width="2">
    <circle cx="7.5" cy="16.5" r="2.5"/>
    <circle cx="16.5" cy="16.5" r="2.5"/>
  </g>
  <rect x="7" y="7" width="10" height="2" rx="1" fill="#C8F03C"/>
</svg>
```

---

## 5. Lockup

Horizontal : marque (traits iris, sans tuile) + 12px de gouttière + wordmark `fairide` à 30px.
Hauteur de la marque ≈ 90% de la hauteur de capitale du wordmark. Zone de respect = un
diamètre de roue.

---

## 6. Tokens CSS

```css
:root {
  --iris:        #3B2FB5;
  --lime:        #C8F03C;
  --ink:         #14121F;
  --surface:     #FFFFFF;
  --hairline:    #DCD8D0;
  --text-2:      #6B655D;
  --text-3:      #8A8377;
  --chip:        #1E1A17;

  --radius-card: 20px;
  --radius-icon: 24%;
  --radius-chip: 6px;

  --font: 'Space Grotesk', system-ui, sans-serif;
}
```

---

## 7. Règles d'application

1. L'iris est la chrome : navigation, bannières, boutons principaux, icône d'application.
2. Le lime est un projecteur, pas une surface — badges, onglets actifs, un accent CTA par
   vue. Jamais une grande surface lime à côté de texte blanc.
3. Les fonds sont blancs ou iris. Pas de troisième couleur de fond.
4. Sur iris, le texte est blanc ou lime ; sur blanc, il est `#14121F` / `#6B655D` / `#8A8377`.
5. Aplats uniquement : pas de dégradé, pas d'ombre portée, pas de glassmorphism.
6. Rayons : 20px pour les cartes, 6px pour les puces, 24% pour les icônes. Sans exception.
7. Space Grotesk partout, approche négative marquée aux grandes tailles.
