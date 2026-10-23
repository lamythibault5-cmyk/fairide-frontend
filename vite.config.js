import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Identifiant de build affiché en bas de « Mon compte ». Le numéro de version du package vaut
// 0.0.0 et ne bouge jamais : il n'apprendrait rien. La date de build, elle, répond à la seule
// question qui compte quand quelqu'un signale un bug — « tu es sur quelle version ? ».
const buildId = new Date().toISOString().slice(0, 16).replace('T', ' ')

/* LE SURVOL SEULEMENT AVEC UNE SOURIS (fondateur, 2026-10-23, point 10 de maquettes/transitions-appli : « le corriger »).
   Sur un écran tactile, le navigateur garde l'état :hover sur ce qu'on vient de toucher jusqu'au toucher suivant : une carte
   restait bordée d'iris et zoomée, un bouton restait foncé. 213 des 228 règles :hover du dépôt n'étaient pas sous
   `@media (hover: hover)`. Plutôt que de les réécrire une à une (et d'oublier les prochaines), la construction le fait :
   chaque sélecteur qui contient :hover passe dans un `@media (hover: hover)` posé juste après sa règle (même place dans la
   cascade) ; les autres sélecteurs de la même règle (`:focus-visible`, `.active`…) restent où ils sont. Rien ne change avec
   une souris ou un pavé tactile ; site, app et console d'administration pareils. */
function survolALaSouris() {
  return {
    postcssPlugin: 'survol-a-la-souris',
    Once(racine, { AtRule }) {
      racine.walkRules((regle) => {
        if (!regle.selector.includes(':hover')) return;
        for (let p = regle.parent; p; p = p.parent) {
          if (p.type === 'atrule' && (/keyframes$/.test(p.name) || /hover\s*:\s*hover/.test(p.params))) return;
        }
        const avec = regle.selectors.filter((s) => s.includes(':hover'));
        const sans = regle.selectors.filter((s) => !s.includes(':hover'));
        const media = new AtRule({ name: 'media', params: '(hover: hover)' });
        media.append(regle.clone({ selectors: avec }));
        regle.after(media);
        if (sans.length) regle.selectors = sans; else regle.remove();
      });
    }
  };
}
survolALaSouris.postcss = true;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [survolALaSouris()] } },
  define: { __BUILD_ID__: JSON.stringify(buildId) }
})
