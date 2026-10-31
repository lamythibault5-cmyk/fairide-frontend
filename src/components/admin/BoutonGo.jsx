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
// Au-dessus, « Ouvrir l'à emporter » (fondateur, 2026-10-31 : plus aucune date, CarteEmporter plus bas) : même lecture
// (GET /admin/launch), puisque le GO ouvre aussi l'à emporter.
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

  // Lecture en échec : la carte reste, avec l'erreur et « Réessayer » (audit du 19/10, admin-49). Elle disparaissait sans
  // un mot, et l'équipe pouvait croire la livraison fermée, ou ne plus trouver « Refermer » pendant un incident.
  const [erreur, setErreur] = useState(null);
  const lire = () => api('/admin/launch', { token }).then((r) => { setEtat(r); setErreur(null); }).catch((e) => setErreur(e.message || tr('adminGo.loadError')));
  useEffect(() => { lire(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps -- lecture à l'arrivée

  async function basculer(go) {
    setEnCours(true);
    try {
      const r = await api('/admin/launch', { method: 'POST', token, body: { go, confirmation: go ? saisie.trim().toUpperCase() : undefined } });
      setEtat(r); setSaisie(''); setConfirmerFermeture(false);
      chargerLancement(); // le reste de la console (bandeau d'ouverture) suit tout de suite
      // Premier GO : les annonces partent en arrière-plan (admin-50) ; leur compte rendu arrive dans une tâche.
      toast(go ? (r.premierGo ? tr('adminGo.doneFirst') : tr('adminGo.doneOpen')) : tr('adminGo.doneClosed'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  if (!etat && erreur) {
    return (
      <section className="card" style={{ margin: '16px 0' }} aria-labelledby="bouton-go-titre">
        <h3 id="bouton-go-titre" style={{ margin: '0 0 6px', fontSize: 16 }}><Icone nom="scooter" taille={18} className="icone-texte" /> {tr('adminGo.title')}</h3>
        <p style={{ margin: '0 0 8px' }}><b>{tr('adminGo.unknownState')}</b></p>
        <p className="small texte-erreur" style={{ margin: '0 0 8px' }}>{erreur}</p>
        <button type="button" className="btn-outline" onClick={lire}>{tr('adminCommon.retry')}</button>
      </section>
    );
  }
  if (!etat) return null;
  // Tant que l'à emporter est fermé, la carte ne dit pas le contraire à l'équipe qui décide du GO (audit du 19/10, LIVE-08).
  const depuis = etat.goAt ? new Date(etat.goAt).toLocaleString(getLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  return (
    <>
    <CarteEmporter etat={etat} setEtat={setEtat} peutAppuyer={peutAppuyer} />
    <section className="card" style={{ borderColor: etat.go ? 'var(--line)' : 'var(--iris)', margin: '16px 0' }} aria-labelledby="bouton-go-titre">
      <h3 id="bouton-go-titre" style={{ margin: '0 0 6px', fontSize: 16 }}><Icone nom="scooter" taille={18} className="icone-texte" /> {tr('adminGo.title')}</h3>
      <p style={{ margin: '0 0 8px' }}><b>{etat.force ? tr('adminGo.forced') : etat.go ? tr('adminGo.open', { date: depuis }) : etat.emporter ? tr('adminGo.closed') : tr('adminGo.closedBeforePickup')}</b></p>
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
        title={tr('adminGo.title')} message={etat.livraisonsProgrammees > 0 ? `${tr('adminGo.confirmClose')} ${tr('adminGo.confirmCloseScheduled', { n: etat.livraisonsProgrammees })}` : tr('adminGo.confirmClose')} confirmLabel={tr('adminGo.closeButton')}
      />
    </section>
    </>
  );
}

/* « OUVRIR L'À EMPORTER » (fondateur, 2026-10-31 ; lancement.basculerEmporter et POST /admin/launch/pickup côté serveur).
 * L'à emporter payé sur place s'ouvrait seul le 1er novembre ; l'équipe n'était pas prête. Il s'ouvre maintenant ici, avant
 * le GO (ni livreur ni Stripe nécessaires). Ouvrir demande de taper EMPORTER (de vrais clients vont commander chez de vrais
 * commerces) ; refermer, une confirmation. Après le GO, il reste ouvert avec la livraison : pas de bouton pour le fermer seul
 * (le serveur le refuse, GO_OUVERT). */
function CarteEmporter({ etat, setEtat, peutAppuyer }) {
  const { t: tr } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [confirmerFermeture, setConfirmerFermeture] = useState(false);

  async function basculer(open) {
    setEnCours(true);
    try {
      const r = await api('/admin/launch/pickup', { method: 'POST', token, body: { open, confirmation: open ? saisie.trim().toUpperCase() : undefined } });
      setEtat(r); setSaisie(''); setConfirmerFermeture(false);
      chargerLancement(); // le bandeau d'ouverture de la console suit tout de suite
      toast(open ? (r.premiereOuverture ? tr('adminGo.pickupDoneFirst') : tr('adminGo.pickupDoneOpen')) : tr('adminGo.pickupDoneClosed'), 'succes');
    } catch (e) {
      toast(e.message, 'erreur');
    } finally {
      setEnCours(false);
    }
  }

  const depuis = etat.emporterAt ? new Date(etat.emporterAt).toLocaleString(getLocale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const ferme = !etat.emporter;
  return (
    <section className="card" style={{ borderColor: ferme ? 'var(--iris)' : 'var(--line)', margin: '16px 0' }} aria-labelledby="bouton-emporter-titre">
      <h3 id="bouton-emporter-titre" style={{ margin: '0 0 6px', fontSize: 16 }}><Icone nom="sac" taille={18} className="icone-texte" /> {tr('adminGo.pickupTitle')}</h3>
      <p style={{ margin: '0 0 8px' }}><b>{etat.force ? tr('adminGo.pickupForced') : etat.go ? tr('adminGo.pickupOpenWithGo') : ferme ? tr('adminGo.pickupClosed') : tr('adminGo.pickupOpen', { date: depuis })}</b></p>
      {ferme && <p className="small" style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>{tr('adminGo.pickupHint')}</p>}
      {!peutAppuyer ? (
        <p className="small" style={{ margin: 0 }}>{tr('adminGo.roleOnly')}</p>
      ) : etat.force || etat.go ? null : !ferme ? (
        <button type="button" className="btn-outline" disabled={enCours} onClick={() => setConfirmerFermeture(true)}>{tr('adminGo.pickupCloseButton')}</button>
      ) : (
        <form className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); if (saisie.trim().toUpperCase() === 'EMPORTER') basculer(true); }}>
          {!etat.emporterAt && <p className="small" style={{ margin: '0 0 4px', flexBasis: '100%' }}>{tr('adminGo.pickupFirstNote')}</p>}
          <label className="field" style={{ margin: 0 }}>
            <span className="field-intitule">{tr('adminGo.pickupConfirmLabel')}</span>
            <input value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" spellCheck={false} style={{ width: 130, textTransform: 'uppercase' }} aria-label={tr('adminGo.pickupConfirmLabel')} />
          </label>
          <button type="submit" className="btn-gold" disabled={enCours || saisie.trim().toUpperCase() !== 'EMPORTER'}>{enCours ? '...' : tr('adminGo.pickupOpenButton')}</button>
        </form>
      )}
      <ConfirmDialog
        open={confirmerFermeture} loading={enCours} danger
        onCancel={() => setConfirmerFermeture(false)} onConfirm={() => basculer(false)}
        title={tr('adminGo.pickupTitle')} message={tr('adminGo.pickupConfirmClose')} confirmLabel={tr('adminGo.pickupCloseButton')}
      />
    </section>
  );
}
