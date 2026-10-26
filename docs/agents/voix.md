# How Fairride talks (voice and message)

Founder decisions of 2026-10-24, 2026-10-25 and 2026-10-26. The brand is written « Fairride » (workspace CLAUDE.md, rename of
2026-10-25); the legal company stays Fairide SRL. Read this before writing any text a customer, a shop or a courier reads
first: the front page, « Notre histoire », the app onboarding (`/bienvenue`), sign-up, welcome e-mails, the newsletter, the
store listings, flyers and the shop pitch. Everyday screens (cart, order tracking, settings) stay plain and friendly; this
guide is about the doors people come in through.
If you change what this file describes, change this file in the same commit: a stale guide gets believed.

Status on 2026-10-26: the top of the front page follows this guide (version E of the workspace mockup
`maquettes/croissance/prix-gonfles.html`: title, subtitle, the card « Le même plat, trois prix » in
`src/components/landing/HeroPrix.jsx`). The other texts (onboarding, e-mails, « Notre histoire », store listings) still
follow the older, « what first » style and wait for the founder's picks in that mockup. New copy follows this guide now.

## 1. Start with why, and the why is about the reader

People don't buy what Fairride does, they buy why it does it. Every first text runs in this order:
**why** (what we believe, one sentence) → **how** (the proof, one number) → **what** (the service, and the action).
Never open with « l'alternative à Uber Eats », a commission rate or a feature list.

And the why is **about the reader, not about fairness in general** (founder, 2026-10-25: the people who order every day want
the better deal, « the 1+1 »; they don't choose an app for what the courier earns). Each audience hears its own gain:

| Audience | Why (their own) | How (the proof) | What |
|---|---|---|---|
| Customer | « Le même plat ne devrait pas coûter plus cher parce que tu le commandes en ligne. » | Ailleurs, jusqu'à +55 % sur la carte. Ici, +10 % au plus, souvent le prix du comptoir (badge « Prix du comptoir »). Rien n'est ajouté au paiement. | Livraison et à emporter des restaurants de Bruxelles. « Voir les commerces qui livrent ici. » |
| Shop | « Tes clients devraient voir tes vrais prix, et ton travail te payer toi. » | 10 %, pas 30. Tes prix du comptoir, ou 10 % de plus au plus. Ta carte préparée pour toi. | « Inscrire mon commerce. » |
| Courier | « Ta course devrait te payer toi. » | 90 % de chaque livraison, 100 % des pourboires, tu fixes ton minimum, personne ne te note. | « Commencer à livrer. » |

What the courier earns (90 % of the delivery, all tips) is told **only to couriers** (courier onboarding, courier ads,
the « Livreur » card of « Rejoindre Fairride »): founder, 2026-10-26, « le livreur garde 90 %, cette phrase peut partir ».
No customer text mentions it, not even lower on the page. « Ton argent reste à Bruxelles » may close a customer sentence,
never open it.

The slogan that holds all of it: **« Paie ton repas, pas la plateforme. »** (under the logo, store listings, sign-offs).
The front page opens with the call, then the customer's why (founder's mix, 2026-10-26):

> **Arrête de payer des prix gonflés.**
> Le même plat ne devrait pas coûter plus cher parce que tu le commandes en ligne. Ailleurs, c'est jusqu'à +55 %. Sur
> Fairride, +10 % au plus : le restaurant ne gonfle plus sa carte, et ton argent reste à Bruxelles.

« L'alternative à Uber Eats » left the subtitle but not the page: people search for it, so it is the heading of the
section under « Déjà sur Fairride » (`landing.altTitre`), and it stays in the Google title and description (`seo.*`)
and on « Notre histoire ».

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
  screenshots in the workspace, and redo the measurement monthly (date in `landing.prixReleve`, three languages).
  « Jusqu'à +55 % » is the top of what we measured, not a typical figure: never « tu paies 50 % de plus » as a general fact.
- « Ici, +10 % au plus » holds only while every published card has its counter prices checked
  (`in_store_prices_checked_at`) and the markup cap (`hausseMaxPourcent`, argent.md). Check before a campaign.
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
| Ici, +10 % au plus. Ailleurs, jusqu'à +55 %. | Moins cher, tu économises X € |
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
