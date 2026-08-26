import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SkeletonCards } from '../../components/Skeleton';
import { isTestAccount, TestBadge, filterBySearch, money, fmtDate } from './adminUtils';

export default function AdminClientsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api('/admin/clients', { token }).then(setClients).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openClient(c) {
    setSelected(c);
    setDetail(null);
    api(`/admin/clients/${c.id}`, { token }).then(setDetail).catch((e) => toast(e.message));
  }

  const filtered = filterBySearch(clients, search, (c) => [c.name, c.email, c.phone]);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>Clients</h2>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="Chercher un(e) client(e)..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
      </div>
      {!clients && <SkeletonCards count={3} />}
      {clients && filtered.length === 0 && <div className="empty">Aucun résultat.</div>}
      {filtered && filtered.map((c) => (
        <div className={`card order-card-clickable${isTestAccount(c.email) ? ' card-test-account' : ''}`} key={c.id} onClick={() => openClient(c)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>{c.name}</b>
            <div className="row" style={{ gap: 6 }}>
              {isTestAccount(c.email) && <TestBadge />}
              {c.refundCount > 0 && <span className="pill" style={{ color: 'var(--red)' }}>{c.refundCount} remboursement(s)</span>}
            </div>
          </div>
          <div className="small">{c.email}{c.phone ? ` · ${c.phone}` : ''} · inscrit le {fmtDate(c.createdAt)}</div>
          <div className="small">
            {c.orderCount} commande(s) · {money(c.totalSpent)} dépensés · panier moyen {money(c.avgBasket)}
            {c.lastOrderAt ? ` · dernière commande le ${fmtDate(c.lastOrderAt)}` : ' · aucune commande'}
          </div>
        </div>
      ))}

      {selected && createPortal(
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3 style={{ margin: '0 0 8px' }}>{selected.name}</h3>
            {!detail && <div className="small">Chargement...</div>}
            {detail && (
              <>
                <p className="small" style={{ margin: '2px 0' }}>{detail.email}{detail.phone ? ` · ${detail.phone}` : ''}</p>
                {detail.address && <p className="small" style={{ margin: '2px 0' }}>📍 {detail.address}</p>}
                <p className="small" style={{ margin: '2px 0' }}>Inscrit le {fmtDate(detail.createdAt)} · Solde : <b>{money(detail.balance)}</b></p>
                <div className="divider" />
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Commandes</span><b className="small">{detail.orderCount}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Total dépensé</span><b className="small">{money(detail.totalSpent)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Panier moyen</span><b className="small">{money(detail.avgBasket)}</b></div>
                <div className="row" style={{ justifyContent: 'space-between' }}><span className="small">Dernière commande</span><b className="small">{fmtDate(detail.lastOrderAt)}</b></div>
                {(detail.refunds || []).length > 0 && (
                  <>
                    <div className="divider" />
                    <h4 style={{ margin: '0 0 6px', color: 'var(--red)' }}>Remboursements</h4>
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="row" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                        <span className="small">{r.restaurantName} — {r.reason || r.responsibility}</span>
                        <span className="small">{money(r.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div className="divider" />
                <h4 style={{ margin: '0 0 6px' }}>Commandes récentes</h4>
                {(detail.orders || []).length === 0 && <div className="small">Aucune commande pour l'instant.</div>}
                {(detail.orders || []).map((o) => (
                  <div key={o.id} className="row" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                    <span className="small">{o.restaurantName}</span>
                    <span className="small">{money(o.total)}</span>
                  </div>
                ))}
              </>
            )}
            <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => setSelected(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
