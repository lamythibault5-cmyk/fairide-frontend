# Design and styling

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching CSS, a screen's look, fonts, icons, buttons or form fields.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Styling

**[src/styles.css](../../src/styles.css) is the base** (5,521 lines on 2026-10-22), imported once in `main.jsx`; 31 more
`src/*.css` files hold one screen family each (`ecran-*.css` for the app, `site-*.css` for the website, `admin-cadre.css`…),
imported by their own pages — they are described below. Look in the family file before styles.css.
Global class names, no CSS modules, no Tailwind. Inline `style={{}}` is used freely for
one-off spacing and is an accepted pattern here.

**The website shell (2026-10-16, sections 1–2 of `maquettes/site-ordinateur/site-ordinateur.html`, white sidebar and
solid-white sticky bars chosen by the founder) lives in [src/site-cadre.css](../../src/site-cadre.css)**, imported by Layout.jsx; its header
lists the shared utilities — use them instead of re-writing a width or a band per page: `.site-col` (centred, 1,120 px max:
lists, grids, tables) and `.site-col--lecture` (760 px: forms, text); `.site-bande` (iris band, edge to edge of the content
area — it cancels `.dashboard-main`'s padding, notch included on phones) with `.site-bande-ctx` / `-titre` / `-sous`, then
`.site-feuille` (white sheet with rounded top corners rising over it; put a `.site-col` inside both); `.site-collant` (sticky bar:
solid white + hairline, never glass); `.site-survol` (clickable card: border turns iris, lifts 3 px, no shadow) and
`.site-ligne-survol` (row: grey tint); `.sur-iris` (focus ring turns lime — the default ring is 2 px iris offset 2 px, invisible
on iris). On the website, **every signed-in page is in the sidebar shell** except `/login` and `/reset-password` (Layout.jsx,
`HORS_COQUILLE`): help, legal pages, notre-histoire, « C'est bon », 404 no longer show the iris site header; pages outside the
role spaces get `.site-page-generique` (760 px, centred). Sidebar ≥ 900 px, website only (`html:not(.appli)` — the app's sidebar
and glass tab bar are untouched): brand tile, nav whose active tab is an iris pill sliding between links (the same `.nav-curseur`
/ useCurseurOnglets.js as the bottom bar), pale-iris counters (white on the active pill), and at the bottom FR · NL · EN, the legal
links (the `.dashboard-footer-links` row is now phone-only) and the user block. The cookie card is iris with « Accepter » and
« Refuser » as the same white button (APD: refusing as easy as accepting); it takes focus itself so no ring favours one choice.
The website `/login` (Auth.jsx, `CadreConnexion`) is two halves under the unchanged visitor header: iris left (title, the bike
waiting on its road, or during sign-up the step road `RouteEtapes`), the form on a white sheet right, Connexion / Inscription as
a sliding iris segment, one lime action; on phones the iris band on top and the sheet rising under it. Strings: `siteCadre` i18n
namespace.
**The rest of the website (same day, sections 3–9 of that mockup)**: each family has its own website CSS file, imported by its
pages and scoped to `html:not(.appli)`: `src/site-liste.css` (list with a left filter column ≥ 1,100 px, search, map with a side
list, favourites), `site-fiche.css` (restaurant page: menu in two columns, a section whose dishes all have a photo as a grid of tiles since 2026-10-25, sticky cart column `PanierColonne.jsx`, dish as a
centred dialog ≥ 900 px, bottom sheet below), `site-commande.css` (cart / checkout in two columns, past orders as a table; its Mes commandes rules serve the app too since 2026-10-24),
`site-compte.css` (Mon compte in two columns ≥ 1,100 px: `RubriquesCompte.jsx`), `site-pro.css` (business: orders board with three
columns, Mon commerce overview, `CadreSite.jsx`), `site-livreur.css` (courier: jobs list + `CarteCourse.jsx` map and detail,
`PageLivreur.jsx` for secondary pages). **On a laptop every iris band runs edge to edge of the content area** — one rule at the
end of site-cadre.css for the business, courier and account bands (cancel `.dashboard-main`'s 24 / 28 px, centre the content with
padding); change `.dashboard-main`'s padding and those rules change with it. **Scroll locks go on `<html>`, never `<body>`**
(useDialogue, EcranPlein, CarteSuivi): html has `overflow-x: clip`, so a body in `overflow: hidden` became its own scroller, jumped
to the top and dragged the sticky sidebar with it. The signed-out home page (`/`) and its visitor header are deliberately untouched.
**Group orders and the business team in the same family (2026-10-16, [src/ecran-equipe-groupe.css](../../src/ecran-equipe-groupe.css), `eg-`
classes, app and website rules in one file).** `/groupe/:code` (CommandeGroupee.jsx) reuses the cart's `BandeauCommande` /
`FeuilleCommande` / `BarreCommande` (`ec-page sc-page`): iris band (back to the menu, restaurant, « Commande groupée », who pays ·
participants, bike on its road), then Inviter (link field + iris share pill), Ma part, Toutes les parts grouped by person
(initial, name, person total; hairline rows `qty× · dish · price · ×`), total estimé. Exactly one lime action, in the bottom bar
(glass in the app, iris bar on the phone website, sticky recap column on a laptop): host « Fermer le groupe et commander », else
« Envoyer mon panier au groupe », else « Choisir mes plats »; reopen / cancel stay quiet at the bottom. `/groupe` is in Layout's
`DASHBOARD_PATHS` and `FLUX_COMMANDE` (no tabs, no floating cart there). `BandeauGroupe` is an iris-outlined notice (`.eg-note`)
with an iris pill and a text « Quitter » — never lime; the restaurant page's « Commande groupée » is an iris-outline pill
(`.eg-bouton-iris .eg-depart`), hidden while a group for that restaurant is being composed. Team: `EquipeCommerce` is a hairline
list (initial, name, e-mail, status pill: green member / iris invited / orange expired, × to remove) and « Inviter quelqu'un » with
one iris button; `/equipe/:token` (EquipeInvitation.jsx) is a centred band + sheet card (« {commerce} t'invite dans son équipe »,
three ticks of what the member can do, one padlock line for what they can't, one lime action). A member's Mon compte has a
« Mon équipe » group (restaurant + `team.memberCard` + the Commandes row) and calls `definirModeEquipe` itself, so the tab bar
is right even before the orders page has loaded; on the orders page a member sees neither the « next step » nor terminal links.
**The admin console in the same family (2026-10-17, [src/admin-cadre.css](../../src/admin-cadre.css), imported by AdminLayout).** Every
app's [AdminPageHeader](../../src/components/admin/AdminPageHeader.jsx) is the iris band (`.admin-bande`): context line (hub icon,
« Console Fairide », tab name), the hub as title, the screen's actions as light pills on the right (view switcher = light segment,
`btn-teal` = white pill), the hub's apps as pill tabs (active one white), « En savoir plus »; its `::after` draws the top edge of the
white sheet, so no page had to be re-wrapped. « Aujourd'hui » puts the greeting, shortcuts and live figures on the band (the pulsing
« en direct » dot is the only lime). On the sheet, under `div.admin-console` (one notch above the per-app CSS files, which load
later): white stat tiles with a hairline (`.highlight` = iris tile), white pill search with a magnifier, pill chips, sentence-case
table headers and status badges, kanban columns on a light tint, an iris bulk-action bar. RecordDrawer: iris head, pill tabs, white
body rising over it. Width 1,280 px max, centred with container units (`cqi`) so the band still cancels the page padding. A
clickable stat tile must not set `border: 0` inline (white tile without its hairline is invisible).

At this size, **find the neighbouring rule before adding one.** Selectors of equal specificity are
resolved by order, and several blocks near the bottom (the 520px media query especially) override
rules written hundreds of lines earlier. A rule that "doesn't apply" is usually a rule that applies
and is then overridden.

Design tokens are CSS custom properties in `:root` at the top of the file. **Change colours
there, not at call sites.**

The identity is **"The frame"**: two brand colours and nothing else — iris `#3B2FB5` (the chrome)
and lime `#C8F03C` (the spotlight). See [FairRide-5a-spec.md](../../FairRide-5a-spec.md) for the
source spec and `maquettes/landing-iris/landing-iris.html` for the reference page.

| Token | Value | Role |
|---|---|---|
| `--iris` / `--iris-deep` | `#3B2FB5` / `#2A2185` | Brand. Headers, primary buttons, app icon |
| `--lime` | `#C8F03C` | Accent. Badges, active states, one CTA per view |
| `--ink` / `--ink-soft` / `--ink-faint` | `#14121F` / `#6B655D` / `#8A8377` | Text |
| `--line` | `#DCD8D0` | 1px hairlines — the only separator, there are no shadows |
| `--chip` | `#1E1A17` | Dark badge background, white text |
| `--cream` / `--cream-dim` | `#FFFFFF` / `#F4F2ED` | Page background / surface tint |
| `--red` `--blue` `--orange` `--purple` `--green` | | Status colours only, never brand (`--green` since 2026-10-13: « validé », « signé ») |
| `--promo` | `#E31B23` | Promotions only (below) |
| `--radius` / `--radius-field` / `--radius-pill` | `16px` / `8px` / `999px` | Cards / small containers (`--radius-chip` is an alias of `--radius-field`) / everything clickable. Re-checked against styles.css on 2026-10-13 — this row said 20px / 6px, which the code no longer used |
| `--radius-saisie` / `--iris-tint` / `--anneau-champ` | `16px` / `#EFEDFB` / iris 1.5 px + 4 px halo | Text fields (style B, 2026-10-19, below). `--anneau-champ-erreur` is the red twin |
| `--shadow` | `none` | Kept as a token so old call sites resolve to nothing |

**Three rules that are not negotiable, all inherited from the spec:**

1. **Lime only ever sits on iris, or as a filled block with `--ink` text on it.** Lime as text,
   as a 1px border or as a thin rule on a white page fails contrast and is invisible. Wherever
   you need "the accent, but on a light surface", the token is `--gold-deep` — which is iris.
2. **Backgrounds are white or iris. No third background colour**, and no gradients, no blurred
   halos, no drop shadows. Elevation is expressed by a hairline border.
   *One exception (asked for):* in the **app only** (`html.appli`: native app and home-screen site), the bottom tab bar is
   **liquid glass** since 2026-10-16 (version 2 of `maquettes/barre-onglets-verre/barre-onglets-verre.html`, after
   WhatsApp): near-transparent, short blur, highlights and a soft shadow; the active tab is a glass lens with iridescent edges
   that grows when pressed and follows the finger ([src/barreVerre.js](../../src/barreVerre.js), loaded with `import()` in the app only;
   on desktop Chromium it also refracts what passes under its edges; not on Android since 2026-10-20, too heavy on a mid-range
   phone). On the website it stays solid white. Since 2026-10-25 (`maquettes/appui-iris`) the app's tab icons fill with iris on the current tab and under the finger (`IconePleine`, Icone.jsx), and the cuisine drawings get an iris contour (appli.md).
3. **One lime accent per view.** If a screen already has a `btn-gold`, its active tab / badge /
   nav item uses white or iris instead. *Exception (founder, 2026-10-16):* the app's welcome/sign-up screens pair the lime
   button with the lime check of ticked options and the « Salut ! » chip.
4. **The lime button is the next click: one obvious action per screen** (founder, 2026-10-25, answers to
   `maquettes/une-action/une-action.html`, after Uber Eats' black « View cart » / « Add to order » / « Place order »). On every
   screen with something to do, exactly one lime button, full width at the bottom where it can be, and nothing else filled
   with colour competes with it: choices already made are an iris **outline** with an iris check on white (`.ec-option.on`,
   checkout and « Valider ma carte »), the cart's quantities are a white pill with an iris hairline (`.ec-pas`), a label is
   never lime (`pill teal`, not `pill gold`). The button **says what it does and how much** (« Aller au paiement · 38,10 € »,
   « Commander et payer · 42,00 € » — that last wording stays: the final button must say the customer commits to pay; no
   price pill next to it) and is **never greyed out**: if a choice is missing, tapping it goes there (`FichePlat` scrolls to
   the required group and frames it; « C'est bon » focuses the name field). When several things wait (courier documents),
   only the first is lime and the next becomes lime once it is done. A screen with nothing to do (browsing, account, a
   tracking page with notifications already on) has no lime at all. What it changed on 2026-10-25: the shop's cart bar
   (lime, always expanded, « Voir le panier » + total), the dish sheet, cart, checkout, tracking (« Chez toi vers 12:56 »
   and « Me prévenir quand … arrive »), order confirmed (« Suivre ma commande »), « Valider ma carte », courier documents,
   the site's /login header, the shop's menu and promotions screens.
   **The cart never hides anything** (founder, same day): the full lime bar shows where you shop (list, shop page, Recherche,
   Favoris, Carte); elsewhere a round bubble, lime too, iris when the page already has its own lime button. Both step aside
   whenever something opens over the page (`[role="dialog"]`: a dish, a sheet, a confirmation, the cookie card; the shop card on
   the map) and come back after; toasts and the site map's + / − sit above the bar. Checked by
   `maquettes/une-action/verifier-panier.mjs` (every popup on every screen with the bar, app and site; 0 overlaps on 2026-10-25).

**Promotions are red, like Uber Eats (founder, 2026-10-25, version B of `maquettes/promos-rouge/promos-rouge.html`,
bright red, website same as the app).** A third colour, `--promo` `#E31B23`, for a shop's offers only (« 1 acheté = 1
offert », « −20 % », « −4 € dès 25 € »), so a deal no longer looks like the lime next click. A filled red pill with the
tag icon only on the shop's photo in the list (`.rc-offre.rc-promo`; « Bientôt » keeps lime `.rc-offre`), the map card
(`.carte-fiche-promo`, `.promo-badge`); everywhere else red **text** with the tag icon, no pill: the dish's offer
(`.plat-promo`), the discounted price (`.est-remise`, still « avant 11,90 € », never struck through), the cart's
« −20 % inclus » (`.panier-remise`) and « Tu économises » (`.panier-economie`), the offer line of the checkout ticket
(`.co-t-ligne--promo`). The shop page's offer card (`.fiche-offres`) is white with a hairline, red tag and red first line.
Red text on white and white on red are both 4.7:1. Because red now means « deal », « Carte seule » (`.rc-vitrine`) went
grey; alerts keep `--red`. The shop's own screens (`.ec-plat-promo`, menu editor) are unchanged.
The Avantage Fairride on a list photo is short, « −5 % sur tout » (`libellePromo(…, { court: true })`): the full label was cut.

**« Offres » and « Courses » never look empty (founder, 2026-10-26, B + C of `maquettes/sections-pleines/sections-pleines.html`).**
These rows still list only shops that fit them (/classement), but show what they sell, from `resumeCarte.apercu` (backend:
4 dishes with photo and price, promo dishes first, one category after another; sent only for shops with an offer or of the
Courses family). One shop: its card full width (`.rc-grande`, photo 9:4; website: photo left, dishes right) with 4 dishes
underneath. Two or more: dish tiles (`.tuile-apercu`), 3 per shop, one shop after another, open first; a shop without a
preview keeps its usual card. `RangeeApercu` in `RestaurantList.jsx`. The row « Supermarchés » is now « Courses ».

The old names survive as aliases so ~100 call sites keep working: `--gold` = lime, `--gold-deep`
= iris, `--teal` / `--teal-deep` = iris. Prefer `--iris` / `--lime` in new code.

Fonts (since 2026-10-13, founder's choice on the Revolut model): **Inter** for the interface (`--font-ui`, 400–700) and
**Inter Tight** for `h1`–`h3` (`--font-titre`, 500–700) — one family, two cuts, not a font pairing. Both are **served by
Fairide** from [public/fonts/polices.css](../../public/fonts/polices.css) (since 2026-10-02 — Google Fonts loaded before cookie
consent and sent visitors' IP addresses to Google). Never re-add `fonts.googleapis.com`. Use the two tokens, never a
family name, at call sites. Aeonik Pro (Revolut's display face) was considered and set aside: it is a paid licence.
Headings keep `letter-spacing: 0` (Inter Tight is already tight); the `-0.02em` some older call sites carry is legacy.

**The logo is the bicycle « 5a »** (two wheels, top tube, seat tube; lime on an iris tile) — back since
2026-09-27 after nine days as the « Swept plume » bowl. Geometry lives in [BrandMark.jsx](../../src/components/BrandMark.jsx)
and is repeated in `public/icons/icon.svg`, `public/favicon.svg`, the splash in [index.html](../../index.html) and the
Belgian-colours version [BelgianMark.jsx](../../src/components/BelgianMark.jsx). The PNG icons and `og-image.png` are
renders of it: change the drawing, re-render them. The old bowl logo's spec and files are in `docs/archives/`
(`FairRide-logo-spec.md`, `brand-bol/`): never use them.

**The name is « Fairride », with two r (founder, 2026-10-25).** People typed « fairride » and could not find « Fairide »;
fairride.be was already ours. In sentences it is « Fairride »; the legal company keeps its name, « Fairide SRL »
(contracts, invoices, legal notices), and so do the hidden identifiers (`be.fairide.app`, repos, env vars, DB columns,
i18n keys) and, until the domain switch, `fairide.be` and the `@fairide.be` addresses. Mockup and choice:
`maquettes/fairride-deux-r/fairride-deux-r.html`, version C.

The one exception is the word `fairride` itself, which is set in **Bricolage Grotesque** (700–800,
optical sizing on) via the `.wordmark` class — lowercase, `-0.03em`, always written by
[MotMarque.jsx](../../src/components/MotMarque.jsx): « fair » in the text colour, « ride » in the accent (iris on
white, lime on iris through `--marque-ride`, set by the iris grounds in `styles.css`; the splash and `public/404.html`
write it by hand). Never type `fairride` into a `.wordmark` by hand: it would lose its two colours. « ride » always has the font, size, weight and spacing of « fair », only its colour changes (`.wordmark .wordmark-ride { font: inherit }`, founder 2026-10-27: the site sidebar showed a 19 px black « ride » next to a 26 px « fair »); `npm run check:marque` measures every wordmark on the site and in the app. It is a *logotype* face, loaded
from a `<link>` in [index.html](../../index.html) rather than the `@import`, because the splash screen
paints before `styles.css` exists. Seven call sites carry the class; `.wordmark` sets the family and
nothing else. Inside a heading, the *word* « Fairride » alone is shown as the wordmark through
[AvecMarque](../../src/components/AvecMarque.jsx) (2026-10-13). **Don't extend it to whole headings** — that would re-open the two-font pairing the design
direction closed when it dropped Fraunces.

Buttons: `.btn-gold` (lime) is **the** decisive action of a screen — pay, confirm, sign in.
`.btn-teal` (iris) is the ordinary primary action, and the default in dashboards. `.btn-outline`
is secondary, `.btn-hero-ghost` is the secondary button on an iris ground.

**Champs de saisie (B, étiquette flottante) — founder, 2026-10-19** (option B of the « champs » mockup). Every text field,
website and app: **white**, 1 px `--line` hairline, `--radius-saisie` (16 px), 16 px text, 52 px high (56 with a floating
label); focus = iris edge 1.5 px + pale-iris 4 px halo (`--anneau-champ`, the extra half pixel is an inset shadow so nothing
moves); error = red edge, red label, red `.field-error` line under; disabled / read-only = still white, dashed hairline, soft
ink. Never give a field the grey `--surface-soft` again. All of it is CSS in styles.css (« CHAMPS DE SAISIE, STYLE B » and
« L'ÉTIQUETTE FLOTTANTE » right after `.field`), no per-page work:
- **The floating label is automatic**: in `.field`, `.bv-champ` (app onboarding `Champ`) or `.address-search`, a `<label>`
  that is the **first child** and is **directly followed** by the control (input, select, textarea, `.password-input`,
  `.phone-input`) sits inside the field. Empty and unfocused, it shows like a placeholder (16 px, faint) and the real
  placeholder is hidden; on focus or with a value it slides to the top-left (12 px semibold, iris while focused). « Empty »
  is read by `:placeholder-shown`, or `[value=""]` (React mirrors a controlled input's value into the attribute) — a field
  CSS can't read stays floated, so a label never covers a value. Selects, dates/times, textareas and the phone field
  (country prefix) are always floated.
- **To write a new field**: `<div className="field"><label htmlFor="x">Label</label><input id="x" value={v} onChange={…} /></div>`
  — controlled, label first, nothing between label and control, keep `htmlFor` (accessibility). Error: `className="input-invalid"`
  on the control + `<p className="field-error">`. A placeholder is an example (« Ex : Rue du Midi »), never the label repeated.
- **Labels that stay above** (the field keeps the B look): a label holding a link/button/input (`.field-label-row`,
  « Mot de passe oublié ? », help bubbles), a label that isn't the first child, `.sr-only` labels, the whole admin console
  (`.admin-console`, `.record-drawer`: dense forms), and labels too long for one line — add `className="etiquette-dessus"`
  (the `Champ` component of InscriptionAppli.jsx does it itself above 45 characters). Put
  side-by-side fields either both inside or both above, or the row goes out of line.
- Search bars (`.recherche-champ`), the code boxes (`.bv-saisie`) and pills on iris keep their own shapes; only their focus
  moved to the halo.

Confirmation modals use [ConfirmDialog](../../src/components/ConfirmDialog.jsx) — never `window.confirm`,
which is suppressed in installed PWAs and webviews. The five `window.confirm` hits you'll find in
`src/` are all inside comments explaining this; there are no live calls. `window.prompt` has the
same problem and the same replacement, [ReasonDialog](../../src/components/admin/ReasonDialog.jsx).

**No emojis anywhere, admin included (founder, 2026-10-13).** Icons are the line drawings of
[Icone.jsx](../../src/components/Icone.jsx) (`<Icone nom="…" taille={16} className="icone-texte" />` inside text); a data table
holds icon *names*, not emoji (`RESTAURANT_TYPES[].icone`, `ORDER_STAGES[].icon`). Leaflet markers take HTML: use
[iconeHtml](../../src/iconeHtml.jsx). Strings that can only be text (CSV, `<option>`, `title`) get no icon at all, or a
monochrome glyph (✓ ✗). Message reactions are still *stored* as emoji (server values) and *shown* as icons
([reactions.jsx](../../src/reactions.jsx)).

**Shop categories: specialities and families (founder, 2026-10-22, `maquettes/categories-commerce/`).** A shop picks up to 7
specialities (~150, [specialites.js](../../src/specialites.js); the first is `restaurants.cuisine`, the others `extra_cuisines`);
customers see 19 families, derived from the list and never stored. One picker everywhere, sign-up in the app and on the site,
shop creation and Mon commerce ([ChoixSpecialites.jsx](../../src/components/commerce/ChoixSpecialites.jsx)). The colour
illustrations of the cuisines (3D in the app, 2D on the site) are allowed in three places only: the cuisine strip, « Par envie »
and the family tiles of that picker; everywhere else a speciality shows its family's line icon (`iconeSpecialite`). Hide
a family or speciality no shop carries. The backend keeps a copy of the list (`fairide-backend/specialitesCommerce.js`, a test
compares both): add a speciality in both, with its NL/EN label under `menuCategories.cuisine`.

**Gestures are app-only (since 2026-10-13).** Physical motion — springs with velocity hand-off, momentum projection,
rubber-banding ([src/ressort.js](../../src/ressort.js)) — runs only when `estNatif()`, loaded with `import()`, so the website
downloads nothing extra (founder: the site must not get slower). What uses it: sheets pulled down to close
([useFeuilleGlissable](../../src/hooks/useFeuilleGlissable.js), FichePlat and SousEcran — on the site they keep the plain
threshold + CSS transition) and, on iPhone, swiped right from the left edge (2026-10-27, appli.md › Gestures), and swipe-to-confirm for the courier's « récupérée » / « livrée »
([GlisserPourConfirmer](../../src/components/livreur/GlisserPourConfirmer.jsx); the site keeps the buttons). An animation with
`fill-mode: both` overrides inline transforms — the sheet's entry animation is `backwards` for that reason.

**App polish (founder, 2026-10-19, audit « Look and feel »).** Reuse these instead of re-inventing them:
- **Haptics** (2026-10-23) — `vibrer(sens)` in [gestes.js](../../src/gestes.js) takes a MEANING, never milliseconds:
  `choix` (a lens or segment passing over items), `bascule` (heart, switch, − / +), `valider` (a committing tap, fired AT
  the tap: Add, Pay, Accept, Claim, Send), `seuil` (a threshold crossed during a gesture, a lens landing), `pose`,
  `appuiLong`, `succes` (the answer that confirms), `attention` (blocked: missing option, cancelled job, refused order),
  `erreur` (every `toast(…, 'erreur')`, wired in ToastContext; failed payment), `alerte` (courier: a job arrives / is ready,
  a real 0.4 s buzz). No haptic on a plain tab tap, a swipe-back or a sheet dismiss (iOS has none there). Haptics no longer
  stop under Reduce Motion: the phone's own haptics switch applies. In the native app they go through the project's own
  plugin `Haptique` (ios/App/App/HaptiquePlugin.swift, registered by FairideViewController.swift; android/…/HaptiquePlugin.java,
  registered in MainActivity), with warmed-up generators; @capacitor/haptics is only the fallback for older builds. Old
  values (numbers, arrays, `selection`, `moyen`) are still mapped, but write meanings in new code.
- **Loading** — [Skeleton.jsx](../../src/components/Skeleton.jsx): `SkeletonCards` are row-shaped light-iris skeletons;
  `SqueletteEcran` is a whole loading screen in band + sheet (`titre` when the screen is known, shimmer bars otherwise,
  `photo` for the restaurant page). App only at call sites (`experienceApp()`); the bike rides while a skeleton shows.
  Skeleton rows (`.sq-lignes`) appear only after 0.3 s, so a fast answer never flickers. The full-screen `#splash` of
  [index.html](../../index.html) covers start-up only (app mounted), never the data wait: that is the skeletons' job
  (founder, 2026-10-26). On the website it is a plain white cover for the first second (it hides the prerendered text) and
  turns iris with the bike only on a slow load; in the app the native launch screen hands over to the iris bike directly.
- **Maps** — markers and route styles live in [marqueursCarte.js](../../src/marqueursCarte.js) (courier iris + lime bike,
  home lime, shop ringed iris; ridden route solid iris with a white edge, the rest iris dots). Map buttons are
  `.tracking-map-rond` (solid iris, white ring). Never reintroduce the near-black courier or the lime trail. The courier's
  `/driver/map` keeps the class `.carte-page`, so the customer map's glass / hairline zoom rules reached it: ecran-livreur.css
  puts its Leaflet zoom back to iris rounds with a higher specificity.
- **Courier earnings** (2026-10-19) — `/driver/earnings` reads `byWeek` and `rides` (backend `gainsLivreur.js`: one bar per
  week since the first week earned, one row per ride « shop → commune » with its tip folded in); the status text, the 90 % /
  100 % rules, DAC7 and statements sit behind « Ta fiscalité ». In the app, the website alert card (`AlerteLivreurBar`) is
  gone from the rides screen; the alert sound is a row in Mon compte ([SonAlertesLivreur](../../src/components/livreur/SonAlertesLivreur.jsx)).
- **Pull to refresh** — `<TirerPourActualiser onActualiser={promise} />` ([component](../../src/components/TirerPourActualiser.jsx)),
  native only, on Mes commandes, the restaurant list, the courier's Courses and the shop's Commandes.
- **Status bar** follows the band in the app ([barreEtat.js](../../src/barreEtat.js)): iris over an iris band, white otherwise.
- **Photo transition** card → restaurant page with the View Transitions API ([transitionPhoto.js](../../src/transitionPhoto.js)).
- **Data already read stays in memory** (2026-10-20, [cacheDonnees.js](../../src/cacheDonnees.js)): the restaurant list and pages show
  what was read during the visit at once and re-read in the background (same answer = same object, no re-render); a card
  prefetches its page on touch. A plain Map, never localStorage (nothing to declare), emptied on logout, keyed by token.
- **The list carries no menus** (2026-10-24, [resumeCarte.js](../../src/resumeCarte.js)): home, list, map, search, favourites
  and « À découvrir » read `GET /restaurants?vue=liste` (each shop without `menu`, with `resumeCarte`: dish counts and the first
  dish promo); Recherche reads the dishes it searches from `?vue=plats` on first use; only the restaurant page loads a menu.
  Without `?vue` the backend still sends the full answer: the prerender and app builds already installed read it.
- **Light only**: `color-scheme: light only` (index.html + styles.css) and a Light Android theme. No dark mode until one is
  designed; iOS needs `UIUserInterfaceStyle = Light` (docs/application-mobile.md).

**Shop screens, design audit 2 (founder, 2026-10-19).** The new-order sheet ([NouvelleCommandeModale](../../src/components/NouvelleCommandeModale.jsx))
accepts in one tap (prep time + lime « Accepter · prête vers HH:MM », Refuser with reason, Imprimer, Plus tard; no « Tu gardes »); the home's
« 1 commande à traiter » opens it (`onOuvrir`, state in DashboardLayout). Customer line, ready time and the shop's share are computed from the
orders already loaded ([clientCommande.js](../../src/components/commerce/clientCommande.js); `order.commune` is the SHOP's commune, the customer's
comes from the postal code). App orders screen: alarm as one band line ([LigneAlarme](../../src/components/commerce/LigneAlarme.jsx), white
« Couper », never lime), sections À traiter / En préparation / Prêtes, glass « Accepter #058 » bar above the tabs (portal; the website board keeps
Accepter on the card), courier as a person ([LivreurCommande](../../src/components/commerce/LivreurCommande.jsx): no ETA, no vehicle — neither reaches the
shop). Shop home: « Ce soir chez … » band and three tool tiles ([CeSoir.jsx](../../src/components/commerce/CeSoir.jsx)) once setup is done; the setup pill says
« Visible · paiement au comptoir » while Stripe is not active; « Supprimer ce restaurant » lives in Infos légales. Three tool tiles since
2026-10-22 (Statistiques, Promotions, Factures): the Avis tile, the reviews page and the signed replies went with customer
reviews (founder, conformite.md); never bring back stars or ratings meanwhile.

Note the two heavily-commented rules near the top of the file — `overflow-x: clip` on
`html`/`body` and `-webkit-tap-highlight-color: transparent`. Both encode a bug that was
already fixed once (`clip` rather than `hidden`, because `hidden` silently breaks
`position: sticky`). Read the comments before touching them.

### Dishes without a photo

On the **client** menu ([MenuCategorySections.jsx](../../src/components/MenuCategorySections.jsx)), a dish
with no image renders as a compact text-only card — name, description, price, and the `+` moved down
onto the price row. No placeholder frame.

This matters more than it sounds: cards imported from a platform are often photo-less in bulk
(248 of Punjab Tandoori's 249 dishes), and the old category-emoji frame filled whole sections with
identical 🍽️ blocks.

The restaurateur's editor ([MenuItemRow.jsx](../../src/components/MenuItemRow.jsx)) does the same since
2026-09-25: its dish tiles reuse `menu-item-card-sans-photo`. It used to keep the empty emoji frame on
purpose, as a prompt to add a photo, but a whole imported card of them (Le Laakam: 156 dishes, no photo)
looked like a broken page. The prompt now lives only in the edit form, next to the photo field
(`dish-thumb-empty`). Don't bring the frame back to the grid.

**The basket is the exception** (Owen, 2026-10-26, `maquettes/suggestions-sans-photo`, version B): in « Un dessert ou une
boisson avec ça ? » (UpsellPanier.jsx) and on each basket line (PanierPage.jsx), a photo-less dish keeps its image slot so the
row stays aligned with the dishes that have a photo, and fills it with [VignetteSansPhoto.jsx](../../src/components/VignetteSansPhoto.jsx):
a drawing of what it is (can, bottle, ice-cream tub, cone, cake slice… picked from the name; Icone.jsx) on the colour of a
flavour **written in the name** (`--gout-*` tokens: cola, orange, lemon, vanilla, chocolate…), iris tint when no flavour is
written. Never guess a flavour, and never draw a placeholder that looks like a photo that failed to load (the old grey box
with 16 px cutlery did). Still to come: real photos for branded products (a Coca-Cola 33 cl can is the same everywhere),
once Fairride has its own photos of them.
