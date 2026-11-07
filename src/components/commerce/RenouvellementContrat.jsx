import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useLanguage } from '../../context/LanguageContext';
import { vibrer } from '../../gestes';
import { euros } from '../../prixPlat';
import { EVENEMENT_CONDITIONS_ACCEPTEES, exempleHausse } from '../../conformite';

/* NOUVELLE VERSION DU CONTRAT, UN BOUTON (fondateur, 2026-11-02 : « make it easy for them to sign it again, a clear button »).
 * En tête de Commandes, comme les plats manquants (ReclamationsCommerce.jsx) : pour un commerce qui a accepté une version
 * antérieure, ce qui change pour lui, et un bouton lime « Accepter la nouvelle version ». Avant, il fallait trouver l'étape
 * « Signe tes engagements » (useMiseEnLigne.js, montrée surtout avant la mise en ligne), puis cocher et taper son nom.
 *
 * Ce que vaut le toucher : le nom est celui qu'il a tapé à sa dernière acceptation (contract_accepted_name), écrit sous le
 * bouton avec la version et « dès maintenant » ; le serveur l'horodate avec l'IP et l'empreinte du PDF, comme la case et le nom
 * (signature électronique simple, routes/restaurants.js). Ce bouton, ainsi libellé, est aussi l'« action claire et
 * affirmative » par laquelle il renonce au préavis (règlement P2B art. 3 §2) quand la version s'applique sans préavis. Sans
 * nom connu, le bouton mène à la page Engagements (case et nom). Le texte entier reste à un toucher (« Lire le contrat »).
 *
 * RESTO-2026.22 : un commerce à +10 % passe à +11,11 % en acceptant (serveur, hausseAuNouveauPlafond) ; la carte le dit avec
 * l'exemple de 10 €. L'équipe en « agir pour » voit la carte sans le bouton : elle ne signe jamais à la place du commerce.
 *
 * Depuis le 06/11 (maquettes/nouvelles-conditions), le commerce voit d'abord l'écran plein « On a mis à jour ton contrat »
 * (NouvellesConditions.jsx) à l'ouverture. Cette carte reste pour qui y a répondu « Je n'accepte pas » : sa clause
 * « Modification du contrat » annonce la nouvelle version en tête de Commandes. Accepté sur l'écran : elle se retire. */
export default function RenouvellementContrat({ restoId, token, toast, lectureSeule, onChange }) {
  const { t, locale } = useLanguage();
  const [contrat, setContrat] = useState(null);
  const [hausse, setHausse] = useState(null);
  const [tout, setTout] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  useEffect(() => {
    if (!restoId || !token) return undefined;
    let annule = false;
    api(`/restaurants/${restoId}/contract`, { token }).then((c) => { if (!annule) setContrat(c); }).catch(() => {});
    api(`/restaurants/${restoId}/price-markup`, { token }).then((h) => { if (!annule) setHausse(h); }).catch(() => {});
    return () => { annule = true; };
  }, [restoId, token]);
  // Acceptée sur l'écran plein : la carte se retire.
  useEffect(() => {
    const accepte = (e) => { if (e.detail?.role === 'restaurant') setFait(true); };
    window.addEventListener(EVENEMENT_CONDITIONS_ACCEPTEES, accepte);
    return () => window.removeEventListener(EVENEMENT_CONDITIONS_ACCEPTEES, accepte);
  }, []);

  if (fait || !contrat?.acceptedAt || !contrat.acceptedVersion || contrat.acceptedVersion === contrat.version) return null;
  const nom = String(contrat.acceptedName || contrat.responsibleName || '').trim();
  const ex = exempleHausse(hausse);
  const pct = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });
  const changements = Array.isArray(contrat.changes) ? contrat.changes : [];

  async function accepter() {
    vibrer();
    setEnCours(true);
    try {
      const r = await api(`/restaurants/${restoId}/contract/accept`, { method: 'POST', token, body: { typedName: nom, readConfirmed: true, renonciationPreavis: contrat.sansPreavis || undefined } });
      vibrer('succes');
      toast(r.markupRaisedTo ? t('renouvellementContrat.toastHausse', { p: pct(r.markupRaisedTo) }) : t('renouvellementContrat.toast'), 'succes');
      setFait(true);
      await onChange?.();
    } catch (e) { toast(e.message, 'erreur'); } finally { setEnCours(false); }
  }

  return (
    <section className="ec-renouvellement" aria-labelledby="ec-renouvellement-titre">
      <b id="ec-renouvellement-titre" className="ec-renouvellement-titre">{t('renouvellementContrat.titre')}</b>
      <p className="ec-aide">{t('renouvellementContrat.sous', { version: contrat.version })}</p>
      {ex && (
        <p className="ec-renouvellement-hausse">
          {t('renouvellementContrat.hausse', { p: pct(ex.p), affiche: euros(ex.affiche), recu: euros(ex.recu) })}
        </p>
      )}
      {changements.length > 0 && (
        <>
          <button type="button" className="ec-lien" aria-expanded={tout} onClick={() => setTout(!tout)}>
            {tout ? t('renouvellementContrat.masquer') : t('renouvellementContrat.voir', { n: changements.length })}
          </button>
          {tout && <ul className="small ec-renouvellement-liste">{changements.map((c) => <li key={c}>{c}</li>)}</ul>}
        </>
      )}
      {!lectureSeule && (nom.length >= 3 ? (
        <>
          <button type="button" className="ec-bouton ec-bouton--lime" disabled={enCours} onClick={accepter}>
            {enCours ? '…' : t('renouvellementContrat.bouton')}
          </button>
          <p className="ec-aide ec-renouvellement-mention">{t('renouvellementContrat.mention', { version: contrat.version, nom })}</p>
        </>
      ) : (
        <Link className="ec-bouton ec-bouton--lime" to="/dashboard/engagements">{t('renouvellementContrat.bouton')}</Link>
      ))}
      <Link className="ec-lien" to="/dashboard/engagements">{t('renouvellementContrat.lire')}</Link>
    </section>
  );
}
