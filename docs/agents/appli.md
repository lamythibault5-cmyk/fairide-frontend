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
(`RouteSuivi`, orderStatus.jsx; past orders keep the compact card) — 1C; in the app the cart is a full-width glass bar with the
total in an iris chip whose digits roll (FloatingCart, `ChiffresRoulants`) — 2C; a dish's « + » opens into « − n + » with the
number in a lime circle and folds back to a circle that keeps the count (`PasPlat`, MenuCategorySections), and the dish sheet's
quantity and « Ajouter » are one lime block — 3C; full-page empty screens (orders, favourites, cart) show the bike waiting on its
road (`EtatVide scene=…`) — 4B. Buttons inside these need `min-height` overrides: the global 44 px touch rule has specificity (0,3,1).
**Every main screen in that style (2026-10-16, « Proposition » phones of `maquettes/tous-les-ecrans/tous-les-ecrans.html`)**:
restaurant list (address on an iris band with the riding bike, glass strip of cuisine families with a draggable lens and, under the chosen
family, a row of its specialities: TeteListe.jsx, lentillePuces.js), map, favourites, restaurant page (sheet over the cover, glass sections strip, floating round buttons in solid iris
with a white ring — white-on-glass was unreadable), cart / checkout / order confirmed (EcranCommande.jsx), Mon compte (EnteteCompte.jsx),
business dashboard / orders / menu / stats (BandeauCommerce.jsx, CarteCommerce.jsx), courier dashboard / job in progress / earnings
(RouteVelo.jsx). **Each family's CSS lives in its own file imported by its pages**: `src/ecran-liste.css`, `ecran-fiche.css`,
`ecran-commande.css`, `ecran-compte.css`, `ecran-commerce.css`, `ecran-livreur.css` — look there before styles.css. Glass, blur and soft
shadows are scoped to `html.appli`; the website keeps iris bands and white sheets without glass.
**The app glass of 2026-10-23** (answers to `maquettes/verre-boutons/verre-boutons.html`) is in ONE file, [src/verre.css](../../src/verre.css): an iris glass band under the iPhone status bar once the page scrolls ([verreBarreEtat.js](../../src/verreBarreEtat.js), it waits for a restaurant photo to leave), milky « clear » glass with an iris rim for the restaurant round buttons, puces, Livraison / À emporter and map controls, vivid iris (nearly solid, with the glass shine, white rim and iridescent edges, no blur: it would not show) for every « + », the cart « − 1 + » and the Livraison / À emporter thumb — 72 % iris glass looked washed out on white (founder, 2026-10-23). Toasts keep the 72 % iris glass.
**TestFlight feedback of 2026-10-24**: (the three lenses already glide the same way since PR #220, 2026-10-23.) The map has no
+ / − in the app (`zoomControl: !experienceApp()`, RestaurantsMap.jsx: pinch and double tap zoom; at 84 px from the bottom they sat under the
tab bar). The cuisine strip on the list is SOLID WHITE with a hairline in the app too (founder, same day: « reste avec le blanc,
mais enlève cette sorte de blur »): its glass (22 % white, blur, white glow on top, big soft shadow under) blurred its outline; only its
lens stays glass. The white sheet lip under the band stays white when scrolling (a fade to iris was tried and refused). `html` has `text-size-adjust: 100%`: iOS enlarged a long section
name (Hill's) to fill the screen; section pills cut at 220 px with « … » (`.quicknav-libelle`).
**Gestures (2026-10-23)**: dragging a restaurant photo down closes the page ([FermerFicheParGlissement.jsx](../../src/components/FermerFicheParGlissement.jsx), listeners on `.fiche-media` only; past 150 px it clicks the cross, so the photo flies back into its card). **No swipe back** (founder, 2026-10-23: removed, edge and « from anywhere » alike — on the list the page slid sideways over an empty background): go back with the back / close buttons; Android keeps its system gesture. **iOS's own back swipe from the left edge stays** (founder, 2026-10-23: « I really like the swipe »; answer 6 of `maquettes/transitions-appli`): WebKit's gesture (`allowsBackForwardNavigationGestures`, FairideViewController.swift) shows the previous screen under the finger, and does nothing where there is no screen behind — unlike the removed JavaScript one. Dragging from the white sheet under the photo was tried and removed the same day. The pull-to-refresh iris zone is portalled into `<body>` (fixed inside the moving `<main>` it slid down and showed white). Pull to refresh decides the direction on the first 10 px (sideways = a row like « À la une » scrolling) and keeps its blocking touchmove only while the page is at the very top.
**Glass that answers the finger (2026-10-24, version B of `maquettes/verre-appui/verre-appui.html`, « iOS 26 »)**, native app only, in
[verreAppui.js](../../src/verreAppui.js) (loaded by `demarrerNatif`) + the end of verre.css: every glass control (its list is `VERRE` in that
file: the WHOLE tab bar, cuisine and sections strips, cart bar, restaurant round buttons, Livraison / À emporter, « + », « − 1 + », map
chips, back buttons) grows the moment the finger lands (8 % small, 3.5 % bars, by size), leans 2–3 px toward it, a light
(`<verre-lueur>`, injected once) follows the finger and the rim lights up; release = spring (damping .55, response .4 s). `scale` /
`translate` inline, so a control's own `transform` is kept. Strips that scroll sideways wait 70 ms (a scroll that starts cancels).
Cards and rows keep the .97 press-down (glass grows, content presses down). Back buttons are glass: ‹ rounds on iris bands
(`.ec-rond`, `.gn-rond`, `.bv-rond`), « ← Retour » / « ← Mon compte » as 44 px clear-glass pills. The website is unchanged.
**Screen transitions (2026-10-23, Owen's answers to `maquettes/transitions-appli/transitions-appli.html`, native app only, iPhone and Android)**, in [transitionPhoto.js](../../src/transitionPhoto.js) + [transitions-appli.css](../../src/transitions-appli.css):
a forward navigation slides the new screen in from the right (350 ms, the old one moves −30 % and darkens), back is the reverse. It goes
through the router history (`envelopperNavigations` in i18n/historiqueLangue.js: `push` and `go(-1)` / `back()`); only a navigation
that follows a real tap (< 400 ms) or a gesture (`back({ geste: true })`: Android Back, the cross) slides — redirects, same-screen
changes, `state.fond` sheets and tabs (`replace`) don't. A card leading to a restaurant page (list, Recherche, Favoris, Carte) gives
it its photo instead of sliding; a dish gives its photo to its sheet (`ouvrirAvecPhoto`). The cross of a restaurant page and the ‹ of
the order screens go BACK when the previous history entry is that screen (`cheminPrecedent`), so the list comes back at its scroll
position. Tabs (DashboardSidebar `ongletAppli`): `replace` + `state.restaurerDefilement` (each tab keeps its place; Recherche and Mes commandes open at the top instead, founder 2026-10-24, `ONGLETS_EN_HAUT`), re-tapping the
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
opposite-direction « no news » box) and an Activer / Couper row in Mon compte (`RapportsPanne`, Account.jsx). Someone who turned them
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
engagements », then [FinExpress](../../src/pages/driver/DossierAppli.jsx) when the backend sends / approves it, see conformite.md; rules shared with Onboarding.jsx in
[dossierCommun.js](../../src/pages/driver/dossierCommun.js)); once sent, validated or suspended the app shows
[DossierSuivi](../../src/pages/driver/DossierSuivi.jsx) instead of the website page (2026-10-19, second design audit: band « Dossier
envoyé » / « C'est bon, tu peux rouler », one lime « Voir les courses », counters as white tiles, rows opening sheets; the blocks
both versions share live in [dossierBlocs.jsx](../../src/pages/driver/dossierBlocs.jsx)), and in checkout the codes, allergy request and the age / T&Cs boxes
as sheets (the last one opened by the pay button). In the app, the T&Cs link opens a sheet ([CgvEnFeuille](../../src/components/CgvEnFeuille.jsx)),
never a tab. The website keeps its pages unchanged.
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
Android phone): under 900 px `.dashboard-sidebar` is `bottom: 0` with `padding-bottom: max(6px, env(safe-area-inset-bottom))`,
on the website, the home-screen app and the native app alike, `--hauteur-onglets` 74 px. Never give it a fixed bottom offset
again; `npm run check:barres` ([scripts/verifier-barres-bas.mjs](../../scripts/verifier-barres-bas.mjs)) checks it for the four spaces
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
