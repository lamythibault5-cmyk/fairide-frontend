import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../pages/admin/adminUtils';
import { useLanguage } from '../../context/LanguageContext';

const groups = (tr) => [
  { key: 'orders', label: tr('adminSearch.orders') },
  { key: 'restaurants', label: tr('adminSearch.restaurants') },
  { key: 'drivers', label: tr('adminSearch.drivers') },
  { key: 'clients', label: tr('adminSearch.clients') },
  { key: 'crmProspects', label: tr('adminSearch.crm') },
  { key: 'tickets', label: tr('adminSearch.support') },
  { key: 'documents', label: tr('adminSearch.documents') },
  { key: 'tasks', label: tr('adminSearch.tasks') }
];
// La route ne suit pas toujours la clé de groupe telle quelle (ex: crmProspects → /admin/crm) — mapping
// explicite plutôt que de dériver la route depuis le nom du groupe backend.
const GROUP_ROUTES = { orders: 'orders', restaurants: 'restaurants', drivers: 'drivers', clients: 'clients', crmProspects: 'crm', tickets: 'support', documents: 'documents', tasks: 'tasks' };

// Recherche globale de la sidebar admin : une commande, un restaurant, un livreur ou un client, retrouvés
// en un seul champ — voir GET /admin/search côté backend.
export default function AdminGlobalSearch() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [erreur, setErreur] = useState(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  /* Audit du 19/10, admin-54 : une réponse plus lente d'une recherche précédente pouvait remplacer la bonne (on l'ignore
   * maintenant : seule la dernière demandée s'affiche), et une erreur laissait « Recherche… » pour toujours (elle se dit). */
  useEffect(() => {
    if (debouncedQ.trim().length < 2) { setResults(null); setErreur(null); return undefined; }
    let actuelle = true;
    setResults(null); setErreur(null);
    api(`/admin/search?q=${encodeURIComponent(debouncedQ.trim())}`, { token })
      .then((r) => { if (actuelle) setResults(r); })
      .catch((e) => { if (actuelle) setErreur(e.message || tr('adminSearch.error')); });
    return () => { actuelle = false; };
  }, [debouncedQ, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClickOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    // Ctrl+K / ⌘K : la recherche depuis n'importe quelle page, comme dans Odoo.
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onKey); };
  }, []);

  // Une commande ou un ticket s'ouvre directement par son identifiant (?id=, déjà lu par Commandes et Support) : leur
  // libellé (« #042 · Commerce — Client ») ne correspond à aucune colonne, et la liste s'ouvrait vide (audit du 19/10,
  // admin-09). Les autres pages reçoivent le nom en recherche pré-remplie, qui suffit à retrouver la ligne.
  function goTo(groupKey, item) {
    setOpen(false);
    setQ('');
    setResults(null);
    if (groupKey === 'orders' || groupKey === 'tickets') navigate(`/admin/${GROUP_ROUTES[groupKey]}?id=${encodeURIComponent(item.id)}`);
    else navigate(`/admin/${GROUP_ROUTES[groupKey]}`, { state: { presetSearch: item.label } });
  }

  const hasResults = results && groups(tr).some((g) => results[g.key]?.length > 0);
  // Au clavier (admin-54) : Entrée ouvre le premier résultat, flèche bas descend dans la liste ; chaque résultat est un
  // bouton (Tab, Entrée), et les flèches passent d'un résultat à l'autre.
  const listeRef = useRef(null);
  const premier = () => { for (const g of groups(tr)) { const it = results?.[g.key]?.[0]; if (it) return [g.key, it]; } return null; };
  function surTouche(e) {
    if (e.key === 'Enter' && hasResults) { e.preventDefault(); const p = premier(); if (p) goTo(p[0], p[1]); }
    if (e.key === 'ArrowDown' && hasResults) { e.preventDefault(); listeRef.current?.querySelector('button')?.focus(); }
  }
  function surToucheListe(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const boutons = [...(listeRef.current?.querySelectorAll('button') || [])];
    const i = boutons.indexOf(document.activeElement);
    if (e.key === 'ArrowUp' && i <= 0) { inputRef.current?.focus(); return; }
    boutons[Math.min(boutons.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  }

  return (
    <div ref={boxRef} className="admin-recherche" style={{ position: 'relative', padding: '0 16px 12px' }}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={surTouche}
        placeholder={tr('adminSearch.phSearch')}
        aria-label={tr('adminSearch.phSearch')}
      />
      {!q && <span className="admin-search-hint" aria-hidden="true">Ctrl K</span>}
      {open && q.trim().length >= 2 && (
        <div className="card admin-recherche-resultats" ref={listeRef} onKeyDown={surToucheListe}>
          {erreur && <div className="small texte-erreur" role="alert" style={{ padding: 8 }}>{erreur}</div>}
          {!results && !erreur && <div className="small" style={{ padding: 8 }}>{tr('adminSearch.searching')}</div>}
          {results && !hasResults && <div className="small" style={{ padding: 8, opacity: 0.6 }}>{tr('adminCommon.noResults')}</div>}
          {results && groups(tr).map((g) => {
            const items = results[g.key] || [];
            if (!items.length) return null;
            return (
              <div key={g.key} style={{ marginBottom: 6 }}>
                <div className="small" style={{ fontWeight: 700, opacity: 0.6, padding: '4px 4px 2px' }}>{g.label}</div>
                {items.map((it) => (
                  <button type="button" key={it.id} className="row lien-bouton" style={{ justifyContent: 'space-between', padding: '6px 4px', cursor: 'pointer', borderRadius: 6, width: '100%', textAlign: 'left', textDecoration: 'none', color: 'inherit' }} onClick={() => goTo(g.key, it)}>
                    <span className="small">{it.label}</span>
                    <span className="small" style={{ opacity: 0.6 }}>{it.sublabel}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
