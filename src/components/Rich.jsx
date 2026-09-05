import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Rend un texte traduit qui porte un peu de mise en forme : **gras**, *italique* et [libellé](cible).
// Les pages statiques (mode d'emploi, aide, mentions légales…) en ont besoin — un paragraphe qui
// contient un mot en gras ne peut pas être une seule chaîne t() sinon, et le découper en trois clés
// rend la traduction illisible. La cible d'un lien commençant par « / » est une route interne (Link),
// « mailto: », « tel: » ou « http » un lien ordinaire.
const MOTIF = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;

export default function Rich({ text }) {
  if (!text) return null;
  const parts = String(text).split(MOTIF);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith('**') && p.endsWith('**')) return <b key={i}>{p.slice(2, -2)}</b>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <i key={i}>{p.slice(1, -1)}</i>;
    const lien = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(p);
    if (lien) {
      const [, libelle, cible] = lien;
      if (cible.startsWith('/')) return <Link key={i} to={cible}>{libelle}</Link>;
      return <a key={i} href={cible}>{libelle}</a>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}
