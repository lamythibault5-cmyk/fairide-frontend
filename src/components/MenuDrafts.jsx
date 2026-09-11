import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';

// Brouillons de carte : un menu préparé à côté (carte d'été, nouvelle formule, changement de saison)
// pendant que la carte actuelle reste visible des clients. Rien n'est en ligne tant que le restaurateur
// ne publie pas — et la publication repasse par le même chemin qu'un import (ajout ou remplacement).
// Côté serveur : menu_drafts (JSONB), routes /restaurants/:id/menu/drafts*.

const PLAT_VIDE = { name: '', price: '', desc: '', category: 'plat', subsection: '', imageUrl: '' };

function normaliser(items) {
  return (items || []).map((it, i) => ({
    cle: `${i}-${it.name}`,
    name: it.name || '',
    price: it.price === undefined || it.price === null ? '' : String(it.price),
    desc: it.desc || '',
    category: it.category || 'plat',
    subsection: it.subsection || '',
    imageUrl: it.imageUrl || ''
  }));
}
function pourLApi(lignes) {
  return lignes
    .filter((l) => l.name.trim())
    .map((l) => ({ name: l.name.trim(), price: Number(l.price) || 0, desc: l.desc, category: l.category.trim() || 'plat', subsection: l.subsection, imageUrl: l.imageUrl }));
}

export default function MenuDrafts({ restoId, token, menuCount = 0, onPublished }) {
  const { t, locale } = useLanguage();
  const toast = useToast();
  const [brouillons, setBrouillons] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState(null); // { id, name } du brouillon en cours d'édition
  const [nom, setNom] = useState('');
  const [lignes, setLignes] = useState([]);
  const [modifie, setModifie] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [publication, setPublication] = useState(null); // brouillon dont la publication est à confirmer
  const [publieEnCours, setPublieEnCours] = useState(false);
  const [suppression, setSuppression] = useState(null); // brouillon dont la suppression est à confirmer

  const charger = useCallback(async () => {
    try {
      const liste = await api(`/restaurants/${restoId}/menu/drafts`, { token });
      setBrouillons(Array.isArray(liste) ? liste : []);
    } catch {
      // Backend pas encore déployé (404) ou hors ligne : la carte reste utilisable sans les brouillons.
      setBrouillons([]);
    } finally {
      setChargement(false);
    }
  }, [restoId, token]);

  useEffect(() => { charger(); }, [charger]);

  const dateCourte = (v) => (v ? new Date(v).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '');

  async function creer(fromCurrent) {
    setCreation(true);
    try {
      const cree = await api(`/restaurants/${restoId}/menu/drafts`, {
        method: 'POST', token,
        body: { name: nom.trim() || t('menuPage.draftsDefaultName'), fromCurrent: !!fromCurrent }
      });
      setNom('');
      await charger();
      ouvrir(cree.id);
      toast(t('menuPage.draftsCreated'));
    } catch (e) {
      toast(e.message);
    } finally {
      setCreation(false);
    }
  }

  async function ouvrir(draftId) {
    try {
      const d = await api(`/restaurants/${restoId}/menu/drafts/${draftId}`, { token });
      setOuvert({ id: d.id, name: d.name });
      setLignes(normaliser(d.items));
      setModifie(false);
      setEnregistre(false);
    } catch (e) {
      toast(e.message);
    }
  }

  function majLigne(cle, champ, valeur) {
    setLignes((ls) => ls.map((l) => (l.cle === cle ? { ...l, [champ]: valeur } : l)));
    setModifie(true);
  }
  function retirerLigne(cle) { setLignes((ls) => ls.filter((l) => l.cle !== cle)); setModifie(true); }
  function ajouterLigne() {
    setLignes((ls) => [...ls, { ...PLAT_VIDE, cle: `nouveau-${Date.now()}-${ls.length}` }]);
    setModifie(true);
  }

  async function enregistrer() {
    if (!ouvert) return;
    setEnregistre(true);
    try {
      await api(`/restaurants/${restoId}/menu/drafts/${ouvert.id}`, {
        method: 'PATCH', token, body: { name: ouvert.name.trim() || t('menuPage.draftsDefaultName'), items: pourLApi(lignes) }
      });
      setModifie(false);
      await charger();
      toast(t('menuPage.draftsSaved'));
    } catch (e) {
      toast(e.message);
    } finally {
      setEnregistre(false);
    }
  }

  async function publier(replaceExisting) {
    if (!publication) return;
    setPublieEnCours(true);
    try {
      // Le brouillon ouvert peut contenir des modifications non enregistrées : on les envoie d'abord,
      // sinon la publication repartirait de la version stockée et perdrait les dernières corrections.
      if (ouvert && ouvert.id === publication.id && modifie) {
        await api(`/restaurants/${restoId}/menu/drafts/${ouvert.id}`, {
          method: 'PATCH', token, body: { name: ouvert.name.trim() || t('menuPage.draftsDefaultName'), items: pourLApi(lignes) }
        });
        setModifie(false);
      }
      const r = await api(`/restaurants/${restoId}/menu/drafts/${publication.id}/publish`, {
        method: 'POST', token, body: { replaceExisting }
      });
      setPublication(null);
      await charger();
      onPublished?.();
      toast(t('menuPage.draftsPublishDone', { n: r.published }));
    } catch (e) {
      toast(e.message);
    } finally {
      setPublieEnCours(false);
    }
  }

  async function supprimer() {
    if (!suppression) return;
    try {
      await api(`/restaurants/${restoId}/menu/drafts/${suppression.id}`, { method: 'DELETE', token });
      if (ouvert?.id === suppression.id) setOuvert(null);
      setSuppression(null);
      await charger();
      toast(t('menuPage.draftsDeleted'));
    } catch (e) {
      toast(e.message);
    }
  }

  const platsValides = pourLApi(lignes).length;

  return (
    <div className="card" id="menu-brouillons">
      <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{t('menuPage.draftsTitle')}</h3>
      <p className="small" style={{ margin: '0 0 12px' }}>{t('menuPage.draftsIntro')}</p>

      {!chargement && brouillons.length === 0 && <p className="small" style={{ margin: '0 0 10px', opacity: 0.8 }}>{t('menuPage.draftsEmpty')}</p>}

      {brouillons.length > 0 && (
        <ul className="menu-staging-list">
          {brouillons.map((d) => (
            <li key={d.id}>
              <span className="menu-staging-icon" aria-hidden="true">🗂️</span>
              <span className="menu-staging-name">
                <b>{d.name}</b> <span className="small">— {t('menuPage.draftsCount', { n: d.itemCount })} · {t('menuPage.draftsUpdated', { date: dateCourte(d.updatedAt) })}</span>
                {d.publishedAt && <span className="pill teal" style={{ marginLeft: 6 }}>{t('menuPage.draftsPublishedOn', { date: dateCourte(d.publishedAt) })}</span>}
              </span>
              <button type="button" className="btn-outline" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => (ouvert?.id === d.id ? setOuvert(null) : ouvrir(d.id))}>
                {ouvert?.id === d.id ? t('menuPage.draftsClose') : t('menuPage.draftsOpen')}
              </button>
              <button type="button" className="btn-teal" style={{ padding: '4px 10px', fontSize: 13 }} disabled={!d.itemCount} onClick={() => setPublication(d)}>
                {t('menuPage.draftsPublishShort')}
              </button>
              <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px' }} onClick={() => setSuppression(d)} title={t('menuPage.draftsDelete')} aria-label={t('menuPage.draftsDelete')}>🗑️</button>
            </li>
          ))}
        </ul>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('menuPage.draftsNamePlaceholder')} style={{ flex: '1 1 200px', minWidth: 160 }} disabled={creation} />
        <button type="button" className="btn-outline" disabled={creation} onClick={() => creer(false)}>{creation ? '…' : t('menuPage.draftsNew')}</button>
        {menuCount > 0 && (
          <button type="button" className="btn-outline" disabled={creation} onClick={() => creer(true)}>{t('menuPage.draftsFromCurrent', { n: menuCount })}</button>
        )}
      </div>

      {ouvert && (
        <div className="card" style={{ marginTop: 12, padding: 12, border: '1px solid var(--line)' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={ouvert.name} onChange={(e) => { setOuvert((o) => ({ ...o, name: e.target.value })); setModifie(true); }}
              aria-label={t('menuPage.draftsNamePlaceholder')} style={{ flex: '1 1 200px', fontWeight: 700 }} />
            <span className="small">{t('menuPage.draftsCount', { n: platsValides })}</span>
            {modifie && <span className="small" style={{ color: 'var(--gold-dark, #8a6d1f)' }}>{t('menuPage.draftsUnsaved')}</span>}
          </div>

          {lignes.map((l) => (
            <div key={l.cle} className="row" style={{ gap: 6, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="row" style={{ gap: 6 }}>
                  <input style={{ flex: 2 }} value={l.name} onChange={(e) => majLigne(l.cle, 'name', e.target.value)} placeholder={t('menuPage.draftsItemName')} />
                  <input style={{ flex: 1, maxWidth: 110 }} type="number" step="0.1" min="0" value={l.price} onChange={(e) => majLigne(l.cle, 'price', e.target.value)} placeholder={t('menuPage.draftsItemPrice')} />
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <input style={{ flex: 1 }} value={l.category} onChange={(e) => majLigne(l.cle, 'category', e.target.value)} placeholder={t('menuPage.draftsItemSection')} />
                  <input style={{ flex: 1 }} value={l.subsection} onChange={(e) => majLigne(l.cle, 'subsection', e.target.value)} placeholder={t('menuPage.draftsItemSubsection')} />
                </div>
                <input value={l.desc} onChange={(e) => majLigne(l.cle, 'desc', e.target.value)} placeholder={t('menuPage.draftsItemDesc')} />
              </div>
              <button type="button" className="btn-danger-ghost" style={{ padding: '4px 8px' }} onClick={() => retirerLigne(l.cle)} title={t('menuPage.draftsRemoveItem')} aria-label={t('menuPage.draftsRemoveItem')}>🗑️</button>
            </div>
          ))}

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="btn-outline" onClick={ajouterLigne}>{t('menuPage.draftsAddItem')}</button>
            <button type="button" className="btn-teal" disabled={enregistre || !modifie} onClick={enregistrer}>{enregistre ? '…' : t('menuPage.draftsSave')}</button>
            <button type="button" className="btn-gold" disabled={!platsValides} onClick={() => setPublication({ id: ouvert.id, name: ouvert.name })}>{t('menuPage.draftsPublish')}</button>
            <button type="button" className="btn-ghost" onClick={() => setOuvert(null)}>{t('menuPage.draftsClose')}</button>
          </div>
        </div>
      )}

      {publication && (
        <div className="modal-overlay" onClick={() => !publieEnCours && setPublication(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('menuPage.draftsPublishTitle', { name: publication.name })}</h3>
            <p className="small" style={{ margin: '0 0 16px' }}>{t('menuPage.draftsPublishChoice')}</p>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-teal" disabled={publieEnCours} onClick={() => publier(false)}>{t('menuPage.draftsPublishAppend')}</button>
              <button type="button" className="btn-danger" disabled={publieEnCours} onClick={() => publier(true)}>{t('menuPage.draftsPublishReplace', { n: menuCount })}</button>
              <button type="button" className="btn-ghost" disabled={publieEnCours} onClick={() => setPublication(null)}>{t('menuPage.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {suppression && (
        <div className="modal-overlay" onClick={() => setSuppression(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>{t('menuPage.draftsDelete')}</h3>
            <p className="small" style={{ margin: '0 0 16px' }}>{t('menuPage.draftsDeleteConfirm', { name: suppression.name })}</p>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn-danger" onClick={supprimer}>{t('menuPage.draftsDelete')}</button>
              <button type="button" className="btn-ghost" onClick={() => setSuppression(null)}>{t('menuPage.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
