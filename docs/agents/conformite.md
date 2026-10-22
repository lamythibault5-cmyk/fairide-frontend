# Compliance (what the law makes the platform do)

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching checkout, signup, the dossier, the admin decisions or any legal text.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Compliance (backlog of 2026-09-23)

Legal requirements are enforced by the **backend** (see its README, « Conformité » section); the front end
shows them and collects what the law requires. All strings are in the `conformite` i18n namespace; the
components live in [src/components/conformite/](../../src/components/conformite/), shared helpers in
[src/conformite.js](../../src/conformite.js). What exists, verified:

- **Checkout** ([CheckoutConformite](../../src/components/conformite/CheckoutConformite.jsx)): allergy request
  (the business must confirm before preparing), age declaration when the cart holds alcohol, T&Cs
  acceptance when the account hasn't accepted the current version. The pay button reads « Commander et
  payer » on purpose (CDE VI.46 §2) — don't rename it.
- **Restaurant page**: seller block visible without a click ([FicheVendeur](../../src/components/conformite/FicheVendeur.jsx)),
  allergens and an 18+ badge on each dish, a « Signaler » link to [/signaler](../../src/pages/legal/ReportPage.jsx).
  [/classement](../../src/pages/legal/RankingPage.jsx) describes the ranking **as the code does it** — if you
  change the sort in RestaurantList.jsx, change that page's text in the same commit.
- **Stars need reviews.** `restaurants.rating` defaults to 4.5 in the database: never render
  `StarsDisplay` or sort by rating without `reviewCount > 0` — that would show a rating nobody gave.
- **Signup is checkboxes only** (founder, 2026-10-12). Business: one box at the end of signup signs the partnership
  contract, the professional declaration and the allergen procedure ([EngagementsInscription](../../src/components/commerce/EngagementsInscription.jsx),
  texts from `GET /restaurants/engagements` and `/restaurants/contract-terms`). Courier: one « Mes engagements » step in
  onboarding (`POST /couriers/me/engagements`) accepts the pre-ride notices, the self-billing mandate, the
  `declaration_honneur` (replaces every status and vehicle document) and the contract. **No drawn signature anywhere**
  (typed name + box = simple e-signature, eIDAS art. 25); a drawing sent anyway must be a valid PNG. Still required,
  because the law targets Fairide itself: courier ID check, non-EEA residence permit + professional card (CPS 175/1),
  biometric consent as its own box (GDPR art. 9), business number before publication, the menu's « C'est bon ».
  Signup shape (2026-10-13): no « confirm password »; the business gives its **company number at signup** (legal name and
  VAT derived; representative = the person signing up, one line), so « Configurer mes paiements » goes straight to Stripe;
  the services screen ends with one « offert pendant le lancement » note (no formulas box, no terminal). Courier screen 2
  is status + company number + vehicle only; bag and « another platform? » are in the profile's Infos step, the
  municipality comes from the address. The courier profile opens on a « Prochaine étape » card.
  **Since 2026-10-15 (UX audit)** courier signup is three screens (account, identity, address): the company number is
  optional there (missing item `bce`; since 2026-10-18 the dossier can be SENT without it and the team cannot APPROVE it
  without it: `MANQUES_APRES_ENVOI`), there is no ID / selfie step (the
  dossier's identity step does it), and no location prompt (PositionRequise asks above the job list). The selfie document
  is not required once Stripe Identity or an in-person check verified the face (`couriers.documentsRequis`). A non-EEA
  courier can *claim* the professional-card exemption (`self_employment_claimed_at`): it unblocks submission only; approval
  and rides still need the team's `self_employment_by_residence`, granted or withdrawn with a reason in Admin › Livreurs ›
  dossier › Documents (audit 2026-10-19, admin-08). The signup draft is kept 48 h in localStorage (declared
  in `cookies.technical`). **After approval the dossier is not frozen** (audit 2026-10-19, courier-4 to -7, -30): the
  approved page (Onboarding.jsx on the site, DossierSuivi.jsx in the app, blocks in dossierBlocs.jsx) lets the courier change
  zone, vehicle (+ licence and plate when motorised), « other platforms » (1 vs 3 jobs at a time), bag and minimum, upload a
  renewed residence permit / professional card (date first) and confirm school + year for the yearly student renewal —
  none of it re-opens the review; the team gets a task (vehicle changed, permit to check). A STATUS change sends the
  dossier back to draft when the new status needs something (siège, école, contract), else to the team; no offers until
  re-verified. The daily job also e-mails / pushes 30 and 7 days before a dated document expires
  (`couriers.rappelerEcheancesPieces`).
- **Merchant**: card signature, allergen attestation and professional declaration in
  [ConformiteCarte](../../src/components/conformite/ConformiteCarte.jsx) (menu page); allergens / VAT / alcohol
  per dish in the dish editor; allergy confirmation and ID check at the counter in the orders page.
  Everything left before going live is **one list with one next button**,
  [MiseEnLigne](../../src/components/commerce/MiseEnLigne.jsx) (2026-10-15): full on « Mon commerce », a « Prochaine étape » row
  on the other dashboard pages, read-only in « agir pour ». It replaced the status card, the CarteAValider banner and
  MenuReadiness's merchant list — add a new go-live step there, not in a new banner. Signing the menu now also confirms a
  menu handed over by the team (`carteSignee.signer` sets `menu_confirmed_at`; backend migration 037 repaired shops left hidden).
- **Courier**: notices to accept before the first ride, biometric consent before Stripe Identity (withdrawable from the
  identity step and Mon compte › Mes pièces: an open Stripe check is cancelled and the identity goes to an in-person check),
  nationality and residence permit (onboarding); ID check at the door (dashboard). The team records an identity check in
  Admin › Livreurs › dossier as « en personne » or « sur la pièce déposée », with the name as printed on the ID; a refusal
  needs a reason, sent to the courier (audit 2026-10-19, admin-42/43).
- **Admin**: suspending anyone goes through [DecisionDialog](../../src/components/admin/DecisionDialog.jsx)
  (facts + contractual basis) — the API refuses a bare `{ status: 'blocked' }`. New compliance tabs
  (decisions, DSA reports, breaches, processors, prohibited products, parameters) are in
  [pages/admin/compliance/](../../src/pages/admin/compliance/).
  « Résiliation » is recorded and announced as a termination; a case opened by a report or a check can be closed « aucune
  mesure ». Lifting goes through the decisions register only: « Réactiver » (Livreurs, Dossiers) and « Rétablir »
  (Décisions) call `decisionMotivee.retablir` with a reason sent to the person; a status change or an approval never lifts
  a suspension. People see their decisions and « Contester cette décision » in Mon compte
  ([MesDecisions](../../src/components/conformite/MesDecisions.jsx)); the team records an appeal received by e-mail in Décisions
  (audit 2026-10-19, admin-37 to 40). DSA reports open a task and e-mail the team; « contenu retiré » really hides the dish
  or deletes the review and sends the statement of reasons to whoever published it (admin-41).
- **Filings** (admin › Conformité › *Déclarations*, [DeclarationsTab](../../src/pages/admin/compliance/DeclarationsTab.jsx)):
  DAC7 for both couriers and businesses, CSV exports, the yearly copy sent to each seller, and the art. 17
  platform-work register. Sellers download their own DAC7 copy ([CopieDac7](../../src/components/conformite/CopieDac7.jsx))
  from the courier documents card and the restaurant invoices › statements tab.
- **Privacy policy text** is versioned like the T&Cs: changing `privacy.*` (or the `SECTIONS` order in
  Privacy.jsx) changes its hash — register a new version in the backend's `cgu.js`
  (`VERSIONS_CONFIDENTIALITE`), or its test fails.
- **T&Cs text**: changing `terms.*` in the i18n files changes the text clients accept. The backend tests hash the
  front at `../fairide-frontend` — from a worktree that is the main checkout, not yours: check with
  `node scripts/empreinte-cgu.js <your front path>`. Bump the date in
  `terms.draftWarning` and register the new version and hash in the backend (`scripts/empreinte-cgu.js`,
  `cgu.js`) — the backend test fails until you do.
