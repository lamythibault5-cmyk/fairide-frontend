import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getLocale, useLanguage } from '../../context/LanguageContext';
import useAdminRole from '../../hooks/useAdminRole';
import { chargerLancement } from '../../launch';
import ConfirmDialog from '../ConfirmDialog';
import Icone from '../Icone';

// LE BOUTON GO (fondateur, 2026-10-18 ; lancement.js et routes/adminLancement.js côté serveur) : la livraison et le
// paiement en ligne s'ouvrent quand l'équipe appuie, plus à une date. La carte montre d'abord combien de livreurs et de
// commerces sont prêts (mêmes contrôles que la commande et la course) et combien de livreurs sont libres à l'instant :
// c'est sur ces chiffres qu'on décide. Ouvrir demande de taper GO (de vrais clients vont payer) ; refermer, une
// confirmation. Le serveur réserve l'action au propriétaire et aux admins ; les autres rôles voient l'état sans bouton.
export default function BoutonGo() {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const { role } = useAdminRole();
  const [etat, setEtat] = useState(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmerFermeture, setConfirmerFermeture] = useState(false);
  const peutAppuyer = !role || role === 'owner' || role === 'admin';

  const lire = () => api('/admin/launch', { token }).then(setEtat).catch(() => setEtat((e) => e || null));
  useEffect(() => { lire(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps -- lecture à l'arrivée

  async function basculer(go) {
    setEnCours(true);
    try {
      const r = await api('/admin/launch', { method: 'POST', token, body: { go, confirmation: go ? saisie.trim().toUpperCase() : undefined } });
      setEtat(r); setSaisie(''); setConfirmerFermeture(false);
      chargerLancement(); // le reste de la console (bandeau d'ouverture) suit tout de suite
      toast(go ? (r.premierGo ? tr('adminGo.doneFirst', { envoyes: r.suites?.annonce?.envoyes ?? 0 }) : tr('adminGo.doneOpen')) : tr('adminGo.doneClosed'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  if (!etat) return null;
  const depuis = etat.goAt ? new Date(etat.goAt).toLocaleString(getLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <section className="card" style={{ borderColor: etat.go ? 'var(--line)' : 'var(--iris)', margin: '16px 0' }} aria-labelledby="bouton-go-titre">
      <h3 id="bouton-go-titre" style={{ margin: '0 0 6px', fontSize: 16 }}><Icone nom="scooter" taille={18} className="icone-texte" /> {tr('adminGo.title')}</h3>
      <p style={{ margin: '0 0 8px' }}><b>{etat.force ? tr('adminGo.forced') : etat.go ? tr('adminGo.open', { date: depuis }) : tr('adminGo.closed')}</b></p>
      <p className="small" style={{ margin: '0 0 4px' }}>
        {tr('adminGo.ready', { prets: etat.livreursPrets, total: etat.livreursTotal, commerces: etat.commercesPrets, commercesTotal: etat.commercesTotal, dispo: etat.livreursDisponiblesMaintenant })}
      </p>
      <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{tr('adminGo.readyHint')}</p>
      {!peutAppuyer ? (
        <p className="small" style={{ margin: 0 }}>{tr('adminGo.roleOnly')}</p>
      ) : etat.force ? null : etat.go ? (
        <button type="button" className="btn-outline" disabled={enCours} onClick={() => setConfirmerFermeture(true)}>{tr('adminGo.closeButton')}</button>
      ) : (
        <form className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); if (saisie.trim().toUpperCase() === 'GO') basculer(true); }}>
          {!etat.goAt && <p className="small" style={{ margin: '0 0 4px', flexBasis: '100%' }}>{tr('adminGo.firstGoNote')}</p>}
          <label className="field" style={{ margin: 0 }}>
            <span className="field-intitule">{tr('adminGo.confirmLabel')}</span>
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" spellCheck={false} style={{ width: 90, textTransform: 'uppercase' }} aria-label={tr('adminGo.confirmLabel')} />
          </label>
          <button type="submit" className="btn-gold" disabled={enCours || saisie.trim().toUpperCase() !== 'GO'}>{enCours ? '...' : tr('adminGo.goButton')}</button>
        </form>
      )}
      <ConfirmDialog
        open={confirmerFermeture} loading={enCours} danger
        onCancel={() => setConfirmerFermeture(false)} onConfirm={() => basculer(false)}
        title={tr('adminGo.title')} message={tr('adminGo.confirmClose')} confirmLabel={tr('adminGo.closeButton')}
      />
    </section>
  );
}
