# How Fairride talks (voice and message)

Founder decisions of 2026-10-24, 2026-10-25 and 2026-10-26. The brand is written « Fairride » (workspace CLAUDE.md, rename of
2026-10-25); the legal company stays Fairide SRL. Read this before writing any text a customer, a shop or a courier reads
first: the front page, « Notre histoire », the app onboarding (`/bienvenue`), sign-up, welcome e-mails, the newsletter, the
store listings, flyers and the shop pitch. Everyday screens (cart, order tracking, settings) stay plain and friendly; this
guide is about the doors people come in through.
If you change what this file describes, change this file in the same commit: a stale guide gets believed.

Status on 2026-10-26 (founder's answers to the workspace mockup `maquettes/croissance/prix-gonfles.html`): these follow
the guide: the front page (title, subtitle, the card « Le même plat, trois prix » in `src/components/landing/HeroPrix.jsx`,
the « prix » tile, « Rejoindre », footer, Google description), « Notre histoire », the app onboarding for customers
(title, the real measured dish, « Qu'est-ce qui t'énerve le plus ? », « Sur Fairride, c'est réglé. ») and couriers
(« Personne ne te note »), and the customer and courier welcome e-mails (backend `emailTexts.js`). Left as they were on
purpose: everything shops see (founder: « ne change rien pour la vue restaurants », shop welcome e-mail included).
Not built yet: the monthly newsletter « Prix gonflés : le relevé du mois » (version C of the mockup) and the store
listings (pasted in the consoles by hand). New copy follows this guide now.

## 1. Start with why, and the why is about the reader

People don't buy what Fairride does, they buy why it does it. Every first text runs in this order:
**why** (what we believe, one sentence) → **how** (the proof, one number) → **what** (the service, and the action).
Never open with « l'alternative à Uber Eats », a commission rate or a feature list.

And the why is **about the reader, not about fairness in general** (founder, 2026-10-25: the people who order every day want
the better deal, « the 1+1 »; they don't choose an app for what the courier earns). Each audience hears its own gain:

| Audience | Why (their own) | How (the proof) | What |
|---|---|---|---|
| Customer | « Le même plat ne devrait pas coûter plus cher parce que tu le commandes en ligne. » | Ailleurs, jusqu'à +55 % sur la carte. Ici, le restaurant ne gonfle plus sa carte, souvent le prix du comptoir (badge « Prix du comptoir »). Rien n'est ajouté au paiement. | Livraison et à emporter des restaurants de Bruxelles. « Voir les commerces qui livrent ici. » |
| Shop | « Tes clients devraient voir tes vrais prix, et ton travail te payer toi. » | 10 %, pas 30. Tes prix du comptoir, ou 11,11 % de plus pour recevoir ton prix entier. Ta carte préparée pour toi. | « Inscrire mon commerce. » |
| Courier | « Ta course devrait te payer toi. » | 90 % de chaque livraison, 100 % des pourboires, tu fixes ton minimum, personne ne te note. | « Commencer à livrer. » |

What the courier earns (90 % of the delivery, all tips) is told **only to couriers** (courier onboarding, courier ads,
the « Livreur » card of « Rejoindre Fairride »): founder, 2026-10-26, « le livreur garde 90 %, cette phrase peut partir ».
No customer text mentions it, not even lower on the page. One exception (founder, 2026-11-06, `maquettes/pourboire`
question 9): where a customer is asked for a tip, one line says the courier gets all of it (« Karim reçoit tout. », and the
T&Cs' payment article). It is the reason to tip, not a pitch: never the 90 %, never elsewhere. « Ton argent reste à Bruxelles » may close a customer sentence,
never open it.

The slogan that holds all of it: **« Paie ton repas, pas la plateforme. »** (under the logo, store listings, sign-offs).
The front page opens with the call, then the customer's why (founder's mix, 2026-10-26):

> **Arrête de payer des prix gonflés.**
> Le même plat ne devrait pas coûter plus cher parce que tu le commandes en ligne. Ailleurs, c'est jusqu'à +55 %. Sur
> Fairride, le restaurant ne gonfle plus sa carte, et ton argent reste à Bruxelles.

« L'alternative à Uber Eats » left the subtitle but not the page: people search for it, so it is the big title next to
the fake phone under the iris band (`landing.altTitre`, EssaiAppli.jsx since 2026-11-12, « fairride » as the wordmark), with
two short lines only: « Fini les prix gonflés. » and « Cherche le badge Prix du comptoir » (Owen, 2026-11-12: minimal). It
stays in the Google title and description (`seo.*`) and on « Notre histoire ». Visitors never read how many restaurants
there are (Owen, 2026-11-12), and the app is offered with « installer », never « prendre ».

## 2. The villain: the inflated price, never a company

Fairride picks a fight with a norm: paying the platform's ~30 % cut hidden in the menu price. The words are
« le prix gonflé », « de trop », « arrête de payer des prix gonflés » (a call to action, at the end of a block).

- The villain is the system. Write « les grandes plateformes », never a brand, except where people search for it: the
  page `<title>` and meta description may say « l'alternative à Uber Eats » with the public commission figures
  (comparative advertising, CDE art. VI.17).
- **The restaurant is a victim, never the culprit**: « Ce n'est pas le restaurant, c'est la commission. »
- Fairride never calls itself « la plateforme » in marketing copy (it is the villain's word): « on », « Fairride ».
  Legal texts keep « la plateforme ».

## 3. Claims: aggressive, and still true

- A measured gap always carries one short line next to it with its date and where to check it: « Un plat d'un
  restaurant bruxellois, relevé en octobre 2026. Détails sur demande. » A price comparison must say where and how it can
  be verified (CJEU, Lidl Belgium v Colruyt, C-356/04, 2006); « Détails sur demande » plus the FAQ question
  `story.faqQ9` (how we measured, write to contact@) does that. The founder dropped the « Comment on a mesuré » link and
  the proof section on 2026-10-26, and the dish is not named, so the partner can't be recognised. Before a measured
  figure goes public, get the measured restaurant's written OK (a request for details reveals it), keep the dated
  screenshots in the workspace, and keep its date visible (`landing.prixReleve`, `appli.accSource`, three languages). No
  monthly re-measurement (founder, 2026-11-02: « on ne va pas faire ça »): a dated measurement stays a true fact, but the
  older it gets the easier it is to call misleading if prices moved, so re-check the dish before a campaign and when its
  price changes.
  « Jusqu'à +55 % » is the top of what we measured, not a typical figure: never « tu paies 50 % de plus » as a general fact.
  In the app's welcome card the line sits behind an « i » next to « Le même plat, 15 € au comptoir » (founder, 2026-10-27:
  « retire la ligne Détails sur demande, ça fait trop de texte »): still one tap away, never removed.
- **Fairride's own markup, to customers (founder, 2026-11-02, maquettes/prix-client)**: the cap became 11.11 % and « +11,11 % »
  sounded bad, so the website, e-mails, Google and « Notre histoire » give NO figure for Fairride (« le restaurant ne gonfle
  plus sa carte »); the badge screen says only « Le même prix que sur place. » (its line « Les autres : jamais une carte gonflée. » removed by
  the founder on 2026-11-06); only the app onboarding keeps a figure,
  in euros on the measured dish: « Sur un plat à 15 € : ailleurs +8,25 €, Fairride +1,70 € au plus » (16,70 € on the first
  screen). Never « +11 % au plus » (11.11 > 11) nor « +10 % » (both false). Shops always read « 11,11 %, arrondis aux 10
  cents supérieurs : tu reçois ton prix entier ». The FAQ that explains the mechanism keeps its worked example (13,40 €).
  These hold only while every published card has its counter prices checked (`in_store_prices_checked_at`).
- Never « moins cher », never a total including delivery (our delivery fee can be higher than a platform's promotional
  one on a small order). The deal is told as « pas de prix gonflé », « le prix du comptoir », and real promos.
- A restaurant is never identifiable next to an inflated figure: « un restaurant indien, +55 % » in the same e-mail as
  « Nouveau sur Fairride » listing the only Indian partner counts as naming it. This repo is public: the measurements themselves stay in the workspace, never here.
- Never « arnaque », « voler », « escroquerie », a competitor's logo or colours.
- Transactional messages (order e-mails, receipts, SMS, push) carry no promotion and no villain line (APD).
- Precision belongs in the FAQ and the small date line, not in headlines: no « se veut », no « c'est un calcul,
  pas un relevé » in a title.

## 4. Voice

- « On » and « tu »; a belief sounds like people, not like « Fairride est une plateforme qui… ».
- One number per block, after the belief. A screen full of 10 % / 22-32 % / 90 % / 20 € reads like a spreadsheet.
- Short sentences, verbs, no adjectives doing the work (« équitable pour tous », « commission réduite » say nothing).
- Rules that already apply (argent.md, CLAUDE.md): « restaurant », never « resto »; never that the restaurant « gagne plus »;
  inside the app, never Fairride's 10 % or the courier's 90 % (onboarding and the website only, next to the ~30 %);
  couriers are independents (no « job », « shift », « salaire », « horaires », « patron »); no emoji; no em dash in e-mails.

| Say | Don't say |
|---|---|
| Paie ton repas, pas la plateforme. | L'alternative à Uber Eats (except `<title>` / meta) |
| Le même plat ne devrait pas coûter plus cher en ligne. | Une livraison plus équitable pour tous |
| Ailleurs, jusqu'à +55 %. Ici, le restaurant ne gonfle plus sa carte. | Moins cher, tu économises X € ; « +11 % » / « +10 % au plus » |
| Ce n'est pas le restaurant, c'est la commission. | Les restaurants gonflent leurs prix (as a reproach) |
| Arrête de payer des prix gonflés. | Arnaque, ils te volent |
| On prend 10 %, pas 30. | La plateforme (about Fairride), commission réduite, se veut |

## 5. Where the message goes, and how loud

| Loudness | Where |
|---|---|
| Loud | Front page top, social posts, flyers and window stickers, the monthly « relevé » newsletter (opt-in only), the shop pitch (there, privately, the shop's own prices may name the platform) |
| Medium | App onboarding, sign-up halves of `/login`, welcome e-mails, store listings, « Notre histoire », SEO pages |
| Quiet proof | Inside the app: the « Prix du comptoir » badge, a « Le vrai prix » screen if built |
| Never | Checkout, receipts, order e-mails, SMS and push, legal pages, the shop's dashboard, courier work screens |
