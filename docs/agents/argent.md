# Money: pricing, commission, fees, no subscription, three sellers

Moved out of `CLAUDE.md` on 2026-10-22, word for word, so the guide every session loads stays short. Read it before touching a price, a fee, a share, a promo code, invoicing or dispatch.
The always-on rules are still in `CLAUDE.md` › « Rules that are never broken ». If you change what this file
describes, change this file in the same commit: a stale guide gets believed.

## Pricing model (2026-09-23 evening; Fairide a VAT franchisé since 2026-10-12)

**Fairide SRL is under the Belgian small-business VAT franchise** (art. 56bis CTVA — SPF Finances letter of 2026-10-12,
effective 2026-09-07): it charges **no VAT** on anything it sells (commission, system fee, placements), files
no periodic VAT return and deducts nothing. Switch: `FAIRIDE_VAT_REGIME` on the backend (`franchise` by default, `assujetti`
to leave it), read by `fairideCompanyInfo.js`; `getPricing()` then returns `vatRateCommission` / `vatRateServiceFee` = 0 and
keeps the saved rates under `*Assujetti`. The franchise ends **with the transaction that takes Fairide's yearly turnover over
€25,000 excl. VAT** — Admin › Comptabilité › Obligations shows the counter (`seuilFranchise.js`, prorated in 2026).
Invoices carry « Régime particulier de franchise des petites entreprises » and Peppol category `E`; the business's dish VAT
and the courier's delivery VAT are **not** affected.

**Model of 2026-10-13 (founder), replacing « in-store price + 10 % »:** menus show **the business's own prices** by default.
On an order paid online Fairide keeps **10% of the price paid** (`commissionFairide(subtotal, pricing)` = subtotal × r, plus
Fairide's VAT if it ever becomes VAT-registered; `commission_vat` = 0 under the franchise): a €10 burger gives €1.00 to Fairide,
€9.00 to the business. The business may raise its prices (`restaurants.price_markup_percent`, applied by the business itself from the
« Tes prix sur Fairride » bar; only a business that has already served customers with the « Prix du comptoir » badge
requests it and the team applies, founder 2026-11-02, `prixMagasin.hausseAValider`) **up to `hausseMaxPourcent` = r / (1 − r) = 11.11 %**,
**prices rounded UP to €0.10** (founder, 2026-11-02: « 11,11 % et arrondi au dixième supérieur »): €10 → €11.20 → €10.08 for
it, so the shop always gets at least its counter price (checked cent by cent to €300, `tests/hausse-prix.test.js`). It was a
round 10 % rounded down from 10-16 to 11-02 (€10 → €11.00 → €9.90: 99 %, while contract 2026.21 said « l'équivalent de son
prix de salle »), and 11.1 % from 10-13 to 10-16. Never more. Contract RESTO-2026.22 writes it; a shop still on 2026.21 keeps
10 % until it accepts 2026.22 (`prixMagasin.hausseMaxPour`, its 2026.21 acceptance stays valid: `ACCEPTATIONS_GARDEES`).
**Wording (founder, 2026-11-02: « truthful, same impact »)**: rounding up can push a cheap item past 11.11 % (€0.50 → €0.60),
so shops read « 11,11 % au plus, arrondis aux 10 cents supérieurs : tu reçois ton prix entier »; customers get no percentage
(founder, same day, maquettes/prix-client): no figure on the website, e-mails and badge screen, and in the app onboarding the
measured dish in euros (« +8,25 € ailleurs, +1,70 € au plus »), see voix.md.
A shop at 10 % moves to 11.11 % when it accepts RESTO-2026.22 (`hausseAuNouveauPlafond`, routes/restaurants.js), its menu
re-signed in its name; the shop home shows a one-button card for the new version (`RenouvellementContrat.jsx`). One function applies it everywhere (`appliquerHausse` in
`../fairide-backend/prixMagasin.js`): own price kept in `price_base`/`delta_base`, paid add-ons follow, rounded UP to €0.10 (`prixMagasin.prixAvecHausse`; the team's « adjust all prices » tool, a gesture on prices already shown, still rounds down, audit admin-31).
The « C'est bon » page offers the max increase in one tap, only on cards with checked in-store prices.
**Offers (founder, 2026-10-26, every shop since 2026-11-02):** the price after a
« −X % » or « −X € » offer (Avantage Fairride included) is rounded DOWN to €0.10 (€11.10 − 15 % = €9.435 → €9.40); the
discount is the difference. Down, never up: the discount given is never less than the one shown (rounding up gave €9.50,
only −14.4 % under a « −15 % » label: a misleading price-reduction announcement, Owen refused that risk). Since 2026-11-02 (backend PR #136 folded into the 11.11 % change) this holds in every shop, raised or not; counter prices without an offer keep their cents;
« 1 + 1 » and « X € dès Y € » are not affected. Server `prixMagasin.prixOffreArrondi` (order) and site `prixPlat.js`
(`activePromo.roundTenths`, set by `routes/restaurants.js`). The Stripe split does not change: 10 % of the price paid.
The customer additionally pays the **delivery fee only — nothing is added on top** (model of 2026-10-08 evening):
€5 excl. VAT for the first km, then €0.80 excl. VAT per started km, 21% VAT added (€6.05 incl. VAT minimum). **10% of it
is Fairide's system fee, included** (`fraisService`, stored as `service_fee` + `service_fee_vat`); the courier receives
**90% of the fee the customer paid**, whatever the vehicle (founder, 2026-10-14: `tauxKmLivreur` in `pricing.js` returns the
customer's per-km rate; the old bike €0.60 / motorised €0.80 grid, with the bike difference kept by Fairide, is gone). A courier's
minimum (CODE-13) applies to their share: the client fee is raised to minimum / 0.9 when no courier accepts the grid
(`routes/orders.js`, `troisVendeurs.prixAvecMinimum`). Takeaway paid on site: no commission, no fee.
**A shop that delivers with its own employees (founder, 2026-11-02, `../fairide-backend/livraisonCommerce.js`)** sells the
delivery itself: the customer pays the shop's fixed fee (`own_delivery_fee`, 0 to 20 €, no « dès »), Fairride keeps **10 % of
it, the same commission as on food, counted in `orders.commission`** (so on the monthly commission invoice, whose line amount
then includes the delivery), and the rest goes to the shop with its food in the same Stripe transfer. No system fee
(`service_fee` 0), no courier payout, no tip. The shop transfer, `RESTAURANT_DUE_SQL`, `virementsCommerce.PART_SQL`,
`accountingService` (440, nothing to 441), `chiffresArgent`, DAC7 (the delivery is part of the shop's consideration) and the
receipt (« Livraison vendue par <commerce> ») all read `orders.delivery_by = 'restaurant'`. Example: 25,50 € of food + 3 €
delivery → Fairride 2,85 €, the shop 25,65 €. « Renfort Fairride » orders are ordinary Fairride deliveries (grid price, 90/10).
**Tips go 100% to the courier** (`tipFairideRate` 0 — founder, 2026-10-13: « tips go 100 percent to driver »; this
reverses the 90/10 rule of 2026-10-09. Backend migration 026 had put 10% in the database, migration 032 resets it to 0).
The courier and restaurant contracts, the T&Cs and the courier texts promise it. **Since 2026-10-21 it is a fixed rule, not a
setting** (founder): `REGLES_FIXES` in `../fairide-backend/pricing.js` forces `tipFairideRate` 0 and `deliveryFairideRate` 0.10 (the
courier's 90 %) whatever `platform_settings` says, Admin › Paramètres no longer shows either field, and `PATCH /admin/settings`
refuses another value (`FIXED_RULE`).

**The tip is given at arrival, in one tap, never at checkout** (founder, 2026-11-06, `maquettes/pourboire`: all the
recommendations, no tip on the payment page). The checkout card is kept by Stripe (`setup_future_usage: 'on_session'` on the
card only, never Bancontact: it would become a SEPA mandate the founder refused; if Stripe ever refuses the setting the
order page opens without it). At arrival a sheet (`components/client/Pourboire.jsx`, opened by the push « Karim t'a livré »
→ `/orders?pourboire=<id>`, or once when a delivered order shows up) and a row on the order card offer 1 / 2 / 5 € (3 € until 2026-11-08) or
« Autre », **minimum 1 €**, **7 days** after delivery; « Donner 2 € » calls `POST /api/payments/tip/:id`, which charges
the saved card (backend `pourboireApres.js`); Bancontact, an order from before, a removed card or a bank confirmation
open today's Stripe page with the amount filled in. Whatever the path, `pourboireApres.enregistrerPaye` records it,
pays the courier the whole tip through `courierPay.payerPourboire`, books Stripe's fee as Fairride's cost
(`stripe_fee_tip`, shown in Rentabilité), and pushes « Pourboire reçu » to the courier (no customer name). Fairride
absorbs the fee (~€0.28 by card, €0.35 by Bancontact on a €2 tip). The backend still accepts a tip sent with the checkout
for apps not yet updated (`pourboireCommande.js`). Courier monthly statements wait until the 8th so late tips are in them.
**Delivery distance: 6 km by default**, or what the business sets (1–15 km since 2026-10-21, founder: 30 km was ~1 h 50 by bike and
~28 € of delivery fee; 15 km covers the whole Brussels region) in « Commandes et capacité » (`../fairide-backend/rayonLivraison.js`;
NULL used to mean « no limit » and accepted Antwerp). Backend migration 080 clamped settings above 15 km (one `admin_actions` row
each). The business contract `RESTO-2026.20` still prints « de 1 à 30 km » (`RAYON_MAX_KM_CONTRAT`) until its next version.
**Order promo codes** (`order_percent`, `order_amount`, `order_free_delivery`, `../fairide-backend/codesPromo.js`) are
paid by Fairide like the balance: they lower `orders.total`, never the business's or the courier's share; online
payment only.
**Welcome credit for everyone, and the « code ami » (founder, 2026-11-08, `maquettes/bienvenue-partage`; before: the code
ami of 2026-11-03).** **Every customer** gets **« 5 € de crédit offerts »** (never written « −5 € »: a gift, not a discount)
on their **first order paid online with €20 of food or more** (subtotal, delivery not counted), applied by the order route by
itself (no typing), through the reserved promo row `CODE-AMI` of type `order_referral` (backend migrations 107 and 123,
`referrals.CODE_AMI`; typed at checkout it « doesn't exist »; the team turns it off in Admin › Promotions). **Once per
person**: one account AND one number proven **by SMS** (`phone_verified_via = 'sms'`, G38); the use keeps a sha256 of the
number (`promo_code_uses.phone_hash`), so a second account on the same number gets nothing, even after the first changed
number or was deleted. « First order »: `first_order_only`, a takeaway paid at the shop (before GO) doesn't count; a
cancelled order frees it **only when the customer's money went back or was never taken** (Owen, 2026-11-13, F10): « aucun
livreur », a team cancel, a refusal, an expired or unpaid order free the credit and single-use codes again; a paid order
closed without a refund (`client_absent`, `pickup_not_collected` including the 12-hour auto-close, `age_check =
'refused_absent'`) uses them up like a handed-over one, until the team refunds it in full (same « fully refunded » as the
commission, `commissionRemboursee.sqlIntegralementRemboursee`; a partial refund keeps them used): money kept = used, refunded
= freed (`codesPromo.SQL_USAGES` / `SQL_COMMANDE_PRECEDENTE`, backend test `revue-1113-credit-bienvenue`). A typed code wins (one code per order) and the credit waits. The quote's `codeAmi` says why it
doesn't apply yet (`minimum`, `sur_place`, `numero_sms`) so the cart can explain it; already received, second order, number
already used: **nothing is said**, the cart is normal (founder). **A number no SMS can reach** (country outside the SMS list,
Belgian landline: `referrals.numeroSansSms`) can never prove itself by SMS, so it is never promised the credit (Owen,
2026-11-14, G2-9): no welcome sheet, no `codeAmi` in the quote, so no pill, no lower button total, nothing on « Dernière
étape » or in the cart; no new sentence either. `GET /auth/me › bienvenue` ({ montant, minimum } or null)
says whether the welcome sheet should show. **Google / Apple accounts** may order without proving their number (their e-mail
is proven), but without the credit (« Commander sans le crédit »). The **sharer** of a code ami gets **€3 on the balance per
friend, no cap** (`referrals.CLIENT_REFERRAL_REWARD`; a friend who signed up before the switch, `platform_parameters.
code_ami_3e_depuis`, keeps the €5 promised), when that friend's first qualifying order is handed over, **only if it was paid
online** and the friend's number is proven by SMS (`maybeAwardClientReferralReward`); the friend gets nothing more than the
welcome everyone gets. The sharer **keeps the €3 even if the friend's order is refunded after handover** (Owen, 2026-11-13:
the handover is what earns it; abuse is handled by the team as fraud, never by taking it back automatically). Wherever the credit is written (checkout, pending-order recap, printable receipt, customer PDF receipt, order e-mail) it reads
« Crédit de bienvenue » and « 5,00 € offerts », never « −5 € » nor the technical `CODE-AMI` (Owen, 2026-11-14, G2-16). Before GO nothing can be paid online: the welcome sheet and the code ami reminder wait for GO
(`paiementEnLigneOuvert`, CodeAmi.jsx). Shop and courier referrals are unchanged (€5).
**No subscription (founder, 2026-11-04: « on retire les 20 € par mois ; ça bloque les inscriptions »).** A shop pays
nothing each month: Fairride earns only the 10 % commission on orders paid online and the system fee inside the delivery fee.
Gone with it: the €20/month plan and its first free month, the « petit mois » guarantee (€50), the « offert pendant le
lancement » waiver and the team's « Facturer l'abonnement » button, the 14-day grace period, the Stripe checkout, portal,
pause and cancel, the subscription invoices (`FAIRIDE-ABO`, account 703-ABO kept for the ledger's history) and the
shop free-months promo type (`restaurant_trial_months`, old codes kept for history). Contract `RESTO-2026.24` drops the
« Abonnement » clause; the customer T&Cs drop the « 20 € par mois » sentence (new CGU version of 2026-11-04). Before that
date no real shop ever had billing on, a Stripe subscription or a subscription invoice. For apps already installed the
shop record still says `subscriptionWaived: true` / `subscriptionRequired: false` (and the contract summary
`subscription: 0`); the current front never reads them. Paid **mises en avant** keep their own « zero orders = refunded »
rule.

- server: `commissionFairide` and `fraisService` in `../fairide-backend/pricing.js`, called by `routes/orders.js`;
  `service_fee` stores the system fee excl. VAT, `service_fee_vat` its VAT (0 under the franchise) — both already inside
  `delivery_fee`;
- client estimate: [src/fraisService.js](../../src/fraisService.js);
- cards are built at the business's in-store prices (`../fairide-backend/scripts/prix.js` corrects platform-priced cards);
  no ×1.10 any more. Since 2026-10-01 the business can no longer edit dishes or prices itself
  (`MENU_LOCKED`) — it asks, and the team applies;
- legal texts: contract `RESTO-2026.24` since 2026-11-04 (no subscription; 2026.19 said Fairide charges no VAT and the own-prices model; courier contracts `*-2026.9`), T&Cs of 2026-11-04 (commission = 10 % of the price paid, no shop subscription; 2026-10-13 had added that Fairide's system fee carries no VAT), privacy
  `CONF-2026-10-17` (since 10-15: door-drop photo 30 days, courier position with the screen locked, courier SOS; 10-16-b: business staff
  accounts and group orders; 10-17: GatewayAPI as the SMS processor; they tell customers prices may be higher than on site). Never write « le prix du commerce » or « 100 % au
  restaurant » in customer-facing copy, and never « majoration » — it is « la commission de Fairide » (CODE-3).

## Changing the address after ordering (founder, 2026-10-27)

A customer who orders from somewhere else often forgets to change the address the checkout carried over from the last order.
From the order tracking (« Changer » next to the address, [ChangerAdresse](../../src/components/client/ChangerAdresse.jsx)) they
can change it **until the courier has picked the order up** (status `livraison`), at most 3 times, within the shop's delivery
radius. Uber Eats' rule, picked by Owen: **same price or cheaper → the address changes at once and the price paid stays** (no
small refund; when no courier has taken it yet, the gap stays with Fairride like the bike gap); **further → the customer pays
the difference** on a separate Stripe page (like the tip) and the address changes when the payment arrives. The supplement is
added to `delivery_fee` and `total` and kept in `orders.delivery_adjustment` (the first card charge is `total − delivery_adjustment`);
the shop's delivery discount does not grow; 10 % goes to the system fee, the rest to the courier. An assigned courier keeps at least
the price they accepted, and gets their own grid for the new trip if higher (bonus frozen at claim); a bike courier's order refuses a
new address beyond `VELO_MAX_KM`. A cancelled order refunds each supplement separately. Backend: `changementAdresse.js`, migration
096, `POST /orders/:id/address/quote` and `POST /orders/:id/address`. The checkout also warns « Tu n'es pas à cette adresse ? » when
the phone, with location already allowed (never asked for this), is more than 1 km from the address (`useLoinDeLAdresse`).

## Shop cancels after a courier took the job; payouts list (founder, 2026-10-31)

- A shop that cancels an accepted order (`PATCH /orders/:id/refuse` from `preparation`/`pret`) while a courier holds it:
  the customer is refunded in full as before, and the courier gets the share of a base trip (base fee × 90 %: 5,22 € since the 5,80 € fee of 10-31; computed from pricing, never written)
  for the trip (`annulationLivreur.js`, backend). Fairride pays it from its Stripe balance as a `virements_complements`
  row of nature `annulation` (never twice, retried when the balance is empty), books it 613-ANNULATION → 441-LIVREUR,
  and writes a `courier_earnings` line of kind `cancellation` (Gains: « Annulée par le commerce »). The courier's push
  says « 5,22 € pour toi quand même » (amount computed, `pushFile.js`). Charging it back to the shop needs a clause in the next shop contract version
  (30 days' notice): not done yet. The customer still can't cancel once the shop accepted (unchanged).
- Courier contract 2026.9 (`courierContracts.js`): prices are final, VAT included (the « hors TVA » left from 8-14/10 is
  gone), the courier's share in euros, computed from pricing in the PDF (since 10-31: 5,22 € up to 3 km, 0,45 € per started km; the in-app sheet and reminder said 4,50 € until 11-06), straight-line distance, and the
  cancellation pay above. Couriers sign again (a 2026.8 signature leaves « contrat » missing in their dossier).
- Shops see their payouts: Factures › « Virements » and a « Prochain virement » tile on the home screen
  (`GET /restaurants/:id/payouts`, `virementsCommerce.js`): the next Monday's amount (Stripe balance), and each Stripe
  payout with its orders and deductions, read from the payout's balance transactions. Counter-paid orders are listed
  apart: already in the till, never in a payout.
- Courier offers show the shop → customer leg « ≈ x km » by the streets (× 1,3, like the first leg); the price still
  uses the straight line.

## Delivery grid, missing items, contracts to sign (founder, 2026-10-31, second round)

- **Delivery grid** (migration 101, `pricing.js` DEFAULTS): 5,80 € up to 3 km, then 0,50 € per started km, final price.
  Benchmarked on what Brussels customers pay elsewhere (Deliveroo 4,99 € + service fee, Takeaway ~4,49 € + 1,29 €). The
  courier keeps 90 %: at least 5,22 €, 5 % above Uber Eats' reported flat 4,95 € per order. Fairride never tops it up.
  The courier's cancellation pay (above) is the same 5,22 €.
- **Missing or wrong item** (`reclamationsPlats.js`): the customer ticks the dishes within 24 h of delivery, adds a photo
  of what arrived and confirms on honour. The shop gets a push and taps « Rembourser » or « Contester » (no photo asked of
  the shop). No answer within 2 h **of opening time** = refunded at the shop's charge (`rembourserCommande`, responsibility
  `restaurant`; see « Pre-GO money review » below). Contested = no refund; the customer can « maintenir » (a ticket). Silence
  does NOT count as yes above 15 €, for a customer with 2 contested claims in 90 days, or for a customer already refunded
  twice by silence in 90 days (still allowed to claim; the team gets a task, nothing is closed automatically). A shop
  contesting 5+ claims from 3+ customers in 90 days gives a task.
- **Contracts must be signed before working**: couriers need courier contract 2026.9 to see or take any job
  (`courierContracts.contratAJour`); a shop needs to have accepted **any** version of its contract (`VERSIONS_VALABLES`).
- **A new shop contract version never stops anything** (Owen, 2026-11-03, RESTO-2026.23): the shop keeps selling and editing
  its menu on the version it accepted, sees « Nouvelles conditions » at the top of Commandes and accepts in one tap
  (`RenouvellementContrat.jsx`; that tap is also the P2B notice waiver). So a new rule that costs the shop something applies
  only to shops that accepted the version bringing it: `restaurantContract.aAccepte(r, 'RESTO-x')`, never
  `contract_version === VERSION` (e.g. silence-as-yes on missing items needs 2026.21, the 11.11 % cap needs 2026.22).
  New version = bump `VERSION`, add it to `VERSIONS_VALABLES`, write `CHANGEMENTS` and the clauses; nothing else.

## Pre-GO money review (Owen's decisions, 2026-11-06)

- **Partial refund at the shop's charge** (missing item, team gesture): the shop gives back what it received for that amount
  (amount × (1 − the order's commission rate), e.g. 9 € of a 10 € dish), Fairride gives back its commission (1 €). Backend
  `remboursement.js` keeps both on the refund line (`order_refunds.repris`, `commission_rendue`, migration 905); the
  commission leaves the month's commission invoice, or a credit note returns it when the invoice is already issued
  (`commissionRemboursee.rendreCommissionPartielle`). A refund that completes the order is unchanged (whole commission
  cancelled). The shop's missing-item card says « Déduit de ton virement : 9,00 €, ta part » (`retenue`), the e-mail and
  « Prochain virement » say the same amount.
- **What was really taken back** is kept on the line; less than expected (no transfer, transfer too small, Stripe refused):
  a high task, the incident stays open, the admin screens say « X € repris sur Y € », and the shop or courier e-mail states
  the amount taken (none taken: no e-mail).
- **Missing item, 2 hours of opening time**: the 2 hours count only while the shop is open (opening hours and closures, the
  « Ouvert » switch, not paused or stopped for the day; `reclamationsPlats.commerceOuvert`). A push that reached no device is
  doubled by an e-mail to the owner. Shop staff (« service » role) refund up to 15 €; above, the owner only. **The next shop
  contract version must say « 2 heures d'ouverture »** (RESTO-2026.21 says « 2 heures »; this change only favours the shop,
  so it applies now, but write it in the next version).
- **Cancelled through nobody's fault, the shop keeps its share and gets its commission back**: « aucun livreur » (customer or
  automatic) and a team cancel charged to Fairride or the courier (`delivery_incident = 'annule_equipe'`, never shown to apps,
  part of `INCIDENTS_DUS_AU_COMMERCE` so a share still waiting is paid). The commission goes back by transfer
  (`commissionRemboursee.rendreCommissionAnnulation`, same retry queue as a fully refunded order).
- **Courier cancellation pay** (5,22 €) also when the team cancels an order a courier had claimed (before pickup), and for
  orders paid with the Fairride balance. A shop refusing 3 claimed orders in 30 days (`annulations_apres_prise_seuil` /
  `_jours`, platform parameters) gives the team a task: a signal on the shop, nothing about couriers.
- **Courier price bump** starts when a courier is needed at the shop: expected ready time minus 10 minutes, or the time the
  shop marked it ready if sooner, never before it is offered (`troisVendeurs.debutAttente`, same function for the list, the
  push and the claim). Time a courier held the job before releasing it does not count (`orders.held_ms`).
- **Test accounts paying for real**: an order from an `is_test` customer at a real shop counts as real everywhere (alerts,
  shop payouts, accounting export, invoices). Only simulation shops, test-owned shops, training orders and simulated payments
  stay out (`simulation.sqlCommandeReelle`).
- **Alcohol order, customer absent for the ID check**: no refund, like « client absent » (`delivery_incident` `client_absent`,
  or `pickup_not_collected` for takeaway), with its own customer text (`orders.noCourier_incident_age_absent`).
- **Pickup code, then handover number (Owen, 2026-11-08)**: the courier confirms « J'ai la commande » with the 2-digit
  handover number the counter reads him (or printed on the bag ticket, never sent to him: backend `numeroRemise.js`), or with
  his 4-digit pickup code for orders without a number and apps frozen in the stores; before « Prête » the server requires one,
  and the shop reads « Retirée par le livreur avant que tu l'aies dite prête » (`orders.picked_up_before_ready`).
- Payout screens: « Prochain virement » no longer lists refused/cancelled refunded orders (except the incidents above) and
  shows shares still waiting apart, outside the total; Admin › Paiements › Versements shows the share minus what was taken
  back, and « à verser » means a share really waiting for its transfer.

## Money and order review of 2026-11-13 (Owen's decisions)

After a look at Uber Eats, Deliveroo and Takeaway, Owen settled the open points of the review of 2026-11-13 (workspace
`revues/2026-11-10-argent-commandes.md`, section 5). Each holds in the backend from the round of PRs of that date.
- **Courier never came, shop never tapped « Prête » (F5)**: the customer's « aucun livreur » cancel also opens from
  « en préparation », 20 minutes (`DELAI_SANS_LIVREUR_MIN`) after the expected ready time when the shop never said it was
  ready, while the courier who claimed the job never picked it up. Same outcome as from « Prête »: the customer is refunded
  in full, Fairride pays, the shop keeps its share (food cooked), the courier who didn't come gets nothing.
- **« Aucun livreur » clocks (F19)**: the **automatic** cancel (`delivery_no_courier_cancel_min`) adds the time a courier held
  the job before releasing it (`orders.held_ms`), so other couriers always get the full delay; the customer's own button keeps
  its time (Owen, 2026-11-13).
- **Gift voucher on a cancellation through nobody's fault (F9, option a)**: the voucher goes back to the customer, and
  Fairride pays the shop the voucher's value as a complement, since the share it keeps had already deducted it. Refused or
  expired orders (share taken back) are unchanged.
- **Welcome credit and single-use codes (F10)**: only a refunded or unpaid cancellation frees them; a paid order closed
  without a refund uses them up, until it is refunded in full (details in « Welcome credit » above).
- **Missing item on an order paid with balance or a promo (F11)**: the refund is the dish's menu price, capped at what the
  customer really paid (card + balance); the card first, up to what the card paid, the rest to the Fairride balance. The
  shop still gives back 90 % and Fairride its 10 % (« Pre-GO money review » above). The customer's push says both amounts,
  and it is sent only once the refund exists. A refund that goes wholly to the balance also sends the customer the « Tu es
  remboursé » e-mail, saying the amount is on the Fairride balance instead of the bank delay (Owen, 2026-11-14, G2-25).
- **Team cancel with a refund choice (Question 1)**: the customer's Fairride balance and gift voucher follow the refund the
  team picks: « aucun » = nothing back; « partiel » = the typed amount, card first then balance (the voucher only comes back
  on a full refund); « complet » = everything. Before, the balance came back in full whatever the choice.
- **Sharer's €3 (Question 2)**: kept even if the friend's order is refunded after handover (« Welcome credit » above).
- **Courier pay is never lost between closing and transfer (F1)**: the write that closes a delivery marks the courier's pay as
  due, so a restart or a database error before the Stripe transfer leaves it in the retry queue instead of nowhere.

## Costs and break-even screen (founder, 2026-11-04)

Admin › Finances › **Coûts et rentabilité** (`/admin/rentabilite`, owner / admin / finance): the company's fixed costs
(per month, quarter or year, with a start and an optional end), its start-up costs, the real result month by month, and a
« Et si… ? » simulation that gives the month's result and the break-even number of orders. It is a **management view, not
accounting**: the amounts are typed by the team (rounded, from memory) in their own tables (`couts_fixes`, `couts_depart`,
backend migration 110, which seeded the founder's figures of 2026-11-04), and real invoices stay in Comptabilité › Dépenses.
- Real side (backend `rentabilite.js`): revenue = commission + system fee of orders paid through Fairride, with the Finance
  page's definitions (`chiffresArgent.js`); Stripe fees = the `stripe_fee` entries really booked (656); Stripe Connect is
  **estimated** (2 € per shop or courier paid in the month, 0,10 € per weekly payout, 0,25 % of what is paid out).
- Simulation (front `src/pages/admin/rentabilite/calcul.js`): per order, delivery keeps 10 % of the food + 10 % of the
  delivery fee, takeaway paid online 10 % of the food, takeaway paid at the shop **nothing**; minus Stripe (Bancontact
  fixed, card % + fixed, mix chosen on screen) and a few cents of SMS. Paid Connect accounts never exceed the orders that
  pay them. Stripe's prices live once, in `rentabilite.TARIFS` (read 2026-11-04 on stripe.com/en-be): update them there.

## Three sellers per order (decided 2026-09-23)

The customer buys the food from the business, the **delivery from the independent courier** who accepts
the job, and the system fee (inside the delivery fee) from Fairide. The backend records a seller per line (`order_lines`, see
`../fairide-backend/troisVendeurs.js`). What the front end shows because of it:

- checkout recap labels each line with its seller (`conformite.seller*`);
- [VendeurLivraison](../../src/components/conformite/VendeurLivraison.jsx) on the client's orders — the
  courier's "Prénom N.", company number and VAT regime once known (the free "decline this courier" was closed by the
  founder on 2026-10-19: `PATCH /orders/:id/decline-courier` answers that it no longer exists);
- driver offers show the price, any Fairide-paid increase and a **Refuse** button, and an approximate
  destination (the server strips the client's name, phone and house number before the job is taken);
- [EspaceVendeurLivreur](../../src/components/conformite/EspaceVendeurLivreur.jsx) — minimum fee and the
  courier's sale documents (self-billing mandate, accepted in the notices step);
- admin › Conformité › *Attribution des courses* ([DispatchTab](../../src/pages/admin/compliance/DispatchTab.jsx)): delivery settings, and the
  evidence that refusing costs nothing as **aggregates only** — couriers grouped by refusal-rate band, average offers
  received per band, shown only when a band has at least 5 couriers (backend `statsAttribution.js`). No per-courier row,
  no « # » rank, on screen or in the CRT ZIP (founder, 2026-10-21: « if it's a driver classement let's not have any »).

Never add anything that ranks, rates or penalises couriers for refusing: the backend's
`tests/trois-vendeurs.test.js` fails if dispatch starts reading such data, and the courier notice promises it.
