import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { euros } from '../../prixPlat';
import urlSure from '../../urlSure';
import Modale from '../Modale';
import ReasonDialog from './ReasonDialog';

/* ADMIN › CARTES › « HAUSSES À VÉRIFIER » ET « CHANGEMENTS DE TEXTE » (Owen, 2026-11-08, maquettes/carte-hausses, la console de
 * l'équipe dans les rangées B et dans la section 3). Le commerce monte un prix avec une photo de son tableau des prix : le
 * prix est déjà en ligne, l'équipe regarde la photo sous 48 h. « La photo montre ce prix » clôt ; « La photo ne montre pas ce
 * prix » demande une note (obligatoire : le commerce la lit sur sa carte) et lui ouvre son choix (ancien prix, autre photo,
 * ou le prix sans le badge). Délai passé sans réponse : le prix reste en ligne sur la parole du commerce, plus de refus ici
 * (décision 7). Les textes (nom, description, section) sont déjà en ligne : le journal sert à voir une hausse cachée
 * (« 2 steaks » devenu « 1 steak ») et à la remettre d'une touche. Les lignes du serveur sont lues prudemment (routes
 * backend admin/menu/hausses et admin/menu/textes, construites le même jour). */

const instant = (d) => { const n = typeof d === 'number' ? d : Date.parse(d); return Number.isFinite(n) ? n : 0; };
const dateCourte = (d) => (instant(d) ? new Date(instant(d)).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const liste = (r, ...cles) => (Array.isArray(r) ? r : cles.map((c) => r?.[c]).find(Array.isArray) || []);

export function HaussesAVerifier({ onChange }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [statut, setStatut] = useState('a_verifier');
  const [lignes, setLignes] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [aRefuser, setARefuser] = useState(null);
  const [envoi, setEnvoi] = useState(null);

  const charger = useCallback(() => {
    api(`/admin/menu/hausses?statut=${statut}`, { token })
      .then((r) => setLignes(liste(r, 'hausses', 'rows', 'declarations')))
      .catch((e) => { setLignes([]); toast(e.message, 'erreur'); });
  }, [statut, token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [charger]);

  async function verifier(l, ok, note) {
    setEnvoi(l.id);
    try {
      await api(`/admin/menu/hausses/${l.id}/verifier`, { method: 'POST', token, body: ok ? { ok: true } : { ok: false, note } });
      toast(ok ? tr('adminHausses.confirmeOk') : tr('adminHausses.refuseOk'), 'succes');
      setARefuser(null);
      charger();
      onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnvoi(null); }
  }

  const maintenant = Date.now();
  return (
    <div>
      <p className="small" style={{ margin: '0 0 10px', color: 'var(--ink-soft)' }}>{tr('adminHausses.haussesIntro')}</p>
      <div className="simu-filtres" style={{ display: 'flex', gap: 6, margin: '0 0 12px' }}>
        {['a_verifier', 'tout'].map((s) => (
          <button key={s} type="button" className={`chip${statut === s ? ' active' : ''}`} onClick={() => setStatut(s)}>{tr(s === 'tout' ? 'adminHausses.filtreTout' : 'adminHausses.filtreAVerifier')}</button>
        ))}
      </div>
      {!lignes && <p className="small">…</p>}
      {lignes && lignes.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminHausses.vide')}</p></div>}
      {(lignes || []).map((l) => {
        const supplement = l.kind === 'supplement_change' || !!l.optionItemId;
        const ancien = l.previousCounter ?? l.previousCounterPrice ?? l.previousPrice;
        const lu = (v) => (v === null || v === undefined ? '—' : `${supplement ? '+' : ''}${euros(v)}`);
        const echeance = instant(l.checkDueAt);
        const reste = echeance - maintenant;
        const aVerifier = l.checkStatus === 'a_verifier' || (!l.checkStatus && statut === 'a_verifier');
        // Délai passé : en ligne sur la parole du commerce, plus de refus (décision 7). « Sans réponse » vient du serveur.
        const passe = l.checkStatus === 'sans_reponse' || (aVerifier && echeance > 0 && reste <= 0);
        const heures = Math.floor(reste / 3600000);
        const minutes = Math.max(0, Math.floor((reste % 3600000) / 60000));
        return (
          <div key={l.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span>
                {l.restaurantId ? <Link to={`/admin/restaurants/${l.restaurantId}/menu`}><b>{l.restaurantName || '—'}</b></Link> : <b>{l.restaurantName || '—'}</b>}
                <span style={{ display: 'block' }}>{l.itemName}{supplement && <span className="print-etat attente" style={{ marginLeft: 6 }}>{tr('adminHausses.supplement')}</span>}</span>
              </span>
              <span className="small" style={{ color: passe ? 'var(--red-texte)' : 'var(--ink-soft)', fontWeight: 600 }}>
                {passe ? tr('adminHausses.delaiPasse')
                  : aVerifier && echeance ? (heures > 0 ? tr('adminHausses.reste', { h: heures, m: minutes }) : tr('adminHausses.resteMin', { m: minutes }))
                    : l.checkStatus ? <span className={`print-etat ${l.checkStatus === 'confirmee' ? 'ok' : l.checkStatus === 'refusee' ? 'erreur' : 'attente'}`}>{tr(`adminHausses.statut_${l.checkStatus}`)}</span> : null}
              </span>
            </div>
            <p style={{ margin: '8px 0 2px', fontSize: 18, fontWeight: 700 }}>
              {lu(ancien)} → {lu(l.counterPrice)}
              {l.shownPrice !== null && l.shownPrice !== undefined && Number(l.shownPrice) !== Number(l.counterPrice) && (
                <span className="small" style={{ fontWeight: 500, marginLeft: 8, color: 'var(--ink-soft)' }}>{tr('adminHausses.affiche', { prix: lu(l.shownPrice) })}</span>
              )}
            </p>
            <p className="small" style={{ margin: 0, color: 'var(--ink-soft)' }}>{tr('adminHausses.declare', { nom: l.declaredName || '—', date: dateCourte(l.declaredAt) })}</p>
            {l.checkNote && <p className="small" style={{ margin: '4px 0 0' }}>{tr('adminHausses.note', { note: l.checkNote })}</p>}
            {l.shopChoice && <p className="small" style={{ margin: '4px 0 0' }}>{tr(`adminHausses.choix_${l.shopChoice}`)}</p>}
            {l.proofUrl
              ? (
                <button type="button" onClick={() => setPhoto(l.proofUrl)} aria-label={tr('adminHausses.agrandir')}
                  style={{ display: 'block', margin: '10px 0 0', padding: 0, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'none', cursor: 'zoom-in' }}>
                  <img src={urlSure(l.proofUrl)} alt={tr('adminHausses.photoTitre')} style={{ display: 'block', width: 220, maxWidth: '100%', height: 150, objectFit: 'cover' }} />
                </button>
              )
              : <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>{tr('adminHausses.sansPhoto')}</p>}
            {aVerifier && (
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button type="button" className="btn-gold" disabled={envoi === l.id} onClick={() => verifier(l, true)}>{tr('adminHausses.ok')}</button>
                {!passe && (
                  <button type="button" className="btn-outline" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} disabled={envoi === l.id} onClick={() => setARefuser(l)}>{tr('adminHausses.non')}</button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {photo && (
        <Modale ariaLabel={tr('adminHausses.photoTitre')} onFermer={() => setPhoto(null)} largeur={720}>
          <img src={urlSure(photo)} alt={tr('adminHausses.photoTitre')} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 12 }} />
          <div className="modal-pied"><button type="button" className="btn-ghost" onClick={() => setPhoto(null)}>{tr('adminHausses.fermer')}</button></div>
        </Modale>
      )}
      <ReasonDialog open={!!aRefuser} title={aRefuser ? tr('adminHausses.refusTitre', { prix: `${aRefuser.kind === 'supplement_change' ? '+' : ''}${euros(aRefuser.counterPrice ?? 0)}` }) : ''}
        message={tr('adminHausses.refusTexte')} label={tr('adminHausses.refusNote')} placeholder={tr('adminHausses.refusExemple')} multiline danger
        confirmLabel={tr('adminHausses.non')} loading={!!envoi} onCancel={() => setARefuser(null)} onConfirm={(note) => verifier(aRefuser, false, note)} />
    </div>
  );
}

/* Les champs d'une ligne : ceux de haussesPrix.journalTextes (backend), before / after / changedAt. L'écran lisait beforeValue,
 * afterValue et createdAt, que le serveur n'envoie pas : chaque changement s'affichait « (vide) → (vide) », sans date (revue
 * avant GO, 13/11). */
const CHAMPS = { name: 'champ_name', desc: 'champ_desc', description: 'champ_desc', category: 'champ_category', subsection: 'champ_subsection' };

export function ChangementsTextes() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [lignes, setLignes] = useState(null);
  const [envoi, setEnvoi] = useState(null);

  const charger = useCallback(() => {
    api('/admin/menu/textes?jours=7', { token })
      .then((r) => setLignes(liste(r, 'changements', 'changes', 'rows')))
      .catch((e) => { setLignes([]); toast(e.message, 'erreur'); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [charger]);

  async function remettre(l) {
    setEnvoi(l.id);
    try {
      await api(`/admin/menu/textes/${l.id}/remettre`, { method: 'POST', token });
      toast(tr('adminHausses.remisOk'), 'succes');
    } catch (e) {
      // 409 : le commerce a changé ce champ depuis ; le serveur le dit (« Le commerce l'a changé depuis »), la liste se relit.
      toast(e.message, 'erreur');
    } finally { setEnvoi(null); charger(); }
  }

  const valeur = (v) => (v === null || v === undefined || v === '' ? <i style={{ color: 'var(--ink-faint)' }}>{tr('adminHausses.videValeur')}</i> : v);
  return (
    <div>
      <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{tr('adminHausses.textesIntro')}</p>
      {!lignes && <p className="small">…</p>}
      {lignes && lignes.length === 0 && <div className="card"><p className="small" style={{ margin: 0 }}>{tr('adminHausses.textesVide')}</p></div>}
      {(lignes || []).map((l) => (
        <div key={l.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span>
              {l.restaurantId ? <Link to={`/admin/restaurants/${l.restaurantId}/menu`}><b>{l.restaurantName || '—'}</b></Link> : <b>{l.restaurantName || '—'}</b>}
              {l.itemName && <span style={{ display: 'block' }}>{l.itemName}</span>}
            </span>
            <span className="small" style={{ color: 'var(--ink-soft)' }}>{tr('adminHausses.par', { nom: l.changedByName || '—', date: dateCourte(l.changedAt) })}</span>
          </div>
          <p style={{ margin: '8px 0 0', overflowWrap: 'anywhere' }}>
            <b>{CHAMPS[l.field] ? tr(`adminHausses.${CHAMPS[l.field]}`) : l.field}</b>{' : '}
            <span style={{ color: 'var(--ink-soft)' }}>{valeur(l.before)}</span>{' → '}<span>{valeur(l.after)}</span>
          </p>
          {l.revertedAt
            ? <p className="small" style={{ margin: '8px 0 0', color: 'var(--ink-soft)' }}>{tr('adminHausses.remis', { date: dateCourte(l.revertedAt) })}</p>
            : <button type="button" className="btn-outline btn-sm" style={{ marginTop: 10 }} disabled={envoi === l.id} onClick={() => remettre(l)}>{tr('adminHausses.remettre')}</button>}
        </div>
      ))}
    </div>
  );
}
