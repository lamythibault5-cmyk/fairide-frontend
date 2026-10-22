# Fair Ride — Security & Launch Checklist

Compiled from 9 Instagram Reel screenshots (data/app security, vibe-coded app hardening, performance, and pre-launch website checks).

**How to use:** tick items off as you go. Items marked ⚠️ are the ones where the reel gave a caveat or extra nuance worth respecting.

---

## 1. Authentication & Access Control
*Source: @bencodezero — "T'as codé ton app avec l'IA ? Y'a 5 failles…"*

- [ ] **Login / session tokens** — Use proper signed session tokens (JWT or server-side sessions). Don't trust client-supplied identity; expire and rotate tokens.
- [ ] **Admin rights** — Verify admin permissions server-side on every request. Never hide an admin button in the frontend and call it a security control.
- [ ] **Email verification + 2FA** — Confirm email ownership before an account becomes usable; offer two-factor authentication (especially for drivers and admins).
- [ ] **Login rate limiting / attempt limits** — Cap failed login attempts per account and per IP; lock out or add a delay after repeated failures.
- [ ] **Password handling** — Enforce a minimum strength, hash with bcrypt/argon2 (never plaintext or MD5/SHA1), and add a safe reset flow.

---

## 2. API & Input Security
*Source: @securedbycasco (cybersecurity expert reacting to a viral security prompt)*

- [ ] **Rate limiting on all public endpoints** — ⚠️ Caveat from the expert: on a *public* endpoint the user may not be authenticated yet, so user-based rate limiting is limited in value. Rate limit by IP, device fingerprint, and endpoint too — not just by user ID.
- [ ] **Strict input validation and sanitization** — Restrict what users can enter, on every field. Validate server-side, not just in the browser.
- [ ] **Secure API key handling** — ⚠️ The key point: any call made with an API key must happen **on your server**, never from the frontend. Better still, use short-lived credentials instead of long-lived static keys.
- [ ] **Keep the API off the front-end** — No direct database or third-party API calls from the client. All sensitive logic behind your own backend.
- [ ] **Force HTTPS** — Redirect all HTTP to HTTPS, enable HSTS.

---

## 3. The Three Classic Vibe-Coded App Holes
*Source: @millee.md — "Securitymaxxing your vibecoded app pt.3" (comment breakdown)*

- [ ] **Cross-site scripting (XSS)** — Any text a user submits (comment, username, review, address) can carry code that runs in another user's browser and steals their login. Escape and sanitize everything user-submitted *before* it's rendered on the page.
- [ ] **File uploads** — If people can upload anything unchecked, someone can upload a file that executes code on your server and takes it over. Check file type and file size, and store uploads somewhere they can **never** be executed (e.g. object storage, separate domain, no execute permissions).
- [ ] **Payment webhooks** — Your app trusts a message saying "payment succeeded". If you don't verify the signature, someone can forge it and get the ride/product without paying. **Verify the webhook signature** so only genuine Stripe events are accepted.
  - The screenshot shows exactly this: a legit event `from: stripe.com · signature verified` next to a fake `from: totally-stripe.biz · NO SIGNATURE` that the app accepted and delivered on.

---

## 4. Wider Vulnerability List (Vibe-Coded App, Part 3 — items 37–54)
*Source: @byarnieverma — "Securitymaxxing for your vibe coded app (Part 3)"*

- [ ] 37. **Vulnerable dependencies** — audit and patch known CVEs in your packages.
- [ ] 38. **Malicious packages** — verify package names/publishers before installing (typosquatting).
- [ ] 39. **Prompt injection** — if any AI feature reads user content, assume that content will try to hijack it.
- [ ] 40. **Unpermissioned AI access** — the AI layer shouldn't be able to reach data the user can't.
- [ ] 41. **Excessive DB permissions** — least privilege for every database role/service account.
- [ ] 42. **Missing audit logs** — log who did what, when, especially for admin and payment actions.
- [ ] 43. **No security monitoring** — alerting on anomalies, failed logins, unusual traffic.
- [ ] 44. **No backups / restore** — and actually test the restore, not just the backup.
- [ ] 45. **Exposed internal dashboards** — admin panels, metrics, queue dashboards must not be publicly reachable.
- [ ] 46. **Missing security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS.
- [ ] 47. **Insecure cookie settings** — `HttpOnly`, `Secure`, `SameSite`.
- [ ] 48. **Unencrypted data** — encrypt in transit and at rest (rider addresses, phone numbers, payment metadata).
- [ ] 49. **Poor tenant isolation** — one restaurant/driver must never be able to read another's data.
- [ ] 50. **Unreviewed code** — no AI-generated code straight to production without a human read.
- [ ] 51. **Mass assignment** — don't bind raw request bodies to DB models (someone sets `isAdmin: true`).
- [ ] 52. **Command injection** — never pass user input into shell commands.
- [ ] 53. **Insecure deserialisation** — don't deserialize untrusted data into objects.
- [ ] 54. **Misconfigured OAuth** — validate redirect URIs, state parameter, and token audience.

> ⚠️ **Note:** this screenshot is Part 3 only (items 37–54). Items 1–36 are in Parts 1 and 2 of the same series — worth tracking down to complete this section.

---

## 5. Infrastructure & DNS
*Source: @verycoolentrepreneur comment thread*

- [ ] **Cloudflare (or equivalent) in front of the app** — DNS managed there.
- [ ] **WAF (Web Application Firewall)** enabled — blocks a large share of automated attacks before they reach you.
- [ ] **DDoS protection** — comes with the above; confirm it's actually on.

---

## 6. Performance & Scalability
*Source: @joshtheaiguy — "Vibe-coding is all fun and games until you…"*

- [ ] Cache API responses
- [ ] Load balancer
- [ ] Index the database
- [ ] Compress images
- [ ] Loading skeletons
- [ ] Cache expensive queries
- [ ] **Fix N+1 database queries** (flagged ❌ in the reel — a common killer)
- [ ] Debounce input handlers
- [ ] Split code into chunks
- [ ] Add a CDN
- [ ] Server-side caching
- [ ] Paginate large lists
- [ ] Run a Lighthouse audit
- [ ] Compress API payloads
- [ ] **Eliminate unnecessary re-renders** (flagged ❌)
- [ ] Minify JS and CSS
- [ ] Add lazy loading
- [ ] Defer non-critical scripts
- [ ] **Remove unused dependencies** (flagged ❌ — also a security win, see #37/#38)
- [ ] Database connection pooling

---

## 7. Pre-Launch Website Checklist (20 items)
*Source: @buildwithmathias — "20 choses à vérifier avec Claude avant de lancer ton site web"*

- [ ] 1. **GDPR / RGPD page** — privacy policy. Non-negotiable for an EU food-delivery app handling addresses, location and payment data.
- [ ] 2. **Terms of service page (CGU)**
- [ ] 3. **API kept out of the front-end**
- [ ] 4. **Force HTTPS**
- [ ] 5. **Cookie banner** — with real consent, not just a notice.
- [ ] 6. **Meta title**
- [ ] 7. **Social share image** (Open Graph / Twitter card)
- [ ] 8. **Favicon**
- [ ] 9. **Sitemap + robots.txt**
- [ ] 10. **Alt text on images**
- [ ] 11. **Compress images**
- [ ] 12. **Page speed**
- [ ] 13. **Contrast** (accessibility)
- [ ] 14. **Responsive site**
- [ ] 15. **Custom 404 page**
- [ ] 16. **Fix broken links**
- [ ] 17. **Validate forms**
- [ ] 18. **Anti-spam** (on forms / signups)
- [ ] 19. **Analytics tool**
- [ ] 20. **One single CTA**

---

## 8. Post-Launch / SEO
*Source: @itsblakedavis — "10 Things I'd Do Immediately After Launching a New Website"*

- [ ] 1. Set up **Google Search Console**
- [ ] 2. **Submit your sitemap**
- [ ] 3. Set up **Google Analytics**
- [ ] 4. Create a **Google Business Profile**
- [ ] 5. **Main keyword in the title**
- [ ] 6. **Add your city** (local SEO — key for a delivery service operating city by city)
- [ ] 7. **Meta descriptions**
- [ ] 8. **Internal links**
- [ ] 9. **Compress images**
- [ ] 10. **Get backlinks**

---

## Gaps worth noting

These weren't in the screenshots but matter a lot for Fair Ride specifically — consider adding them yourself:

- [ ] GDPR beyond a policy page: lawful basis, data retention periods, right to deletion, DPA with any processor (Stripe, hosting, mapping).
- [ ] PCI-DSS scope — keep card data entirely inside Stripe (hosted fields / Checkout) so you never touch card numbers.
- [ ] Location data handling — continuous driver GPS is sensitive personal data; document why you collect it and how long you keep it.
- [ ] Driver identity / right-to-work verification and its data storage.
- [ ] Incident response plan + a breach notification process (72h under GDPR).
- [ ] A penetration test before public launch.
