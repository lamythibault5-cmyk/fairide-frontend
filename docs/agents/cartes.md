# Menus: import and in-store prices

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before importing, re-pricing or changing how a menu is shown (also: the `fairide-menu` skill).
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Menu import (lives in the backend repo)

Restaurant cards are not typed in by hand. They are imported from a saved platform page by
`../fairide-backend/scripts/importer-carte.js`, which writes straight to the database — no HTTP, no
token to forge. Read its header before using or changing it; it documents how to capture a page and
why each option exists.

What the front end has to know:

- **Section order comes from `restaurant_sections.sort_order`**, not from `menu_items`. The importer
  gets it right by sorting dishes into the platform's own display order before writing, because
  `bulkReplaceMenuItems` creates the sections in the order the items arrive.
- **Uber Eats pages carry their menu in the HTML. Deliveroo pages do not** — Deliveroo renders it
  client-side, so a Ctrl+U capture is an empty shell and the importer reads a DOM capture instead.
- Companion scripts, same directory: `prix.js` (bulk price edit, by factor or by Excel CSV),
  `sauvegarde-carte.js` (snapshot before any `--remplacer`), `apercu-carte.js` (renders a card to a
  standalone HTML page for review, without publishing anything).
- **Importing a ready `<shop>-menu.json` into production**: follow « Chemin rapide » in
  `../fairide-backend/docs/importer-une-carte.md` — commands, which option for which kind of file, and the traps.
  `scripts/tunnel-railway.js` opens the database tunnel (`ssh -L` does not work on Railway) and exports the production
  credentials; `scripts/preparer-carte.js --sans-generiques` strips stock photos. **Never multiply prices at import**
  (neither × 1.121 nor × 1.10): shop prices go in as they are with `--prix-magasin`, and the business itself chooses to add
  the commission. Run the scripts from `origin/main` — an older branch has an importer without `--prix-magasin`.
- **Which businesses are real**: `restaurants.is_demo = false`. Of those, the ones with `in_store_prices_checked_at` are the
  only cards whose prices have been checked (5 on 2026-10-15: Hill's Burger, L'arbre à pain, Snack Turko, Pitaki, DIJII SHOP).

An imported card is written but **not online**: the business stays `pending` until someone clicks
Approve and Publish in the admin console. Don't describe an import as "live".

**In-store prices (2026-10-13).** `restaurants.in_store_prices_checked_at` marks a card whose prices were read in the shop
(printed menu, chalkboard), not on a platform — set by `importer-carte.js --prix-magasin` or the admin drawer toggle
(`PATCH /admin/restaurants/:id/in-store-prices`); the admin list shows « Prix magasin ✓ » / « Prix à vérifier ». Only a
marked card offers the business, on the « C'est bon » page ([ValiderCarte.jsx](../../src/pages/ValiderCarte.jsx)), one choice:
keep its prices, or raise the whole card by the maximum increase (+11.1 %, `hausseMaxPourcent`), rounded **down** to €0.10
(since 2026-10-14 — rounding up broke the cap: €10.00 → €11.20 is +12 %), paid
add-ons too. Choice, prices and signature go in one transaction, once (`fairide_rate_choice`). Structured `*-menu.json`
imports no longer get name-guessed option groups (`optionsExact`): the file's choices, including « none », are final. A
choice inside a choice (Habebe's « Formule + soft » → Spa/Pales) is flattened into the parent list (`aplatirChoix`): the
model has one level of options. The admin list's menu pill comes from the menu itself, not the « Fairide s'en occupe »
request: 0 dishes → « Carte à importer » (filter of the same name, counted server-side), otherwise the price state.
The importer closes an open request and its task, without e-mailing the business.

**Carte seule (2026-10-25, Owen).** A shop can be shown before its contract and its « C'est bon »: Admin › Restaurants ›
drawer › « Montrer en carte seule » (`PATCH /admin/restaurants/:id/vitrine`, backend `routes/validationCarte.js`), then the
usual « Approuver » with its compliance checks; once approved it goes online by itself with **no** « tu es en ligne » e-mail.
For the public (list, shop page, search, favourites, pre-render), backend `routes/restaurants.js › pourLePublic`: a shop
without a valid contract or never signed has delivery and takeaway closed (« Carte seule » label, the page says ordering is
not open); a shop never signed **and** without in-store-checked prices (`prixMasques`) gets every dish and add-on price as
`null`, no promos, and the page adds « Les prix arrivent bientôt ». The owner and the team still see all prices. Front:
a `null` price is never written (no « 0,00 € », no JSON-LD offer). Never show platform prices to customers.
