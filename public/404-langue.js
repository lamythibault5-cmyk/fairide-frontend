// Traduction de la page 404 statique (public/404.html) d'après le préfixe de langue de l'adresse : Vercel ne sert
// qu'un seul 404.html pour tout le site, donc /nl/… et /en/… le recevaient en français. Fichier externe parce
// que la politique de sécurité du contenu (vercel.json) interdit le script en ligne. Les liens gardent la langue.
(function () {
  var langue = (location.pathname.match(/^\/(nl|en)(\/|$)/) || [])[1];
  if (!langue) return;
  var textes = {
    nl: { page: 'Pagina niet gevonden · fairide.be', titre: 'Deze pagina bestaat niet', texte: 'De link is misschien verouderd, of het adres bevat een tikfout. De zaken zijn er nog altijd.', commerces: 'Bekijk de zaken', accueil: 'Terug naar de startpagina', mentions: 'Wettelijke vermeldingen', confidentialite: 'Privacy', cgv: 'Algemene voorwaarden', aide: 'Hulp' },
    en: { page: 'Page not found · fairide.be', titre: 'This page does not exist', texte: 'The link may be out of date, or the address contains a typo. The shops are still here.', commerces: 'See the shops', accueil: 'Back to the home page', mentions: 'Legal notice', confidentialite: 'Privacy', cgv: 'Terms and conditions', aide: 'Help' }
  }[langue];
  document.documentElement.lang = langue;
  document.title = textes.page;
  var elements = document.querySelectorAll('[data-t]');
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    if (textes[el.getAttribute('data-t')]) el.textContent = textes[el.getAttribute('data-t')];
    var href = el.getAttribute('data-href');
    if (href) el.setAttribute('href', '/' + langue + (href === '/' ? '' : href));
  }
})();
