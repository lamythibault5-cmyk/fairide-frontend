// RELAIS fairride.be/api → backend Railway (2026-11-05).
//
// Le 2026-11-05, des fournisseurs d'accès et des services de sécurité bloquaient les adresses de Railway (incident
// Railway « External network blocks affecting access to Railway », ouvert le 4/11) : fairride.be s'affichait, mais
// restait vide, parce que le navigateur ne joignait plus le backend. Les serveurs de Vercel, eux, joignent Railway.
// Le site appelle donc fairride.be/api (voir API_BASE dans src/api.js) et ce middleware Vercel transmet chaque appel
// au backend, tel quel, et renvoie sa réponse.
//
// Il joint l'adresse réelle du visiteur (x-fairride-ip) et un secret partagé (x-fairride-relais = RELAIS_SECRET, même
// valeur dans Vercel et Railway) : sans eux, le backend verrait toutes les requêtes venir de quelques adresses Vercel
// et ses limites par adresse (connexion, code SMS…) bloqueraient tout le monde à la fois. Voir relaisSite.js du backend.
//
// Ce fichier ne sert qu'au site : l'appli installée garde l'adresse Railway compilée dans sa version.
export const config = { matcher: '/api/:path*' };

const CIBLE = (process.env.RELAIS_CIBLE || 'https://fairide-backend-production.up.railway.app').replace(/\/$/, '');

// En-têtes qui décrivent la connexion entre le visiteur et Vercel, pas la requête : fetch les recalcule.
const NON_TRANSMIS = ['host', 'connection', 'content-length', 'accept-encoding', 'x-fairride-relais', 'x-fairride-ip'];

export default async function middleware(request) {
  const url = new URL(request.url);
  const entetes = new Headers(request.headers);
  for (const h of NON_TRANSMIS) entetes.delete(h);
  // Réponse non compressée entre Railway et Vercel : fetch la décompresserait sans retirer content-encoding.
  entetes.set('accept-encoding', 'identity');
  const ip = request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (ip) entetes.set('x-fairride-ip', ip);
  if (process.env.RELAIS_SECRET) entetes.set('x-fairride-relais', process.env.RELAIS_SECRET);

  const avecCorps = !['GET', 'HEAD'].includes(request.method);
  try {
    const reponse = await fetch(`${CIBLE}${url.pathname}${url.search}`, {
      method: request.method,
      headers: entetes,
      body: avecCorps ? request.body : undefined,
      duplex: avecCorps ? 'half' : undefined,
      redirect: 'manual',
    });
    return new Response(reponse.body, { status: reponse.status, statusText: reponse.statusText, headers: reponse.headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Le serveur Fairride ne répond pas. Réessaie dans un instant.' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}
