# Decisions already made, so nobody undoes them

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before « fixing » something that looks odd in orders, e-mails, couriers, accounting or alcohol.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Corrections of 8 October 2026

(The source note `docs/fairide-a-coder-2026-10-08.md` was never committed; this list and the tests are what remains.)

Each one has a test in `../fairide-backend/tests/correctifs-08-10.test.js`. What changed, so nobody undoes it:

- **The business is the only seller** (DEC-25/26). Fairide collects on its behalf and issues the customer **receipt**
  (`recuClient.js`, `GET /orders/:id/receipt`, three seller blocks); Stripe no longer creates invoices for customers. A
  company that needs an invoice asks the business.
- **Menus are proposed, then validated** by the business (« C'est bon », `/carte/valider/:token`, single-use hashed link);
  publishing refuses an unvalidated menu. Every price or VAT change is logged with who asked (`menu_item_history`).
- **VAT per dish belongs to the business**: proposed from the dish's nature (`tvaPlats.js`, no hard-coded 6 %), editable by
  the business despite `MENU_LOCKED`; a rate change for everyone gives 7 days to refuse (Admin › Commerces).
- **Alcohol is closed** until `ALCOHOL_ENABLED=true` on the server. Insurance, the AFSCA document and the alcohol licence are
  **alerts**, no longer blockers (business number, AFSCA number, contract, validated menu, allergens still block).
  Since 2026-10-10 the business no longer has to give its AFSCA number if it signs the professional declaration
  (now **`PRO-2026.3`**, 2026-10-11: adds the DSA art. 30(e) self-certification that it only sells law-compliant
  products; `declarationsCommerce.js`). **Signed with one checkbox at signup** (2026-10-12,
  [EngagementsInscription](../../src/components/commerce/EngagementsInscription.jsx) → `business.engagements` →
  `signerEngagementsInscription`), together with the allergen procedure; no AFSCA number or document is asked. The
  team's AFSCA check (Admin › Commerces › Conformité, [VerificationAfsca](../../src/components/admin/VerificationAfsca.jsx):
  four points on the establishment unit + screenshot) is an **optional spot check** — alerts only, never blocks
  publication, except a « Introuvable » result (no override; it also blocks auto-publication and new orders, and takes an
  online business off the site with an e-mail). Procedure: `../fairide-backend/docs/verification-afsca.md`.
- **Dedicated couriers need their consent** (audit 2026-10-19, shop-301): Mon commerce › Livraison sends an invitation; the
  courier accepts or declines it on his dashboard ([LivreurDedie](../../src/components/livreur/LivreurDedie.jsx), backend
  `livreurDedie.js`) and can leave at any time. Nothing changes for him, and the business sees no name or phone, until he accepts.
- **Pickup without a restaurant click** (2026-10-10): the restaurant sees the pickup code and compares it by eye; the
  **courier** confirms (`PATCH /orders/:id/picked-up`, accepted from `preparation` too). `/confirm-pickup` still exists.
  « Ma carte et mes engagements » ([ConformiteCarte](../../src/components/conformite/ConformiteCarte.jsx)) is one checkbox,
  one name, one button that posts each pending signature to its own route — each keeps its own version and hash.
- **Client absent at the door** (2026-10-10): the courier taps « Je suis à la porte », the client gets an e-mail, a push
  and a banner ([LivreurALaPorte](../../src/components/client/LivreurALaPorte.jsx)); closing needs **10 min and 2 calls** made
  through « Appeler le client » (`PATCH /orders/:id/call-client`, counted). Outcome: client not refunded (T&Cs, article
  Annulation: « reste due »), business keeps its share, courier paid and keeps the food, no admin task.
  `ATTENTE_PORTE_MIN` / `APPELS_CLIENT_MIN` in [src/conformite.js](../../src/conformite.js) mirror the backend constants.
- **E-mails** go through one branded wrapper (`../fairide-backend/emailEnveloppe.js`); team e-mails carry a subject tag
  (`[Commerces]`, `[Cartes]`, `[Livreurs]`, `[Messages]`, `[Comptes]`, `[Compta]`, `[Équipe]`) for Outlook rules.
  Preview them all with `node scripts/apercu-emails.js` in the backend. **No em dash in any e-mail** (founder, 2026-10-13):
  texts were rewritten, and `envoyer()` runs `sansTiretsCadratins` on subject and body as a safety net; subjects end « | Fairide ».
- **Couriers**: two statuses only (P2P removed); they set their minimum per ride and per km and only see offers above it
  (the customer's delivery fee rises to the cheapest courier's minimum, capped); **no delivery rating**; suspension only for
  fraud, serious misconduct or legal obligation; random check selfie at shift start, only when the courier is really available (not paused, Stripe active, after GO), with 60 min to take it while jobs keep coming (`DELAI_SELFIE_MIN`, Owen 2026-10-21; `controleSelfie.js`); grid of the 8
  criteria of art. 337/3 in Admin › Conformité. Never add a rating, ranking or penalty — that is criterion 6°/7°.
- **Accounting**: monthly export (`comptaMensuelle.js`) separates Fairide sales from third-party funds and is emailed once to
  the archive address; subscription invoices are Fairide's own (`FAIRIDE-ABO-…`) and go through Peppol. The courier price
  increase Fairide pays (`order_delivery_bonus`) is a COST on `613-HAUSSE` (PCMN 613100), never on revenue 701 (founder,
  2026-10-21; backend migration 081 moved older entries): the VAT-franchise counter and the export's sales column ignore it,
  the export has its own « Hausses de course » column.
- **Admin cancel of a paid order** (founder, 2026-10-21): the team picks a reason in the cancel window
  ([ChoixRemboursement](../../src/components/admin/ChoixRemboursement.jsx); codes in `remboursementAnnulation.js`, same table as
  `../fairide-backend/motifsAnnulation.js`). Shop-side reasons (closed, dish unavailable, not prepared, shop asked) propose the
  shop as bearer, every other reason Fairide; the team can change it. The code is stored with the refund
  (`order_refunds.reason_code`); the server refuses a refunding cancel without one (`CANCEL_REASON_REQUIRED`).
- **No customer reviews** (founder, 2026-10-22): reviews, stars and ratings were removed from the whole front and the
  backend — too few users yet, and a shop with few stars would look bad; they may come back later. The tip after delivery
  stays (« Laisser un pourboire », Orders.jsx). Don't « restore » a star, a rating sort or a reviews page in passing: what
  was removed and the rule if they return are in conformite.md.

## End-to-end test plan fixes (2026-10-02)

The browser run of [docs/fairide-tests-e2e-standalone.html](../../docs/fairide-tests-e2e-standalone.html) led to these, all
covered by `../fairide-backend/tests/correctifs-e2e.test.js`:

- **Times always in Brussels time**: [src/fuseauBruxelles.js](../../src/fuseauBruxelles.js), imported first in `main.jsx`,
  defaults every `toLocale*String` to Europe/Brussels. Amounts go through `euros()` ([src/prixPlat.js](../../src/prixPlat.js)),
  never `` `${x.toFixed(2)}€` ``.
- **Cart = idempotency key**: the cart carries `requestId` (sent as `clientRequestId`); the same cart in two tabs gives
  one order, the second gets `ORDER_ALREADY_PLACED`. Explicit logout empties the cart; an expired session keeps it.
- **Alcohol** is detected by dish name, and a section only counts when it is alcohol-only (« Bières & boissons » no
  longer makes Coca 18+; migration 011 fixed existing rows). « Déposer devant la porte » is refused with alcohol.
- **Simulation orders** never enter admin money figures (`sqlCommandeReelle` in every finance/KPI query).
- **New features**: client data export and « log out everywhere » ([MesDonnees](../../src/components/MesDonnees.jsx)), order
  again ([src/recommander.js](../../src/recommander.js)), report a problem ([SignalerProbleme](../../src/components/client/SignalerProbleme.jsx)
  → support ticket), notification bell ([ClocheNotifications](../../src/components/client/ClocheNotifications.jsx), fed by a DB
  trigger), promo code at checkout; business pause 15/30/60 min ([InterrupteurService](../../src/components/commerce/InterrupteurService.jsx)),
  extra prep time on accept, minimum order, per-dish client note (printed on the ticket); courier incidents
  ([IncidentsCourse](../../src/components/livreur/IncidentsCourse.jsx): hand back a job, waiting at the business, client absent)
  and the client's « no courier after 20 min → cancel, refunded » ([SansLivreur](../../src/components/client/SansLivreur.jsx)).
- Commitments signed in « Ma carte » show an EN/NL translation; **the French text stays the one that is hashed and signed**.

## Resolved since earlier versions of this file

Listed so nobody re-implements them: **Web Push exists** ([public/sw.js](../../public/sw.js) handles `push`
and `notificationclick`, with [src/push.js](../../src/push.js) and
[usePushNotifications.js](../../src/hooks/usePushNotifications.js); VAPID keys live in the backend env).
**The PWA is complete** — `manifest.json` ships PNG icons at 192, 512 and maskable-512. The service
worker **caches nothing, on purpose**; read its header before adding a cache.
