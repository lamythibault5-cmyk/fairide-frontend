import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable, { useTableSort } from '../../components/admin/AdminDataTable';
import urlSure from '../../urlSure';
import '../../terminal.css'; // pastilles d'état (.print-etat)
import '../../simulation.css'; // pastilles de filtre (.simu-filtres)

// Admin › Cartes (Owen, 2026-10-20 : « voir clairement qui n'a pas de carte et quels prix sont vérifiés »). Une ligne par
// vrai commerce, dans l'ordre où l'équipe s'en occupe : sans carte → prix à vérifier → à publier → en ligne.
// Règle des prix : ceux du commerce lui-même (son PDF, son site, sa caisse, des photos de sa carte) sont vérifiés ; ceux
// d'une plateforme de livraison ne le sont pas, les commerces les y gonflent. Backend : routes/adminCartes.js.
const ETATS = ['sans_carte', 'prix_a_verifier', 'a_publier', 'en_ligne'];
const TON = { sans_carte: 'erreur', prix_a_verifier: 'attente', a_publier: 'attente', en_ligne: 'ok' };
const PLATEFORMES = { uber_eats: 'Uber Eats', deliveroo: 'Deliveroo', takeaway: 'Takeaway', website: 'Site web', other: 'Autre' };

export default function AdminCartesPage() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [donnees, setDonnees] = useState(null);
  const [filtre, setFiltre] = useState('a_faire');
  const { sort, toggle } = useTableSort('aFaire', 'asc');

  const charger = useCallback(() => {
    api('/admin/cartes', { token }).then(setDonnees).catch((e) => toast(e.message, 'erreur'));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo(() => donnees?.lignes || [], [donnees]);
  // « À faire » par défaut : tout sauf ce qui est déjà en ligne — c'est la liste de travail.
  const visibles = useMemo(() => lignes.filter((l) => (filtre === 'tout' ? true : filtre === 'a_faire' ? l.aFaire !== 'en_ligne' : l.aFaire === filtre)), [lignes, filtre]);
  const compte = (f) => (f === 'tout' ? lignes.length : f === 'a_faire' ? lignes.filter((l) => l.aFaire !== 'en_ligne').length : donnees?.compteurs?.[f] || 0);
  const date = (ms) => (ms ? new Date(ms).toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit' }) : '—');

  const colonnes = [
    { key: 'name', label: tr('adminCartes.colRestaurant'), get: (l) => <span><b>{l.name}</b>{l.commune ? <span className="small" style={{ color: 'var(--ink-faint)' }}> · {l.commune}</span> : null}</span>, sortValue: (l) => l.name.toLowerCase() },
    { key: 'aFaire', label: tr('adminCartes.colTodo'), get: (l) => <span className={`print-etat ${TON[l.aFaire]}`}>{tr(`adminCartes.etat_${l.aFaire}`)}</span>, sortValue: (l) => ETATS.indexOf(l.aFaire) },
    { key: 'plats', label: tr('adminCartes.colDishes'), get: (l) => l.plats || '—', align: 'right' },
    { key: 'photos', label: tr('adminCartes.colPhotos'), get: (l) => (l.plats ? `${l.photos}/${l.plats}` : '—'), sortValue: (l) => l.photos, align: 'right' },
    {
      key: 'source', label: tr('adminCartes.colSource'),
      get: (l) => (l.source
        ? <span>{tr(`adminCartes.source_${l.source}`)} <span className={`print-etat ${l.sourcePlateforme ? 'attente' : 'ok'}`} style={{ marginLeft: 4 }}>{l.sourcePlateforme ? tr('adminCartes.sourcePlatform') : tr('adminCartes.sourceShop')}</span></span>
        : <span className="small" style={{ color: 'var(--ink-faint)' }}>{l.plats ? tr('adminCartes.sourceUnknown') : '—'}</span>),
      sortValue: (l) => l.source || ''
    },
    { key: 'prix', label: tr('adminCartes.colPrices'), get: (l) => (!l.plats ? '—' : l.prixVerifies ? <span className="print-etat ok">{tr('adminCartes.pricesVerified', { date: date(l.prixVerifiesLe) })}</span> : <span className="print-etat erreur">{tr('adminCartes.pricesToCheck')}</span>), sortValue: (l) => (l.prixVerifies ? 1 : 0) },
    {
      key: 'demande', label: tr('adminCartes.colRequest'),
      get: (l) => (!l.demande ? '—' : (
        <span className="small">
          {PLATEFORMES[l.demande.plateforme] || l.demande.plateforme}
          {l.demande.lien && <> · <a href={urlSure(l.demande.lien)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{l.demande.lien.replace(/^https?:\/\/(www\.)?/, '').slice(0, 32)}</a></>}
          {l.demande.lienIncoherent && <span className="print-etat erreur" style={{ marginLeft: 6 }}>{tr('adminCartes.linkMismatch')}</span>}
          {l.demande.fichiers > 0 && <> · {tr('adminCartes.files', { n: l.demande.fichiers })}</>}
        </span>
      )),
      sortValue: (l) => (l.demande ? l.demande.le : 0)
    },
    { key: 'importeeLe', label: tr('adminCartes.colImported'), get: (l) => date(l.importeeLe), sortValue: (l) => l.importeeLe || 0, align: 'right' }
  ];

  return (
    <div>
      <AdminPageHeader module="cartes" actions={<button type="button" className="btn-outline" onClick={charger}>{tr('adminCartes.refresh')}</button>} />
      <div className="stat-grid">
        {ETATS.map((e) => (
          <button key={e} type="button" className={`stat-card${e === 'sans_carte' && donnees?.compteurs?.[e] ? ' is-alert' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFiltre(e)}>
            <div className="num">{donnees ? donnees.compteurs[e] : '…'}</div>
            <div className="label">{tr(`adminCartes.etat_${e}`)}</div>
          </button>
        ))}
      </div>
      <p className="small" style={{ margin: '10px 0 0', color: 'var(--ink-soft)' }}>{tr('adminCartes.rule')}</p>
      <div className="simu-filtres" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 10px' }}>
        {['a_faire', ...ETATS, 'tout'].map((f) => (
          <button key={f} type="button" className={`chip${filtre === f ? ' active' : ''}`} onClick={() => setFiltre(f)}>{tr(f === 'a_faire' || f === 'tout' ? `adminCartes.filter_${f}` : `adminCartes.etat_${f}`)} ({compte(f)})</button>
        ))}
      </div>
      {!donnees && <p className="small">…</p>}
      {donnees && visibles.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminCartes.empty')}</p></div>}
      {visibles.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <AdminDataTable columns={colonnes} rows={visibles} sort={sort} onSort={toggle} onRowClick={(l) => navigate(`/admin/restaurants/${l.id}/menu`)} />
        </div>
      )}
    </div>
  );
}
