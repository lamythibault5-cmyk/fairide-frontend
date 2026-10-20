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
// Un commerce EN LIGNE l'est quel que soit son état : pastille à côté du nom, rouge s'il est vu des clients avec des prix
// non vérifiés (Snack bodrum, Punjab…), le cas le plus urgent — en tête de son état et compté à part.
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
  // « À faire » par défaut : tout sauf ce qui est déjà en ligne et vérifié — c'est la liste de travail. « En ligne » montre
  // TOUS les commerces vus des clients, vérifiés ou non ; « En ligne, prix non vérifiés » isole les urgents.
  const nonVerifieEnLigne = (l) => l.enLigne && l.plats > 0 && !l.prixVerifies;
  const garder = (l, f) => (f === 'tout' ? true : f === 'a_faire' ? l.aFaire !== 'en_ligne' : f === 'en_ligne' ? l.enLigne : f === 'en_ligne_nv' ? nonVerifieEnLigne(l) : l.aFaire === f);
  const visibles = useMemo(() => lignes.filter((l) => garder(l, filtre)), [lignes, filtre]); // eslint-disable-line react-hooks/exhaustive-deps
  const compte = (f) => lignes.filter((l) => garder(l, f)).length;
  const date = (ms) => (ms ? new Date(ms).toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit' }) : '—');

  const colonnes = [
    {
      key: 'name', label: tr('adminCartes.colRestaurant'),
      get: (l) => (
        <span>
          <b>{l.name}</b>
          {l.commune && <span className="small" style={{ display: 'block', color: 'var(--ink-faint)' }}>{l.commune}</span>}
          {/* Sous le nom plutôt qu'à côté : la colonne reste étroite et le tableau tient dans 1280 px. */}
          {l.enLigne && <span className={`print-etat ${nonVerifieEnLigne(l) ? 'erreur' : 'ok'}`} style={{ display: 'inline-block', marginTop: 3 }}>{nonVerifieEnLigne(l) ? tr('adminCartes.liveUnverified') : tr('adminCartes.live')}</span>}
        </span>
      ),
      sortValue: (l) => l.name.toLowerCase()
    },
    // Dans un même état, les commerces en ligne d'abord (même ordre que le serveur).
    { key: 'aFaire', label: tr('adminCartes.colTodo'), get: (l) => <span className={`print-etat ${TON[l.aFaire]}`}>{tr(`adminCartes.etat_${l.aFaire}`)}</span>, sortValue: (l) => ETATS.indexOf(l.aFaire) + (l.enLigne ? 0 : 0.5) },
    { key: 'plats', label: tr('adminCartes.colDishes'), get: (l) => l.plats || '—', align: 'right' },
    { key: 'photos', label: tr('adminCartes.colPhotos'), get: (l) => (l.plats ? `${l.photos}/${l.plats}` : '—'), sortValue: (l) => l.photos, align: 'right' },
    {
      key: 'source', label: tr('adminCartes.colSource'),
      get: (l) => (l.source
        // La date d'import est sous la source : une colonne de moins, le tableau tient dans 1280 px.
        ? <span>{tr(`adminCartes.source_${l.source}`)} <span className={`print-etat ${l.sourcePlateforme ? 'attente' : 'ok'}`} style={{ marginLeft: 4 }}>{l.sourcePlateforme ? tr('adminCartes.sourcePlatform') : tr('adminCartes.sourceShop')}</span>{l.importeeLe && <span className="small" style={{ display: 'block', color: 'var(--ink-faint)' }}>{tr('adminCartes.importedOn', { date: date(l.importeeLe) })}</span>}</span>
        : <span className="small" style={{ color: 'var(--ink-faint)' }}>{l.plats ? tr('adminCartes.sourceUnknown') : '—'}</span>),
      sortValue: (l) => l.source || ''
    },
    { key: 'prix', label: tr('adminCartes.colPrices'), get: (l) => (!l.plats ? '—' : l.prixVerifies ? <span className="print-etat ok">{tr('adminCartes.pricesVerified', { date: date(l.prixVerifiesLe) })}</span> : <span className="print-etat erreur">{tr('adminCartes.pricesToCheck')}</span>), sortValue: (l) => (l.prixVerifies ? 1 : 0) },
    {
      key: 'demande', label: tr('adminCartes.colRequest'),
      // Une demande close n'est plus qu'un historique : grisée, sans plateforme ni lien qui laisseraient croire à une action.
      get: (l) => (!l.demande ? '—' : !l.demande.ouverte ? <span className="small" style={{ color: 'var(--ink-faint)' }}>{tr('adminCartes.requestClosed')}</span> : (
        <span className="small" style={{ display: 'inline-block', maxWidth: 180, whiteSpace: 'normal' }}>
          <b>{PLATEFORMES[l.demande.plateforme] || l.demande.plateforme}</b>
          {l.demande.fichiers > 0 && <> · {tr('adminCartes.files', { n: l.demande.fichiers })}</>}
          {l.demande.lien && <a href={urlSure(l.demande.lien)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.demande.lien.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          {l.demande.lienIncoherent && <span className="print-etat erreur">{tr('adminCartes.linkMismatch')}</span>}
        </span>
      )),
      sortValue: (l) => (l.demande ? l.demande.le : 0)
    }
  ];

  return (
    <div>
      <AdminPageHeader module="cartes" actions={<button type="button" className="btn-outline" onClick={charger}>{tr('adminCartes.refresh')}</button>} />
      <div className="stat-grid">
        {ETATS.map((e) => {
          // « En ligne » compte tous les commerces vus des clients ; ceux dont les prix ne sont pas vérifiés sont dits en rouge.
          const n = e === 'en_ligne' ? donnees?.compteurs?.en_ligne_total : donnees?.compteurs?.[e];
          const urgents = e === 'en_ligne' ? donnees?.compteurs?.en_ligne_prix_non_verifies || 0 : 0;
          return (
            <button key={e} type="button" className={`stat-card${(e === 'sans_carte' && n) || urgents ? ' is-alert' : ''}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setFiltre(urgents ? 'en_ligne_nv' : e)}>
              <div className="num">{donnees ? n : '…'}</div>
              <div className="label">{tr(`adminCartes.etat_${e}`)}</div>
              {urgents > 0 && <div className="small" style={{ color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>{tr('adminCartes.liveUnverifiedCount', { n: urgents })}</div>}
            </button>
          );
        })}
      </div>
      <p className="small" style={{ margin: '10px 0 0', color: 'var(--ink-soft)' }}>{tr('adminCartes.rule')}</p>
      <div className="simu-filtres" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '14px 0 10px' }}>
        {['a_faire', 'en_ligne_nv', ...ETATS, 'tout'].map((f) => (
          <button key={f} type="button" className={`chip${filtre === f ? ' active' : ''}`} style={f === 'en_ligne_nv' && compte(f) ? { borderColor: 'var(--red)', color: filtre === f ? undefined : 'var(--red)' } : undefined} onClick={() => setFiltre(f)}>{tr(ETATS.includes(f) ? `adminCartes.etat_${f}` : `adminCartes.filter_${f}`)} ({compte(f)})</button>
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
