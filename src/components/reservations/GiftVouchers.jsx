import { useEffect, useState } from 'react';
import { api } from '../../api';
import ConfirmDialog from '../ConfirmDialog';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { dateCourte, euros } from './resaUtils';

// BONS CADEAUX — vendus et encaissés par le restaurant lui-même (comptoir, virement) : création avec
// carte imprimable et envoi par e-mail, recherche par code ou nom, utilisation partielle au comptoir,
// annulation. Le client peut aussi saisir le code sur une commande Fairide chez ce commerce (le
// montant est déduit côté serveur, voir routes/orders.js). La vente en ligne attend l'ouverture des
// paiements : dit clairement en tête d'onglet.

const STATUTS = ['tous', 'active', 'used', 'expired', 'cancelled'];

function dateISO(d) { return d.toISOString().slice(0, 10); }

export default function GiftVouchers({ restoId, token, toast, restaurant }) {
  const { t } = useLanguage();
  const [liste, setListe] = useState(null);
  const [totaux, setTotaux] = useState(null);
  const [erreur, setErreur] = useState('');
  const [q, setQ] = useState('');
  const [statut, setStatut] = useState('tous');
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let annule = false;
    setErreur('');
    const params = new URLSearchParams(); if (q.trim()) params.set('q', q.trim()); if (statut !== 'tous') params.set('status', statut);
    api(`/restaurants/${restoId}/gift-vouchers?${params.toString()}`, { token })
      .then((d) => { if (!annule) { setListe(d.vouchers); setTotaux(d.totals); } })
      .catch((e) => { if (!annule) { setListe([]); setErreur(e.message); } });
    return () => { annule = true; };
  }, [restoId, token, q, statut, version]);

  const rafraichir = () => setVersion((v) => v + 1);

  return (
    <>
      <div className="card" style={{ borderColor: 'var(--gold)' }}>
        <p className="small" style={{ margin: 0 }}><b>{t('resa.gvOnlineSoonTitle')}</b> {t('resa.gvOnlineSoon')}</p>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15, flex: '1 1 auto' }}>{t('resa.gvTitle')}</h3>
          {totaux && <span className="small">{t('resa.gvTotals', { active: totaux.active, outstanding: euros(totaux.outstanding), sold: euros(totaux.sold) })}</span>}
          <button type="button" className="btn-teal" onClick={() => setCreation((c) => !c)}>{creation ? t('resa.close') : t('resa.gvNew')}</button>
        </div>
        {creation && <CreationBon restoId={restoId} token={token} toast={toast} restaurant={restaurant} onDone={(v) => { setCreation(false); rafraichir(); setOuvert(v); }} />}
        <div className="resa-outils">
          <div className="resa-recherche"><input value={q} placeholder={t('resa.gvSearchPh')} onChange={(e) => setQ(e.target.value)} aria-label={t('resa.gvSearchPh')} /></div>
          <div className="resa-filtres" role="group" aria-label={t('resa.filtersAria')}>
            {STATUTS.map((s) => <button key={s} type="button" className={statut === s ? 'actif' : ''} onClick={() => setStatut(s)}>{t(`resa.gvFilter_${s}`)}</button>)}
          </div>
        </div>
        <div className="bon-liste" style={{ marginTop: 10 }}>
          {liste === null && <p className="small">{t('resa.loading')}</p>}
          {erreur && <p className="small" style={{ color: 'var(--red)' }}>{erreur}</p>}
          {liste && liste.length === 0 && !erreur && (
            <div className="resa-vide"><b>{t('resa.gvEmptyTitle')}</b>{q.trim() || statut !== 'tous' ? t('resa.gvEmptyFiltered') : t('resa.gvEmptyHelp')}</div>
          )}
          {liste && liste.map((v) => (
            <button type="button" key={v.id} className="bon-ligne" onClick={() => setOuvert(v)}>
              <span className="bon-code">{v.code}</span>
              <span className={`bon-statut bon-statut-${v.status}`}>{t(`resa.gvStatus_${v.status}`)}</span>
              <span className="small">{v.recipientName ? t('resa.gvFor', { name: v.recipientName }) : v.buyerName ? t('resa.gvBoughtBy', { name: v.buyerName }) : ''}{v.expiresAt ? ` · ${t('resa.gvExpires', { date: new Date(`${v.expiresAt}T12:00:00`).toLocaleDateString(getLocale()) })}` : ''}</span>
              <span className="bon-montants"><b>{euros(v.remaining)}</b><br /><span className="small">{t('resa.gvOf', { amount: euros(v.amount) })}</span></span>
            </button>
          ))}
        </div>
      </div>

      {ouvert && <DetailBon bon={ouvert} restoId={restoId} token={token} toast={toast} restaurant={restaurant} onClose={() => setOuvert(null)} onChange={(v) => { setOuvert(v); rafraichir(); }} />}
    </>
  );
}

function CreationBon({ restoId, token, toast, onDone }) {
  const { t } = useLanguage();
  const dansUnAn = new Date(); dansUnAn.setFullYear(dansUnAn.getFullYear() + 1);
  const [f, setF] = useState({ amount: 50, buyerName: '', buyerEmail: '', recipientName: '', message: '', expiresAt: dateISO(dansUnAn), sendEmail: true });
  const [envoi, setEnvoi] = useState(false);
  const champ = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function creer(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      const v = await api(`/restaurants/${restoId}/gift-vouchers`, { method: 'POST', token, body: { ...f, amount: Number(f.amount), expiresAt: f.expiresAt || null } });
      toast(v.emailSent ? t('resa.gvCreatedSent', { email: f.buyerEmail }) : t('resa.gvCreated'));
      onDone(v);
    } catch (err) { toast(err.message); } finally { setEnvoi(false); }
  }

  return (
    <form onSubmit={creer} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 120px' }}>
          <label htmlFor="gv-montant">{t('resa.gvAmount')}</label>
          <input id="gv-montant" type="number" min="5" max="2000" step="5" value={f.amount} onChange={champ('amount')} required />
        </div>
        <div className="pill-row" style={{ flex: '1 1 200px', alignSelf: 'flex-end' }}>
          {[25, 50, 75, 100, 150].map((m) => <button key={m} type="button" className={`pill${Number(f.amount) === m ? ' gold' : ''}`} style={{ cursor: 'pointer', border: '1px solid var(--line)' }} onClick={() => setF((s) => ({ ...s, amount: m }))}>{m} €</button>)}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
        <div style={{ flex: '1 1 160px' }}>
          <label htmlFor="gv-acheteur">{t('resa.gvBuyer')}</label>
          <input id="gv-acheteur" value={f.buyerName} maxLength={80} onChange={champ('buyerName')} />
        </div>
        <div style={{ flex: '1 1 200px' }}>
          <label htmlFor="gv-email">{t('resa.gvBuyerEmail')}</label>
          <input id="gv-email" type="email" value={f.buyerEmail} maxLength={160} onChange={champ('buyerEmail')} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <label htmlFor="gv-benef">{t('resa.gvRecipient')}</label>
          <input id="gv-benef" value={f.recipientName} maxLength={80} onChange={champ('recipientName')} />
        </div>
        <div style={{ flex: '0 0 150px' }}>
          <label htmlFor="gv-expire">{t('resa.gvExpiry')}</label>
          <input id="gv-expire" type="date" value={f.expiresAt} onChange={champ('expiresAt')} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="gv-message">{t('resa.gvMessage')}</label>
        <input id="gv-message" value={f.message} maxLength={500} placeholder={t('resa.gvMessagePh')} onChange={champ('message')} />
      </div>
      <label className="row" style={{ gap: 8, cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={f.sendEmail} onChange={champ('sendEmail')} disabled={!f.buyerEmail} />
        <span className="small">{t('resa.gvSendEmail')}</span>
      </label>
      <p className="small" style={{ margin: '8px 0 0' }}>{t('resa.gvCreateHelp')}</p>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn-teal" disabled={envoi}>{envoi ? '…' : t('resa.gvCreate')}</button>
      </div>
    </form>
  );
}

function DetailBon({ bon, restoId, token, toast, restaurant, onClose, onChange }) {
  const { t } = useLanguage();
  const [detail, setDetail] = useState(bon.uses ? bon : null);
  const [montant, setMontant] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(bon.buyerEmail || '');
  const [enCours, setEnCours] = useState(null);
  const [annulation, setAnnulation] = useState(false);
  const [confirmerUsage, setConfirmerUsage] = useState(false);
  const v = detail || bon;

  useEffect(() => {
    let annule = false;
    api(`/restaurants/${restoId}/gift-vouchers/${bon.id}`, { token }).then((d) => { if (!annule) setDetail(d); }).catch((e) => toast(e.message));
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bon.id]);

  async function utiliser() {
    setEnCours('usage');
    try {
      const maj = await api(`/restaurants/${restoId}/gift-vouchers/${bon.id}/redeem`, { method: 'POST', token, body: { amount: Number(montant), note } });
      setDetail(maj); onChange(maj); setMontant(''); setNote('');
      toast(t('resa.gvRedeemed', { amount: euros(Number(montant)) }));
    } catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  async function changerStatut(status) {
    setEnCours('statut');
    try { const maj = await api(`/restaurants/${restoId}/gift-vouchers/${bon.id}`, { method: 'PATCH', token, body: { status } }); setDetail((d) => ({ ...(d || bon), ...maj })); onChange(maj); toast(status === 'cancelled' ? t('resa.gvCancelled') : t('resa.gvReactivated')); }
    catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  async function envoyer() {
    setEnCours('email');
    try { await api(`/restaurants/${restoId}/gift-vouchers/${bon.id}/send`, { method: 'POST', token, body: { email } }); toast(t('resa.gvEmailSent', { email })); }
    catch (e) { toast(e.message); } finally { setEnCours(null); }
  }
  function imprimer() {
    const zone = document.getElementById(`bon-print-${bon.id}`);
    if (!zone) return;
    const w = window.open('', '_blank', 'width=700,height=600');
    if (!w) { toast(t('resa.gvPopupBlocked')); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${t('resa.gvPrintTitle')}</title><style>body{font-family:sans-serif;padding:24px;color:#14121F}.bon-carte{border:2px solid #14121F;border-radius:16px;padding:22px 24px;max-width:460px;position:relative}.bon-carte-resto{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#6B655D}.bon-carte-titre{font-size:22px;font-weight:800;margin:4px 0 10px}.bon-carte-montant{font-size:40px;font-weight:900;line-height:1;color:#3B2FB5}.bon-carte-code{margin:14px 0 8px;font-family:monospace;font-size:20px;font-weight:800;letter-spacing:.12em;padding:8px 12px;border:1px dashed #14121F;border-radius:10px;display:inline-block}.bon-carte-message{font-style:italic;margin:8px 0}.bon-carte-pied{font-size:12px;color:#6B655D;margin-top:8px}</style></head><body>${zone.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); }, 250);
  }
  const actif = v.status === 'active';

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, flex: 1 }}>{t('resa.gvDetailTitle', { code: v.code })}</h3>
        <span className={`bon-statut bon-statut-${v.status}`}>{t(`resa.gvStatus_${v.status}`)}</span>
        <button type="button" className="btn-ghost" onClick={onClose}>{t('resa.close')}</button>
      </div>

      <div id={`bon-print-${bon.id}`}>
        <div className="bon-carte">
          <div className="bon-carte-resto">{restaurant?.name}</div>
          <div className="bon-carte-titre">{t('resa.gvCardTitle')}</div>
          <div className="bon-carte-montant">{euros(v.amount)}</div>
          {v.recipientName && <div style={{ marginTop: 8 }}>{t('resa.gvCardFor', { name: v.recipientName })}</div>}
          {v.message && <div className="bon-carte-message">« {v.message} »</div>}
          <div className="bon-carte-code">{v.code}</div>
          <div className="bon-carte-pied">
            {v.expiresAt ? t('resa.gvCardValidUntil', { date: new Date(`${v.expiresAt}T12:00:00`).toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) }) : t('resa.gvCardNoExpiry')}
            {' · '}{t('resa.gvCardHow')}
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" className="btn-outline" onClick={imprimer}>{t('resa.gvPrint')}</button>
        <input type="email" value={email} placeholder={t('resa.gvBuyerEmail')} maxLength={160} onChange={(e) => setEmail(e.target.value)} style={{ flex: '1 1 180px', maxWidth: 260 }} aria-label={t('resa.gvBuyerEmail')} />
        <button type="button" className="btn-outline" disabled={!email || enCours === 'email'} onClick={envoyer}>{enCours === 'email' ? '…' : t('resa.gvSendByEmail')}</button>
      </div>

      <p className="small" style={{ margin: '10px 0 0' }}>
        {t('resa.gvRemaining', { remaining: euros(v.remaining), amount: euros(v.amount) })}
        {v.buyerName ? ` · ${t('resa.gvBoughtBy', { name: v.buyerName })}` : ''} · {t('resa.gvCreatedOn', { date: dateCourte(v.createdAt) })}
      </p>

      {actif && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          <b className="small">{t('resa.gvRedeemTitle')}</b>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
            <div style={{ flex: '0 0 130px' }}>
              <label htmlFor={`gv-use-${bon.id}`}>{t('resa.gvRedeemAmount')}</label>
              <input id={`gv-use-${bon.id}`} type="number" min="0.5" max={v.remaining} step="0.5" value={montant} onChange={(e) => setMontant(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label htmlFor={`gv-note-${bon.id}`}>{t('resa.gvRedeemNote')}</label>
              <input id={`gv-note-${bon.id}`} value={note} maxLength={200} placeholder={t('resa.gvRedeemNotePh')} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="button" className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setMontant(String(v.remaining))}>{t('resa.gvRedeemAll')}</button>
            <button type="button" className="btn-teal" disabled={!Number(montant) || Number(montant) > v.remaining || enCours === 'usage'} onClick={() => setConfirmerUsage(true)}>{enCours === 'usage' ? '…' : t('resa.gvRedeem')}</button>
          </div>
        </div>
      )}

      <div className="bon-usages">
        <b className="small">{t('resa.gvUsesTitle')}</b>
        {!detail && <p className="small" style={{ margin: '4px 0 0' }}>{t('resa.loading')}</p>}
        {detail && detail.uses.length === 0 && <p className="small" style={{ margin: '4px 0 0' }}>{t('resa.gvUsesNone')}</p>}
        {detail && detail.uses.map((u) => (
          <div key={u.id}><span>{dateCourte(u.createdAt)} · {u.orderId ? t('resa.gvUseOrder') : u.note || t('resa.gvUseCounter')}</span><b>{u.amount < 0 ? '+' : '-'}{euros(Math.abs(u.amount))}</b></div>
        ))}
      </div>

      <div className="row" style={{ gap: 6, marginTop: 10 }}>
        {actif && <button type="button" className="btn-ghost" style={{ color: 'var(--red)' }} disabled={!!enCours} onClick={() => setAnnulation(true)}>{t('resa.gvCancel')}</button>}
        {v.status === 'cancelled' && <button type="button" className="btn-ghost" disabled={!!enCours} onClick={() => changerStatut('active')}>{t('resa.gvReactivate')}</button>}
      </div>
      <ConfirmDialog open={annulation} danger title={t('resa.gvCancelTitle')} message={t('resa.gvCancelMsg', { code: v.code })} confirmLabel={t('resa.gvCancel')}
        onCancel={() => setAnnulation(false)} onConfirm={() => { setAnnulation(false); changerStatut('cancelled'); }} />
      <ConfirmDialog open={confirmerUsage} title={t('resa.gvRedeemTitle')} message={t('resa.gvRedeemConfirm', { amount: euros(Number(montant) || 0), code: v.code })} confirmLabel={t('resa.gvRedeem')}
        onCancel={() => setConfirmerUsage(false)} onConfirm={() => { setConfirmerUsage(false); utiliser(); }} />
    </div>
  );
}
