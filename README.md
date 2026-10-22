# Fairide — site et application

Fairide est une plateforme de livraison de repas pour Bruxelles : le commerce garde ses prix, Fairide prend 10 % du prix
payé, le livreur indépendant reçoit 90 % des frais de livraison et 100 % du pourboire.

Ce dépôt contient le site [fairide.be](https://fairide.be) (React 19 + Vite, déployé par Vercel) et les applications
Android / iOS qui emballent le même code avec Capacitor. L'API est dans
[fairide-backend](https://github.com/lamythibault5-cmyk/fairide-backend).

```
npm install
cp .env.example .env.local   # sans lui, le serveur de dev parle à la PRODUCTION
npm run dev
```

Vérifications : `npm run lint`, `npm run check:i18n`, `npm run check:app` (l'application ne montre jamais l'habillage du
site), `npm run check:barres`, `npm run build`.

Tout le reste, pour les humains comme pour les agents : [CLAUDE.md](CLAUDE.md) et [docs/agents/](docs/agents/).
