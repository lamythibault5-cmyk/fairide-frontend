import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../pages/admin/adminUtils';

const GROUPS = [
  { key: 'orders', label: 'Commandes' },
  { key: 'restaurants', label: 'Restaurants' },
  { key: 'drivers', label: 'Livreurs' },
  { key: 'clients', label: 'Clients' },
  { key: 'crmProspects', label: 'CRM' },
  { key: 'tickets', label: 'Support' },
  { key: 'documents', label: 'Documents' }
];
// La route ne suit pas toujours la clé de groupe telle quelle (ex: crmProspects → /admin/crm) — mapping
// explicite plutôt que de dériver la route depuis le nom du groupe backend.
const GROUP_ROUTES = { orders: 'orders', restaurants: 'restaurants', drivers: 'drivers', clients: 'clients', crmProspects: 'crm', tickets: 'support', documents: 'documents' };

// Recherche globale de la sidebar admin : une commande, un restaurant, un livreur ou un client, retrouvés
// en un seul champ — voir GET /admin/search côté backend.
export default function AdminGlobalSearch() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const debouncedQ = useDebouncedValue(q, 300);
  const boxRef = useRef(null);

  useEffect(() => {
    if (debouncedQ.trim().length < 2) { setResults(null); return; }
    api(`/admin/search?q=${encodeURIComponent(debouncedQ.trim())}`, { token }).then(setResults).catch(() => {});
  }, [debouncedQ, token]);

  useEffect(() => {
    function onClickOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Pas de fiche pré-ouverte automatiquement : navigue vers la page et pré-remplit sa recherche locale
  // avec le libellé du résultat cliqué (ex: nom du restaurant), déjà assez précis pour retrouver la bonne
  // ligne en un clic depuis là — évite de dupliquer une logique d'ouverture directe de fiche par id sur
  // 4 pages différentes.
  function goTo(groupKey, item) {
    setOpen(false);
    setQ('');
    setResults(null);
    if (groupKey === 'orders') navigate(`/admin/orders?q=${encodeURIComponent(item.label)}`);
    else navigate(`/admin/${GROUP_ROUTES[groupKey]}`, { state: { presetSearch: item.label } });
  }

  const hasResults = results && GROUPS.some((g) => results[g.key]?.length > 0);

  return (
    <div ref={boxRef} style={{ position: 'relative', padding: '0 16px 12px' }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 Rechercher..."
        style={{ fontSize: 13 }}
      />
      {open && q.trim().length >= 2 && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 16, right: 16, zIndex: 50, maxHeight: 320, overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
          {!results && <div className="small" style={{ padding: 8 }}>Recherche...</div>}
          {results && !hasResults && <div className="small" style={{ padding: 8, opacity: 0.6 }}>Aucun résultat.</div>}
          {results && GROUPS.map((g) => {
            const items = results[g.key] || [];
            if (!items.length) return null;
            return (
              <div key={g.key} style={{ marginBottom: 6 }}>
                <div className="small" style={{ fontWeight: 700, opacity: 0.6, padding: '4px 4px 2px' }}>{g.label}</div>
                {items.map((it) => (
                  <div key={it.id} className="row" style={{ justifyContent: 'space-between', padding: '6px 4px', cursor: 'pointer', borderRadius: 6 }} onClick={() => goTo(g.key, it)}>
                    <span className="small">{it.label}</span>
                    <span className="small" style={{ opacity: 0.6 }}>{it.sublabel}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
