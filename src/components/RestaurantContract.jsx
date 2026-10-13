import { useEffect, useState } from 'react';
import { api, API_BASE } from '../api';
import { ouvrirPdf, telechargerPdf } from '../pdf';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage, getLocale } from '../context/LanguageContext';
import Icone from './Icone';

// « Mon contrat avec Fairide » dans Mon compte (restaurateur) : le contrat de partenariat, groupé en quatre
// blocs (cadre, engagements de Fairide, engagements du commerce, argent), le PDF, et l'acceptation en ligne
// (nom tapé, horodatée, empreinte). Le texte vient du serveur (restaurantContract.js) : une seule version,
// en français, qui fait foi et qui reprend les chiffres réellement appliqués par la plateforme.

// Ordre de lecture : ce que chacun s'engage à faire, l'argent, puis le cadre et les dispositions
// générales (données, confidentialité, durée, responsabilité, droit applicable).
const GROUPES = ['fairide', 'commerce', 'argent', 'cadre', 'general'];

// onAccepte : prévenir la page (Mon compte) pour qu'elle recharge le commerce — visibilité et abonnement en dépendent.
export default function RestaurantContract({ restoId, onAccepte }) {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [ouverts, setOuverts] = useState(() => new Set(['fairide', 'commerce']));
  // Plus d'obligation d'ouvrir chaque partie avant d'accepter (fondateur, 12 oct. 2026 : « que des cases à cocher ») :
  // le texte entier reste à un clic et téléchargeable, c'est ce que le droit demande ; le parcours forcé, lui, n'ajoutait
  // que de la friction. Même chose pour la signature dessinée : nom tapé + case cochée suffisent (eIDAS art. 25).
  const [nom, setNom] = useState('');
  const [lu, setLu] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api(`/restaurants/${restoId}/contract`, { token }).then((r) => { setD(r); setNom(r.responsibleName || user?.name || ''); }).catch((e) => setErreur(e.message)); }, [restoId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function accepter() {
    if (!lu) { toast(t('restoContract.errRead'), 'erreur'); return; }
    if (!nom.trim()) { toast(t('restoContract.errName'), 'erreur'); return; }
    setBusy(true);
    try { const r = await api(`/restaurants/${restoId}/contract/accept`, { method: 'POST', token, body: { typedName: nom.trim(), readConfirmed: true } }); setD(r); toast(t('restoContract.accepted')); onAccepte?.(); } catch (e) { toast(e.message, 'erreur'); } finally { setBusy(false); }
  }
  const basculer = (g) => {
    setOuverts((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  };

  if (erreur) return <p className="small">{erreur}</p>;
  if (!d) return <p className="small">{t('accountUi.loading')}</p>;
  if (!Array.isArray(d.clauses) || !d.summary) return <p className="small">{t('restoContract.pdfFailed')}</p>;

  return (
    <div className="resto-contract">
      <p className="small" style={{ margin: '0 0 10px' }}>{t('restoContract.intro', { version: d.version })}</p>

      {/* Les chiffres qui comptent, en un coup d'œil */}
      <div className="stat-grid" style={{ marginBottom: 12 }}>
        <div className="stat-card"><div className="num">{d.summary.commissionPct} %</div><div className="label">{t('restoContract.kCommission')}</div></div>
        <div className="stat-card"><div className="num">{d.summary.subscription} €</div><div className="label">{t('restoContract.kSubscription')}</div></div>
        <div className="stat-card highlight"><div className="num">{t('restoContract.kMonday')}</div><div className="label">{t('restoContract.kPayout')}</div></div>
        <div className="stat-card"><div className="num">0 %</div><div className="label">{t('restoContract.kDelivery')}</div></div>
      </div>

      {d.acceptedAt && d.acceptedVersion && d.acceptedVersion !== d.version && (
        <div className="paiement-encart" style={{ marginBottom: 12, borderLeft: '4px solid var(--gold, #d9a441)' }}>
          <b><Icone nom="etoile" taille={16} className="icone-texte" />{' '}{t('restoContract.newVersion', { version: d.version })}</b>
          <p className="small" style={{ margin: '4px 0 0' }}>{t('restoContract.newVersionHelp', { old: d.acceptedVersion, date: new Date(d.acceptedAt).toLocaleDateString(getLocale()) })}</p>
          {/* Ce qui change, en clair (texte français du contrat, celui qui fait foi) : exigé par la clause « Modification du contrat ». */}
          {Array.isArray(d.changes) && d.changes.length > 0 && (
            <>
              <p className="small" style={{ margin: '8px 0 2px' }}><b>{t('restoContract.whatChanges')}</b></p>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {d.changes.map((c) => <li key={c} style={{ margin: '2px 0' }}>{c}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
      {d.acceptedAt && (!d.acceptedVersion || d.acceptedVersion === d.version) ? (
        <div className="paiement-encart" style={{ marginBottom: 12 }}>
          <b><Icone nom="valider" taille={16} className="icone-texte" />{' '}{t('restoContract.acceptedOn', { date: new Date(d.acceptedAt).toLocaleDateString(getLocale()), name: d.acceptedName })}</b>
          <p className="small" style={{ margin: '4px 0 0', overflowWrap: 'anywhere' }}>{t('restoContract.version', { version: d.acceptedVersion || d.version })}{d.hash ? ` · ${t('restoContract.hash')} ${d.hash.slice(0, 16)}…` : ''}</p>
          {d.signatureUrl && <img src={d.signatureUrl} alt={t('signature.aria')} style={{ display: 'block', maxWidth: 220, maxHeight: 90, marginTop: 8, background: '#fff', border: '1px solid var(--line, #e1d9c4)', borderRadius: 8 }} />}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" className="btn-outline btn-sm" onClick={() => ouvrirPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, t('restoContract.pdfFailed'))}><Icone nom="document" taille={16} className="icone-texte" />{' '}{t('restoContract.openPdf')}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => telechargerPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, 'contrat-fairide.pdf', t('restoContract.pdfFailed'))}><Icone nom="telecharger" taille={16} className="icone-texte" />{' '}{t('restoContract.savePdf')}</button>
          </div>
        </div>
      ) : (
        <div className="paiement-encart" style={{ marginBottom: 12 }}>
          <b><Icone nom="crayon" taille={16} className="icone-texte" />{' '}{t('restoContract.toAccept')}</b>
          <p className="small" style={{ margin: '4px 0 8px' }}>{t('restoContract.toAcceptHelp')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline btn-sm" onClick={() => ouvrirPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, t('restoContract.pdfFailed'))}><Icone nom="document" taille={16} className="icone-texte" />{' '}{t('restoContract.readPdf')}</button>
            <button type="button" className="btn-outline btn-sm" onClick={() => telechargerPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, 'contrat-fairide.pdf', t('restoContract.pdfFailed'))}><Icone nom="telecharger" taille={16} className="icone-texte" />{' '}{t('restoContract.savePdf')}</button>
          </div>
        </div>
      )}

      {GROUPES.map((g) => (
        <div key={g} className="resto-contract-groupe">
          <button type="button" className="resto-contract-tete" onClick={() => basculer(g)} aria-expanded={ouverts.has(g)}>
            <span>{t(`restoContract.group_${g}`)}</span>
            <span aria-hidden="true" style={{ transform: ouverts.has(g) ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
          </button>
          {ouverts.has(g) && (
            <ol className="resto-contract-clauses">
              {d.clauses.filter((c) => c.partie === g).map((c) => (
                <li key={c.titre}><b>{c.titre}.</b> {c.corps}</li>
              ))}
            </ol>
          )}
        </div>
      ))}

      {(!d.acceptedAt || (d.acceptedVersion && d.acceptedVersion !== d.version)) && (
        <div className="paiement-encart" style={{ marginTop: 12 }}>
          <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} style={{ marginTop: 3 }} />
            <span className="small">{t('restoContract.readCheck')}</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 200px', margin: 0 }}>
              <label htmlFor="resto-contract-nom">{t('restoContract.typedName')}</label>
              <input id="resto-contract-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t('restoContract.typedNamePh')} />
            </div>
            <button type="button" className="btn-gold" disabled={busy || !lu || nom.trim().length < 3} style={{ alignSelf: 'flex-end' }} onClick={accepter}>{busy ? '…' : t('restoContract.acceptBtn')}</button>
          </div>
        </div>
      )}
      <p className="small" style={{ margin: '10px 0 0', opacity: 0.8 }}>{t('restoContract.foot')}</p>
    </div>
  );
}
