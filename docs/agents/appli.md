# The native app (Capacitor) and app mode

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching anything the app shows (`experienceApp()`, `html.appli`, `src/pages/app/`, natif.js, push).
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Builds and native plugins

`@capacitor/*` wraps the same `dist/` into the iOS and Android apps (`npm run app:sync`, `app:android`, `app:ios`);
everything native goes through `src/natif.js` and `src/pushNatif.js` — see
[docs/application-mobile.md](../../docs/application-mobile.md) for what is in place and what still needs store accounts.
**Releasing the Android app**: never bump `versionCode` by hand — see « Mettre à jour l'application » in that file
(Fairide Test builds itself on every merge to `main`; the Play Store app is GitHub › Actions › *App Android Play
Store* › *Run workflow*, which uploads to Internal testing itself).
**Releasing the iPhone app**: nothing to do — every merge to `main` builds it on GitHub's Macs and sends it to TestFlight
(`app-ios-testflight.yml`, since 2026-10-23); its signing expires 2027-10-23 (see « Sortir une version iPhone »).
**The app icon** comes from [scripts/app-assets.mjs](../../scripts/app-assets.mjs) (`npm run app:assets`, then `app:assets:ios`):
the bike covers 72 % of the tile since 2026-10-25 (founder: 82 % touched the edges). On iOS 26 a one-image icon
(`AppIcon.appiconset`) gets an automatic Liquid Glass coat that greys the lime (#C8F03C shows as ~#B4D44F); the website
icon added to the home screen does not, which is why it looked brighter. The cure is the Icon Composer file
`ios/App/App/AppIcon.icon` (2026-10-25), written by hand from Windows, no Mac: `icon.json` = solid iris `#3B2FB5`
background (sRGB), one layer `Assets/velo.svg` (copied there by the script) with `glass: false` and `scale` 1.045 (actool
draws the layer a bit smaller: 1.045 gives back the 71 % of the tile seen on the iPhone before), and the group's specular,
blur, translucency and shadow all off. It is registered in `project.pbxproj` (type `folder.iconcomposer.icon`, in
Resources); GitHub's Mac (Xcode 26) compiles it. Format reference: github.com/dfabulich/unofficial-apple-icon-composer-json-schema.
**Never add `"color-space-for-untagged-svg-colors": "srgb"`**: actool crashes on it (« attempt to insert nil object »,
iOS build #58 on 2026-10-25, every iPhone build failed until removed). To test an `.icon` change without a full build, run
`xcrun actool <file>.icon --compile out --platform iphoneos --minimum-deployment-target 15.0 --app-icon AppIcon
--output-partial-info-plist out/p.plist --output-format human-readable-text` on a GitHub Mac: it prints the real error
(the TestFlight workflow cuts the log to 40 lines) and writes the rendered PNGs.
Keep `AppIcon.appiconset` for iOS 18 and older. Users who pick « Clear » or « Tinted » icons still get iOS's recolouring.
`@capacitor/geolocation` and `@capgo/capacitor-social-login` (Apple / Google sheet — the site's Google button is refused
inside a WebView) are loaded with `import()` from `natif.js` only, so the website never downloads them.

## The app
**The app has its own first-launch screens** (2026-10-11, [src/pages/app/Bienvenue.jsx](../../src/pages/app/Bienvenue.jsx),
route `/bienvenue`, outside `<Layout>`; designed with the founder on `maquettes/app-onboarding/app-onboarding.html`).
**Look since 2026-10-16** (version D of `maquettes/onboarding-chaleur/onboarding-chaleur.html`): every white screen of the
welcome flow, the in-app sign-up and the in-app login has an **iris header** (back, progress, title) and the rest in a white
**sheet** with rounded top corners — a screen puts what follows its title in `<Feuille>` (EcransBienvenue.jsx), the container
carries `.bv-bandeau`. Progress is a dashed road the brand bicycle rides along (`Route`); main buttons are lime; ticked
options show a lime check. Outside a `.bv-bandeau` screen (notifications primer, courier dossier) `.bv-feuille` is `display: contents`.
**Same family, client screens (2026-10-16, versions picked on `maquettes/autres-idees/autres-idees.html`)**: an order in
progress opens on an iris header with a big friendly status (`titreSuivi`) and a road where the lime bike rolls stop to stop
(`RouteSuivi`, orderStatus.jsx; past orders keep the compact card; since 2026-10-25 the arrival time is the title, `TitreHeure`)
— 1C; the cart is a full-width bar whose total rolls (FloatingCart, `ChiffresRoulants`) — 2C, lime and always expanded since
2026-10-25 (« one obvious action », design.md rule 4); a dish's « + » opens into « − n + » with the
number in a lime circle and folds back to a circle that keeps the count (`PasPlat`, MenuCategorySections), and the dish sheet's
quantity and « Ajouter » are one lime block — 3C; full-page empty screens (orders, favourites, cart) show the bike waiting on its
road (`EtatVide scene=…`) — 4B. Buttons inside these need `min-height` overrides: the global 44 px touch rule has specificity (0,3,1).
**The order in progress on every screen (2026-10-26, A3 of `maquettes/commande-en-cours/`)**: the Commandes tab pill and the
notification bell are gone (one had to tap « Notifications » to clear a number). Instead a 60 px bar sits where the cart bar sits
(above it when both show, left of the cart bubble): the shop photo in a ring that fills step by step, « shop · type », the
step (`titreSuivi`), a chevron to Mes commandes ([SuiviCommande](../../src/components/client/SuiviCommande.jsx), shared reader
[useCommandeEnCours](../../src/hooks/useCommandeEnCours.js): /orders/mine every 15 s only while an order is in progress, else on
screen change and app resume). Lime when ready to collect, red until Mes commandes is opened when refused or cancelled (seen ids
in localStorage `fairide_suivi_vus`, 6 h max), « Bon appétit ! » for 6 s after delivery. Hidden on Mes commandes, in the cart
and checkout, under any dialog, like the cart bar (client-ui.css). Same on the phone website.
**Mes commandes and Recherche with the bike (2026-10-24, version A of both screens in `maquettes/commandes-recherche/`, « site
pareil que l'app »)**: the app's Mes commandes is now the website's screen (Orders.jsx, one render path): the order in progress IS
the iris band (`RouteSuivi`), under it the app keeps `carteEnCours` (courier, code, « Détails » folded); past orders are the
website's short cards (`.sc-passees`, « Commander à nouveau » + « Détails » opening under the card); no order in progress, loading or
not read = `BandeauCommande` with the title and the road where the bike rolls on scroll. Recherche has the road under the field, app
and site: the bike rolls on scroll and moves 9 points per letter typed. Both use `RouteVelo roule` / `useVeloQuiRoule` (TeteListe.jsx,
shared with the list's band). The `.sc-commandes` / `.sc-passees` rules of site-commande.css are no longer website-only.
**Every main screen in that style (2026-10-16, « Proposition » phones of `maquettes/tous-les-ecrans/tous-les-ecrans.html`)**:
restaurant list (address on an iris band with the riding bike, strip of cuisine families with a draggable glass lens and, under the chosen
family, a row of its specialities: TeteListe.jsx, lentillePuces.js), map, favourites, restaurant page (sheet over the cover, glass sections strip, floating round buttons in solid iris
with a white ring — white-on-glass was unreadable), cart / checkout / order confirmed (EcranCommande.jsx), Mon compte (EnteteCompte.jsx;
order since 2026-10-27, `maquettes/compte/compte.html` version B, every role, site the same: one « Gérer mon compte » row that opens
every personal setting in a sheet (Mon profil / Préférences / Confidentialité; a courier's papers, location and alert sound in it too).
Customer: then Portefeuille (balance + lime « Ajouter un code », cards, meal vouchers), the referral card with its gain and code,
Assistance, Fairride. Shop / courier: then Mon commerce / Mes courses, Solde et avantages (plain referral row), Assistance. All:
« Aussi sur Fairride » (MesCasquettes) as plain rows at the end; Messages on top only when unread, else in Assistance),
business dashboard / orders / menu / stats (BandeauCommerce.jsx, CarteCommerce.jsx), courier dashboard / job in progress / earnings
(RouteVelo.jsx). **Each family's CSS lives in its own file imported by its pages**: `src/ecran-liste.css`, `ecran-fiche.css`,
`ecran-commande.css`, `ecran-compte.css`, `ecran-commerce.css`, `ecran-livreur.css` — look there before styles.css. Glass, blur and soft
shadows are scoped to `html.appli`; the website keeps iris bands and white sheets without glass.
**The website on a phone shows the app's screens (founder, 2026-10-25, answers to `maquettes/une-action/panier-et-site.html`)**:
below 900 px (`useSiteLarge(900)` false) the site renders the app's layout, only without glass: the shop page
(`vueAppli` in RestaurantMenu.jsx: seal, category, distance/fees ticket, « À plusieurs », menu preview, bistrot menu), order
tracking (`vueAppli` in Orders.jsx), a shop's orders (OrdersPage: compact band + « Accepter » bar; the 3-column board is for
computers only), the login look (iris band + sheet, site-cadre.css; the logic stays Auth.jsx for shop/courier sign-up and
browser Google), the visitor header (logo + « Connexion » only; Aide, Contact and languages in the footer), and the iris band
on every general and shop screen (the visitor site's white override is gone; Questions, Mode d'emploi and Aperçu got their
band in the app too). Computers keep their own layout (side menu, columns). Still different on purpose: the visitor home
(presentation page on the site, for search engines and the 10 % pitch). The courier dossier is ONE flow since 2026-10-25 (below).
**The app glass of 2026-10-23** (answers to `maquettes/verre-boutons/verre-boutons.html`) is in ONE file, [src/verre.css](../../src/verre.css): an iris glass band under the status bar once the page scrolls, on iPhone and, since 2026-10-26, on Android 15+ where the app runs edge to edge (on Android 14 and older the status bar is solid, `env(safe-area-inset-top)` is 0 and the band has no height; `maquettes/iphone-android`) ([verreBarreEtat.js](../../src/verreBarreEtat.js), it waits for a restaurant photo to leave, and stays off while a solid iris band fills that zone — the list's « Livrer à » band: on top of it the glass looked brighter with a line, 2026-10-25), milky « clear » glass with an iris rim for the restaurant round buttons, puces, Livraison / À emporter, map controls and the chips above the restaurant list (« Ouvert », commune, search word; 2026-10-26, `maquettes/filtre-ouvert`), vivid iris WITHOUT GLARE for every « + », a dish's « − 1 + », the Livraison / À emporter thumb and a lit list chip (the cart's « − 1 + » is white with an iris rim since 2026-10-25, #245) (2026-10-25: solid iris, white 1 px rim, iridescent edges, soft shadow; the top white shine, top highlight line and dark inner bottom shadow were removed — « like it was trying to go 3D » — and see-through iris glass is not an option: it dulls the iris on white, 2026-10-23). They still grow on press, with no light under the finger. Toasts keep the 72 % iris glass.
**Glass everywhere (2026-10-26, answers to `maquettes/verre-partout/verre-partout.html`)**: an inventory of every button on 28 app
screens (`inventaire.mjs` there) left five web-style families; all now use the recipes above, in the « LE VERRE PARTOUT » block of
verre.css: choice chips (checkout tip, Recherche communes / questions, shop gift-card filters: clear glass, vivid iris when chosen),
switches (`.co-interrupteur`, `.ec-interrupteur`; the lime shop open/closed switch stays lime; they don't grow, their knob already
stretches), secondary buttons (`.btn-outline`, `.alerte-compacte-son`, `.eg-bouton-iris`, `.tracking-expand-btn`, `.ec-pilule-blanche`:
clear glass; the courier's urgency `.btn-outline` on the iris band gets glass-on-iris), every enabled `.btn-teal` (vivid iris), and on
iris bands the Mon compte shortcuts and FR / NL / EN (white 10 %, not the 18 % of the round back button, which lit whole tiles).
They are in `VERRE` (verreAppui.js); those wider than 120 px grow like a bar (`LARGES`), not by 30 %. Kept without glass on purpose: lime
buttons, checkout option rows, cards / tiles / rows, the dish photo ×, option marks, fields, text links, the website. « Enregistrer »
in Mon compte sub-pages is lime (the next click).
**TestFlight feedback of 2026-10-24**: (the three lenses already glide the same way since PR #220, 2026-10-23.) The map has no
+ / − in the app (`zoomControl: !experienceApp()`, RestaurantsMap.jsx: pinch and double tap zoom; at 84 px from the bottom they sat under the
tab bar). **The cuisine strip is Uber Eats-style since 2026-10-25** (version A of `maquettes/barre-cuisines`, app and site): no
frame at all (before: a white pill with a hairline), each family's drawing at 52 px with its name under it (3D in the app, flat on the
site), and it scrolls away with the page: only the iris band is in the sticky block (`.liste-tete--collante`), the strip is the
`.lt-cuisines` after it. **Since 2026-10-27 the strip shows Uber Eats' categories, flat** (`CATEGORIES_CLIENT` in
src/specialites.js, also « Par envie » and the map filter): Uber's list from Owen's Brussels screenshots, plus Kebab,
Afrique, Libanais, Maghreb, Europe; no row of specialities under the strip any more; a category shows from 1 shop; each has its own
Fluent drawing, never shared. Halal / Végé / Vegan / Sans gluten come from what the WHOLE shop declares (« Toute ta carte est… ? »,
RegimesCommerce.jsx, at the top of the speciality picker at sign-up and in Mon commerce; backend migration 094). Shops still pick
specialities in the 19 families. Order = what people want most (Owen, 2026-10-27): Pizza, Burgers, Indien, Sushi, Poulet,
Fast-food, Thaï, Petit-déj, then the rest, Courses last. **No « Tous » chip** (2026-10-27, like Uber): the list opens with
nothing lit = everything; tap a category to filter, tap it again to go back to everything; the lens pops in on the first pick
and shrinks away in place when turned off (`lt-lentille--vue`). The chosen category keeps its lens: glass in the app (lentillePuces.js grows it and lets the finger drag it),
a solid iris pill on the site. **Press in iris (2026-10-25, `maquettes/appui-iris`)**: in the app the chosen family's drawing keeps an iris contour that follows its shape (SVG filter `#lt-contour`, plain iris, no glint: tried and refused the same day), and the drawing under the finger gets it too and grows 6 % (the filter is injected by lentillePuces.js, which also sets `.lt-puces--contour`; 80 ms delay on touch so a swipe does not light it); on the website a mouse hover lights a turning iris ring around the family (`::after`, ecran-liste.css, `hover: hover` only). Bio / Vegan / Halal / Sans gluten stay hidden (`MENTIONS_ALIMENTAIRES`) until shops fill them in. The white sheet lip under the band stays white when scrolling (a fade to iris was tried and refused). `html` has `text-size-adjust: 100%`: iOS enlarged a long section
name (Hill's) to fill the screen; section pills cut at 220 px with « … » (`.quicknav-libelle`).
**Gestures (2026-10-23, revised 2026-10-27)**: dragging a restaurant photo down no longer closes the page (founder, 2026-10-27: « clunky »; FermerFicheParGlissement.jsx deleted): leave a restaurant with the iOS edge swipe, Android Back or the cross. **Every full-screen sheet answers both gestures (2026-10-27)**: pulled down from anywhere, and on iPhone swiped right from the left edge (24 px) — the sheet follows the finger and uncovers the real screen it was opened from, the release decides with the finger's momentum like iOS's back ([useFeuilleGlissable](../../src/hooks/useFeuilleGlissable.js): SousEcran — every Mon compte, Mon commerce, checkout and courier sub-screen —, PageFeuille, FichePlat; not Modale / ConfirmDialog, which are small bottom windows like iOS alerts). While any modal window is open (useDialogue), WebKit's back swipe is switched off (`suspendreRetourIos`, natif.js → `RetourNatifPlugin` in FairideViewController.swift; needs an iOS build), otherwise it walked the history UNDER the sheet. Step flows (`.bv` screens, EcranPlein: courier dossier, « Envoyer ma carte », welcome) have no edge swipe: nothing real is behind a step; Android Back and their ‹ step back. Android needs no JavaScript gesture: its system Back (backButton) closes the sheet on top. **No JavaScript swipe back between pages** (founder, 2026-10-23: removed, edge and « from anywhere » alike — on the list the page slid sideways over an empty background): go back with the back / close buttons; Android keeps its system gesture. **iOS's own back swipe from the left edge stays** (founder, 2026-10-23: « I really like the swipe »; answer 6 of `maquettes/transitions-appli`): WebKit's gesture (`allowsBackForwardNavigationGestures`, FairideViewController.swift) shows the previous screen under the finger, and does nothing where there is no screen behind — unlike the removed JavaScript one. Dragging from the white sheet under the photo was tried and removed the same day. The pull-to-refresh iris zone is portalled into `<body>` (fixed inside the moving `<main>` it slid down and showed white). Pull to refresh decides the direction on the first 10 px (sideways = a row like « À la une » scrolling) and keeps its blocking touchmove only while the page is at the very top. **Dragging a lens (2026-10-24)**: on the tab bar the finger drags the lens from any tab (a child's `lostpointercapture`, from the browser's automatic capture of the touched icon, used to cancel the drag after 6 px: barreVerre.js, lentillePuces.js and bandeSectionsVerre.js only listen to their own); on the cuisine and sections strips a finger HELD 250 ms grabs the lens from any pill and drags it (the strip stops scrolling while held, `touchmove` cancelled), a quick swipe still scrolls the strip. **Filled tab icons (2026-10-25, `maquettes/appui-iris`)**: in the app each tab icon has a filled version (`IconePleine`, Icone.jsx, `.icone-creux` lines in the background colour) shown on the current tab and on the tab under the finger; on contact the lens jumps under the finger (it used to grow in place and move only on release), and the released tab stays lit until React Router's transition makes it active (barreVerre.js, `attendre`).
**Restaurant menu in the app (2026-10-24, answers to `maquettes/menu-lignes/menu-lignes.html`, ecran-fiche.css)**: dish rows « name … price » with NO dotted leader (version A: price right-aligned on the name's first line, `.bistrot-points` stays as an empty spacer), a light hairline (#ECEAE5) between two dishes, price in ink and iris only when reduced; section titles left-aligned in ink (Inter Tight 21 px) with a short 40 px dashed iris line under them (the bike road). The website menu is unchanged. **Since 2026-10-25 the « name … price » row is only for dishes WITHOUT a photo** (answers to `maquettes/menu-photos/menu-photos.html`, version A, the Uber Eats rule, website too): a section where every dish has its own photo (and more than one dish) is a grid of tiles (`plats-grille` / `plat-tuile`, client-ui.css: square photo, « + » on its corner, name, price, description; two columns on a phone, as many as fit on the website); in a list section, a dish with a photo uses the website row with the 112 px photo on the right (112 px even under 400 px in the app) and the price just under the name (ecran-fiche.css). The 56 px photo on the left is gone. The rule is in MenuCategorySections.jsx (`grille`), so the business preview follows it too. **No logo on the restaurant page since 2026-10-25** (`maquettes/sans-logo`, acquis.md): the seal that sat on the sheet's edge is gone, the header is `.fiche-entete--ticket` and the name comes right under the photo.
**Glass that answers the finger (2026-10-24, version B of `maquettes/verre-appui/verre-appui.html`, « iOS 26 »)**, native app only, in
[verreAppui.js](../../src/verreAppui.js) (loaded by `demarrerNatif`) + the end of verre.css: every glass control (its list is `VERRE` in that
file: the WHOLE tab bar, cuisine and sections strips, cart bar, restaurant round buttons, Livraison / À emporter, « + », « − 1 + », map
chips, back buttons) grows the moment the finger lands (buttons 30 %, founder 2026-10-26 — 8 % in the mockup, then 12 %, then 50 % on 2026-10-25 —; bars `BARRES` keep 3.5 %, a little more when short), a pressed button rises one z-index step so it covers its neighbour, leans 2–3 px toward it, a light
(`<verre-lueur>`, injected once) follows the finger and the rim lights up; release = spring (damping .55, response .4 s). `scale` /
`translate` inline, so a control's own `transform` is kept. Strips that scroll sideways wait 70 ms (a scroll that starts cancels).
Cards and rows keep the .97 press-down (glass grows, content presses down). Every `.flux-bouton`, every heart (`.favorite-heart`, no light on a bare heart) and the ‹ of sheet pages (`.page-feuille-fermer`: Mes favoris, Mes commandes…) are in `VERRE` too (2026-10-25); the ‹ of a Mon compte sub-screen (`.sous-ecran-tete .flux-bouton`) is clear glass. Back buttons are glass: ‹ rounds on iris bands
(`.ec-rond`, `.gn-rond`, `.bv-rond`), « ← Retour » / « ← Mon compte » as 44 px clear-glass pills. The website is unchanged. **Sheet pages (2026-10-27)**: every page that opens as a sheet from Mon compte (Favoris, Mes demandes, Mes factures, Mes documents, Mes commandes, courier Gains / Factures / documents) starts with its iris band right under the handle (`.ecran-bandeau` / `.ec-page` / `.ecl`, rules next to `.page-feuille-corps` in styles.css and ecran-livreur.css; Mes commandes and Gains used to leave a 52 px white strip) with the bike road under the title, so the sheet ‹ (`.page-feuille-fermer`) is the same glass round as `.ec-rond` (clear glass only while the page has no band yet). Mes factures and Mes documents opened as a page put « ← Mon compte » on the band (`.eb-retour`), like the courier band. The customer's Mon compte has two shortcuts (Favoris, Mes factures): « Commandes » is already a tab.
**Screen transitions (2026-10-23, Owen's answers to `maquettes/transitions-appli/transitions-appli.html`, native app only, iPhone and Android)**, in [transitionPhoto.js](../../src/transitionPhoto.js) + [transitions-appli.css](../../src/transitions-appli.css):
a forward navigation slides the new screen in from the right (350 ms, the old one moves −30 % and darkens), back is the reverse. It goes
through the router history (`envelopperNavigations` in i18n/historiqueLangue.js: `push` and `go(-1)` / `back()`); only a navigation
that follows a real tap (< 400 ms) or a gesture (`back({ geste: true })`: Android Back, the cross) slides — redirects, same-screen
changes, `state.fond` sheets (opening AND closing: their ‹ used to slide Mon compte sideways after the sheet had gone down, founder 2026-10-26) and tabs (`replace`) don't. A card leading to a restaurant page (list, Recherche, Favoris, Carte) gives
it its photo instead of sliding; a dish gives its photo to its sheet (`ouvrirAvecPhoto`). The cross of a restaurant page and the ‹ of
the order screens go BACK when the previous history entry is that screen (`cheminPrecedent`), so the list comes back at its scroll
position. **The cart's ‹ goes back to wherever the cart was opened from** (home, Recherche, Favoris, a shop page… founder
2026-10-25; `ecranDavant` in EcranCommande.jsx, app and site): only when that screen is unknown (direct link, reload) or is
checkout / login / payment result does it open the shop page. To get back to the menu, the cart has a clear iris-outline
« + Ajouter des articles » under its lines (never lime: « Aller au paiement » stays the one lime button), and the shop name
on the band is a link too; both go BACK when the shop page is the previous screen (`useReculerVers`). Tabs (DashboardSidebar `ongletAppli`): `replace` + `state.restaurerDefilement` (each tab keeps its place; Recherche and Mes commandes open at the top instead, founder 2026-10-24, `ONGLETS_EN_HAUT`), re-tapping the
current tab scrolls to the top. `.page-fade` doesn't animate in the app. Modale / ConfirmDialog rise from the bottom and are pulled
down to close (useTirerPourFermer). The page bounces at the bottom only (`html.pres-du-bas` past half the page; native bounce turned
back on in FairideViewController). Press feedback: buttons `scale: .96` + darker, cards `.97`, rows an iris tint. Without View
Transitions (iOS 15–17, old Android WebViews) screens swap instantly. Every `:hover` rule is wrapped in `@media (hover: hover)` at
build time (vite.config.js, `survolALaSouris`) — site included, so nothing stays « hovered » after a tap on a touch screen.
`historique.back()` exists since then: Android's Back button called it and it threw, so Back did nothing outside tabs and dialogs.
On the website, `.page-fade` animates with
`backwards`, not `both`: an opacity held after the animation disables `backdrop-filter` for everything inside the page.
In the app, `/` never shows the marketing landing: first launch → `/bienvenue`, afterwards → `/restaurants` (Home.jsx).
**Shorter since 2026-10-22** (version picked on `maquettes/onboarding-court/onboarding-court.html`): the same welcome for all three
profiles (slogan « Paie ton repas, pas la plateforme. », euro bars of a 12 € dish); the customer answers ONE question (« Payer moins »
/ « Un total sans surprise » / « Que mon argent reste ici »), whose card leads « Ce que tu y gagnes » (no « Tu nous l'as dit »), then
location and the account: 5 screens before the account instead of 8 + 3 swipe cards. Each profile sees its own gain first: the
customer their money, the courier « Ce que tu gagnes » (90 % of the delivery, 100 % of tips, their minimum), the business « 10 %, pas 30. »
with what the platform takes on a 20 € order. « Payer moins » is the customer's wish; the screens never answer it with « moins cher ».
**« Tu as envie de quoi ? » is back since 2026-10-25** (version A of `maquettes/onboarding-gouts/onboarding-gouts.html`; it had been
cut on 10-22): AFTER the loading screen, tiles of the shop families (specialites.js) that have a shop delivering to you, each with
its count, several choices, the button counts live (« Voir mes 4 commerces » / « Un peu de tout », « Passer » on top). Skipped when
nothing delivers. The result then says « N commerces pour toi », those first with « Pour toi ». The picks stay on the phone only
(`fairide_bienvenue.familles`, src/envies.js). **They change nothing else since 2026-10-26** (founder: « je n'aime pas ces points
verts », the screen is « juste pour le plaisir »): the Restaurants page no longer has a « Tes envies » row nor puts those families
first with a lime dot; everyone sees the same page, and /classement no longer mentions them. 6 screens before the account for the customer.
On the web `/bienvenue` redirects home unless `?apercu` is set (that is how to review it with `npm run dev`). Its copy
is in the `appli` i18n namespace. **Sign-up happens inside it** (2026-10-15, [InscriptionAppli.jsx](../../src/pages/app/InscriptionAppli.jsx)):
« Continuer avec mon e-mail », and Apple / Google for an account that does not exist yet, no longer go to `/login` — one question
per screen, no scrolling at 375×667, same data and routes as Auth.jsx (change a field rule in both, and in the backend). Only
**The app has no website chrome** (2026-10-15, [Layout.jsx](../../src/components/Layout.jsx), `APPLI`): when `experienceApp()`,
no page shows the site header, footer, legal-links row or cookie card. Signed in, every page — help, legal, « C'est bon » —
stays in the tab shell with a « ← Retour »; legal links live at the bottom of Mon compte. Signed
out, a slim app bar (brand or back, « Se connecter »). `/login` is [ConnexionAppli.jsx](../../src/pages/app/ConnexionAppli.jsx)
(2FA, unconfirmed e-mail, forgotten password, Apple/Google). **Crash reports (Sentry) are ON BY DEFAULT in the app, never behind a
blocking screen** (founder, 2026-10-16, risk accepted: the research on Belgian art. 10/2 loi 30-07-2018 / APD 85/2022 found it
unclear, question for the lawyer in AVANT-PRODUCTION.md). The rule lives in `rapportsPanneActifs` (consent.js): accepted, or no answer
and `experienceApp()`. Off switches: a pre-ticked box in its own card at the end of the in-app sign-up (never next to the
opposite-direction « no news » box) and an Activer / Couper row in Mon compte (`RapportsPanne`, Account.jsx; for a customer it sits in
Gérer mon compte › Confidentialité). Someone who turned them
off is offered « Envoyer le rapport » on the crash screen ([AppErrorBoundary](../../src/components/AppErrorBoundary.jsx), one report only).
Sentry is set to errors only, no sessions, no console breadcrumbs, URLs without parameters, no user identity (sentry.js). The
privacy policy (CONF-2026-10-16) says so. On the website nothing changes: Sentry only after « Accepter » on the cookie banner. Stripe
(Connect, Identity, billing portal) always opens through `allerAuPaiement` (in-app browser, return path) — never
`window.location.href`, which left the app.
**First-day flows are app screens too** (phase 2, 2026-10-15), opened full-screen through [EcranPlein](../../src/components/EcranPlein.jsx)
(a portal into `<body>` — inside the shell, `.page-fade` broke `position: fixed`; a Modale / ConfirmDialog opened from inside it
stacks above it through one rule, `.bv-plein ~ .modal-overlay` in styles.css, checked by `check:app`): a business's « Envoyer ma carte »
([EnvoiCarteAppli](../../src/components/commerce/EnvoiCarteAppli.jsx)), the courier's draft dossier
([DossierAppli](../../src/pages/driver/DossierAppli.jsx), one topic or one document per screen — since 2026-10-22 the express order
« Ton activité », « Tes courses », non-EEA documents, ID (Stripe, no selfie), « Pièce vérifiée », payouts, photo, « Mes
engagements », then [FinExpress](../../src/pages/driver/DossierAppli.jsx) when the backend sends / approves it, see conformite.md; shared rules in
[dossierCommun.js](../../src/pages/driver/dossierCommun.js)); once sent, validated or suspended it shows
[DossierSuivi](../../src/pages/driver/DossierSuivi.jsx) (2026-10-19, second design audit: band « Dossier
envoyé » / « C'est bon, tu peux rouler », one lime « Voir les courses », counters as white tiles, rows opening sheets; the blocks
both versions share live in [dossierBlocs.jsx](../../src/pages/driver/dossierBlocs.jsx)), and in checkout the codes, allergy request and the age / T&Cs boxes
as sheets (the last one opened by the pay button). In the app, the T&Cs link opens a sheet ([CgvEnFeuille](../../src/components/CgvEnFeuille.jsx)),
never a tab. The website keeps its pages unchanged, except the courier dossier: **since 2026-10-25 the website shows the same
dossier** ([Onboarding.jsx](../../src/pages/driver/Onboarding.jsx) only loads it and handles the Stripe returns; the site's six-step
dossier is gone). On a phone-width site it is the app's exactly (summary, then full-screen steps); from 1,100 px (`useSiteLarge`)
the summary stays on the left and the open step renders in the page on the right (site-livreur.css, `.ecl-dossier-cols`), and
DossierSuivi splits into two columns. The website courier sign-up is the express one too (Auth.jsx: account + name + phone).
A rejected dossier has a « Renvoyer mon dossier » button (the backend only auto-sends drafts). Fix a dossier screen once.
**App-wide rules (final phase, 2026-10-15)**: a folding [LigneCompte](../../src/components/LigneCompte.jsx) row opens its content
in a sheet in the app (every Mon compte section at once); any `target="_blank"` link is caught by `garderLesLiensDansLApp`
(natif.js) — a Fairide page opens in the app, another site in the in-app browser, maps/Waze/tel unchanged; `apiDownload` hands
files to the share sheet in the native app; « Imprimer » is hidden in the app; `html.appli` marks app mode for CSS (wide tables
scroll sideways). Orders put the delivery code under the progress bar and open the tip and « Signaler » in sheets (no reviews since
2026-10-22, conformite.md);
new promotions open in a sheet. Local backend on a Neon dev database: see `../fairide-backend/.env` (port 5173 for CORS).
**`npm run check:app` before every push** ([scripts/verifier-appli.mjs](../../scripts/verifier-appli.mjs)): opens every app page at
375×667 in app mode for four profiles against a mocked backend (real captured responses in `scripts/verifier-appli-donnees.json`)
and fails on any website chrome, a crashed page, or a full-screen screen that scrolls. Needs Chrome or Edge installed. A new
app page goes into its `PAGES`; a page crashing for lack of data gets a better mock, it is never removed from the list.
**The bottom tab bar is anchored to the bottom edge** (founder, 2026-10-21, decision 11: it floated above the bottom on an
Android phone): under 900 px `.dashboard-sidebar` is `bottom: 0` with `padding-bottom: max(6px, var(--bas-ecran))`,
on the website, the home-screen app and the native app alike, `--hauteur-onglets` 74 px. `--bas-ecran` is the system inset minus
12 px (founder, 2026-10-25: « a bit of dead space, bring it down a tiny bit »; 22 px instead of 34 on an iPhone), never below 0:
every bar resting on the tab bar or alone at the bottom (cart bar, « Accepter », checkout bar, toasts, map card) uses it too. The
cart bar does not fold when scrolling (a light fold was tried and removed the same day, founder: « better when it stays like
before »); it only follows the tabs down by the 14 px they lose. Never give the tab bar a fixed bottom offset again; `npm run check:barres` ([scripts/verifier-barres-bas.mjs](../../scripts/verifier-barres-bas.mjs)) checks it for the four spaces
at Android sizes, address bar collapse, visualViewport changes and a 48 px system inset. The onboarding copy makes **no claim the code does not back** — never « moins cher » (it depends on the
business), only the 10 % vs 22-32 % commission gap; and notifications are only promised where the server sends them.

**Push notifications (2026-10-11), what exists:** order-status pushes for all three roles come from a DB trigger
(backend migration 029 → `push_queue`, sent every 5 s by `pushFile.js`, fr/nl/en): client — accepted, declined, courier
found, on the way, delivered, ready for pickup, cancelled; business — order cancelled after receipt, courier waiting,
order still waiting for acceptance; courier — his job ready, cancelled before pickup, withdrawn by the client. Plus, sent
directly: new order to the business (payment), courier at the door to the client, and **new job to every courier who
would see it** (`notifLivreurs.js`, same eligibility as `GET /orders/available`, everyone at once, no rating read; a scheduled
delivery reaches couriers, and this push, only at its slot minus prep, travel and 20 min (= the 20-min no-courier cancel window, which so ends when the kitchen must start; Owen 2026-10-21): `ouvertureLivreurs.js`). Nobody
is notified of their own action (`oublierPush` in the routes). Toggles: `ReglageNotifications.jsx` (client in Mes
commandes, courier via `NotifCourses.jsx`), `NewOrderAlertBar` (business), and once after sign-up in the app
(`AmorceNotifications.jsx`). A new status worth a push goes in the trigger and in `pushFile.js` texts, not in a route.
**Sign in with Apple** exists for the iPhone app only (App Store rule 4.8): `POST /auth/apple` in the backend shares
one code path with `/auth/google` (`connexionFederee` in `routes/auth.js`) — fix a rule there, not in a copy.
