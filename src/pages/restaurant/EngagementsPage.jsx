import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api, API_BASE } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { ouvrirPdf } from '../../pdf';
import { defilement, vibrer } from '../../gestes';
import Icone from '../../components/Icone';
import { BandeauCommerce, FeuilleCommerce, RetourCommerce, CocheTrait } from '../../components/commerce/BandeauCommerce';
import { SITE } from '../../components/commerce/CadreSite';

/* « TES ENGAGEMENTS » : UN ÉCRAN, UNE CASE, TON NOM (fondateur, 2026-10-27, test du commerce de test).
 *
 * « Signer » (étape « Signe tes engagements », useMiseEnLigne.js) menait à deux endroits selon le cas : Mon compte ›
 * « Mon contrat avec Fairride » (une feuille ouverte sur la page Compte déjà défilée, le contrat en cinq groupes dont deux
 * dépliés, la case tout en bas) ou, contrat accepté, au milieu de la page Ma carte (#conformite-carte, ConformiteCarte.jsx),
 * dans un long texte, sous un bandeau coupé. Owen : « je me retrouve au milieu d'un long texte, il faut une page claire qui
 * m'indique quoi faire ; quand je clique sur signer, je veux être emmené sur ce que je dois faire maintenant ».
 *
 * Ici, en haut d'une page à elle : ce qui reste à accepter (contrat de partenariat, procédure allergènes, déclaration de
 * vendeur professionnel), chacun en une ligne qui dit ce qu'il engage, le texte entier à un toucher ; puis la case et le nom.
 * Le bouton lime est toujours là : tant que la signature n'est pas à l'écran, il y descend (« Cocher et signer », l'idée
 * d'Owen : « un bouton lime qui descend jusqu'à la case, il n'a pas à réfléchir ») ; à la signature, il signe. Une fois
 * signé, retour à l'accueil (Commandes), dont la prochaine étape est la nouvelle carte du haut, avec son bouton lime.
 *
 * Rien ne change côté serveur : chaque texte garde sa route, sa version et son empreinte, envoyés l'un après l'autre comme
 * dans ConformiteCarte (qui reste sur Ma carte pour la signature de la carte et pour relire ce qui est signé). La carte
 * elle-même ne se signe pas ici : c'est « C'est bon » (étape « Relis et valide ta carte »). */
export default function EngagementsPage() {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { restaurant, restoId, loadDashboard, lectureSeule } = useOutletContext();
  const id = useId();
  const [contrat, setContrat] = useState(null);
  const [conf, setConf] = useState(null);
  const [erreur, setErreur] = useState('');
  const [ouvert, setOuvert] = useState(null);
  const [tel, setTel] = useState('');
  const [referent, setReferent] = useState('');
  const [nom, setNom] = useState('');
  const [coche, setCoche] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manque, setManque] = useState('');
  const [signatureVue, setSignatureVue] = useState(false);
  const signature = useRef(null);
  const champs = { tel: useRef(null), case: useRef(null), nom: useRef(null) };

  useEffect(() => {
    if (!restoId) return;
    Promise.all([api(`/restaurants/${restoId}/contract`, { token }), api(`/restaurants/${restoId}/compliance`, { token })])
      .then(([c, d]) => {
        setContrat(c);
        setConf(d);
        setNom((x) => x || c.responsibleName || restaurant?.responsibleName || '');
        setTel((x) => x || d.allergens?.contactPhone || d.allergens?.fallbackPhone || '');
        setReferent((x) => x || d.allergens?.referentName || '');
      })
      .catch((e) => setErreur(e.message));
  }, [restoId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // La signature à l'écran ou non : le bouton du bas y descend, ou s'efface pour laisser le bouton de la signature.
  useEffect(() => {
    const el = signature.current;
    if (!el || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setSignatureVue(e.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [contrat, conf]);

  if (!restaurant) return null;
  const traduit = (bloc) => (language !== 'fr' && bloc?.translations?.[language]) || null;
  const pro = conf?.professional;
  const aSigner = !contrat || !conf ? [] : [
    (!contrat.acceptedAt || (contrat.acceptedVersion && contrat.acceptedVersion !== contrat.version)) && 'contrat',
    !conf.allergens?.attestation?.attestedAt && 'allergenes',
    !(pro?.declaredAt && pro.upToDate !== false) && 'pro'
  ].filter(Boolean);

  function descendre(cle) {
    const el = champs[cle]?.current || signature.current;
    el?.scrollIntoView({ behavior: defilement(), block: 'center' });
    if (champs[cle]?.current) setTimeout(() => champs[cle].current?.focus({ preventScroll: true }), 350);
  }
  // Le premier point qui manque, dans l'ordre de l'écran ; null si tout est prêt.
  const premierManque = () => (aSigner.includes('allergenes') && !tel.trim() ? 'tel' : !coche ? 'case' : nom.trim().length < 3 ? 'nom' : null);

  async function signer() {
    const m = premierManque();
    if (m) { setManque(m); vibrer('attention'); descendre(m); return; }
    setManque('');
    setBusy(true);
    const typedName = nom.trim();
    try {
      // L'un après l'autre, comme ConformiteCarte : si l'un échoue, ceux d'avant restent signés et l'écran rechargé le montre.
      for (const quoi of aSigner) {
        if (quoi === 'contrat') await api(`/restaurants/${restoId}/contract/accept`, { method: 'POST', token, body: { typedName, readConfirmed: true } });
        if (quoi === 'allergenes') await api(`/restaurants/${restoId}/allergens/attest`, { method: 'POST', token, body: { typedName, confirmed: true, contactPhone: tel.trim(), referentName: referent.trim() } });
        if (quoi === 'pro') await api(`/restaurants/${restoId}/professional-declaration`, { method: 'POST', token, body: { typedName, confirmed: true } });
      }
      vibrer('succes');
      toast(t('engagementsCommerce.toast'), 'succes');
      await loadDashboard(restoId);
      // La suite : l'accueil, où la prochaine étape est en tête avec son bouton lime.
      navigate('/dashboard/orders', { replace: true });
    } catch (e) {
      toast(e.message, 'erreur');
      api(`/restaurants/${restoId}/compliance`, { token }).then(setConf).catch(() => {});
      api(`/restaurants/${restoId}/contract`, { token }).then(setContrat).catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const s = contrat?.summary;
  const textes = {
    contrat: {
      icone: 'contrat', titre: t('engagementsCommerce.contrat'),
      resume: s ? t('engagementsCommerce.contratResume', { pct: s.commissionPct, abo: s.subscription }) : '',
      note: contrat?.acceptedVersion && contrat.acceptedVersion !== contrat.version ? t('engagementsCommerce.contratNouveau', { version: contrat.version }) : '',
      lire: (
        <>
          {Array.isArray(contrat?.changes) && contrat.changes.length > 0 && contrat.acceptedVersion !== contrat.version && (
            <ul className="small">{contrat.changes.map((c) => <li key={c}>{c}</li>)}</ul>
          )}
          <ol className="resto-contract-clauses">{(contrat?.clauses || []).map((c) => <li key={c.titre}><b>{c.titre}.</b> {c.corps}</li>)}</ol>
          <button type="button" className="ec-lien" onClick={() => ouvrirPdf(`${API_BASE}/restaurants/${restoId}/contract/pdf`, token, t('restoContract.pdfFailed'))}>
            <Icone nom="document" taille={15} className="icone-texte" />{' '}{t('engagementsCommerce.pdf')}
          </button>
        </>
      )
    },
    allergenes: {
      icone: 'alerte', titre: t('conformite.allergenAttestTitle'), resume: t('engagementsCommerce.allergenesResume'),
      lire: <ul className="small">{(traduit(conf?.allergens?.attestation) || conf?.allergens?.attestation?.text || []).map((l) => <li key={l}>{l}</li>)}</ul>,
      champs: (
        <div className="eg-champs">
          <div className={`field${manque === 'tel' ? ' eg-manque' : ''}`}>
            <label htmlFor={`${id}-tel`}>{t('engagementsCommerce.tel')}</label>
            <input id={`${id}-tel`} ref={champs.tel} value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" autoComplete="tel" />
          </div>
          <div className="field">
            <label htmlFor={`${id}-ref`}>{t('conformite.allergenReferent')}</label>
            <input id={`${id}-ref`} value={referent} onChange={(e) => setReferent(e.target.value)} />
          </div>
        </div>
      )
    },
    pro: {
      icone: 'bouclier', titre: t('conformite.proTitle'), resume: t('engagementsCommerce.proResume'),
      note: pro?.declaredAt ? t('conformite.proNewVersion') : '',
      lire: <ul className="small">{(traduit(pro) || pro?.text || []).map((l) => <li key={l}>{l}</li>)}</ul>
    }
  };

  const pret = contrat && conf;
  const libelleBas = premierManque() ? t('engagementsCommerce.allerSigner') : t('engagementsCommerce.signer');
  return (
    <div className={SITE ? 'sp-page sp-page--lecture' : undefined}>
      <BandeauCommerce retour>
        <div className="ec-b-haut">
          <RetourCommerce />
          <span><b>{restaurant.name}</b></span>
        </div>
        <h1 className="ec-b-titre">{t('engagementsCommerce.titre')}</h1>
        <p className="ec-b-sous">{aSigner.length > 1 ? t('engagementsCommerce.sous', { n: aSigner.length }) : t('engagementsCommerce.sousUn')}</p>
      </BandeauCommerce>
      <FeuilleCommerce>
        {erreur && <p className="small" role="alert" style={{ color: 'var(--red)' }}>{erreur}</p>}
        {!pret && !erreur && <div className="skeleton" style={{ height: 180, borderRadius: 16 }} aria-busy="true" />}
        {pret && aSigner.length === 0 && (
          <div className="ec-prochaine">
            <span className="ec-coche"><CocheTrait taille={13} /></span>
            <span className="ec-prochaine-texte"><b>{t('engagementsCommerce.fait')}</b><span>{t('engagementsCommerce.faitSous')}</span></span>
          </div>
        )}
        {pret && aSigner.length === 0 && (
          <button type="button" className="ec-bouton ec-bouton--lime" onClick={() => navigate('/dashboard/orders', { replace: true })}>{t('engagementsCommerce.prochaine')}</button>
        )}
        {pret && aSigner.length > 0 && (
          <>
            <ol className="eg-liste">
              {aSigner.map((cle, k) => {
                const x = textes[cle];
                return (
                  <li key={cle} className="eg-texte">
                    <span className="eg-numero" aria-hidden="true">{k + 1}</span>
                    <div className="eg-corps">
                      <b className="eg-titre"><Icone nom={x.icone} taille={16} className="icone-texte" />{' '}{x.titre}</b>
                      {x.note && <p className="small eg-note">{x.note}</p>}
                      <p className="small eg-resume">{x.resume}</p>
                      <button type="button" className="ec-lien" aria-expanded={ouvert === cle} onClick={() => setOuvert(ouvert === cle ? null : cle)}>
                        {ouvert === cle ? t('engagementsCommerce.replier') : t('engagementsCommerce.lire')}
                      </button>
                      {ouvert === cle && <div className="eg-lire">{x.lire}</div>}
                      {x.champs}
                    </div>
                  </li>
                );
              })}
            </ol>

            <section ref={signature} className="eg-signature" aria-labelledby={`${id}-sig`}>
              <p className="ec-feuille-titre" id={`${id}-sig`}>{t('engagementsCommerce.signature')}</p>
              <label className={`eg-case${manque === 'case' ? ' eg-manque' : ''}`}>
                <input type="checkbox" ref={champs.case} checked={coche} onChange={(e) => { setCoche(e.target.checked); if (e.target.checked && manque === 'case') setManque(''); }} />
                <span>{t('engagementsCommerce.case')}</span>
              </label>
              <div className={`field${manque === 'nom' ? ' eg-manque' : ''}`}>
                <label htmlFor={`${id}-nom`}>{t('engagementsCommerce.nom')}</label>
                <input id={`${id}-nom`} ref={champs.nom} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
              </div>
              {manque && <p className="small eg-message" role="alert">{t(`engagementsCommerce.manque_${manque}`)}</p>}
              {/* « Agir pour » (console admin) : l'équipe voit l'écran, mais ne signe rien à la place du commerce. */}
              {!lectureSeule && (
                <button type="button" className="ec-bouton ec-bouton--lime" onClick={signer} disabled={busy}>
                  {/* Ce qu'on signe, plus un chiffre entre parenthèses qui se lisait comme une quantité (S5 de maquettes/audit-ecrans). */}
                  {busy ? '…' : aSigner.length === 1 ? t(`engagementsCommerce.signer_${aSigner[0]}`) : t('engagementsCommerce.signerLes', { n: aSigner.length })}
                </button>
              )}
            </section>
            {/* Sur téléphone, tant que la signature n'est pas à l'écran : LE bouton lime, en bas, qui y descend. */}
            {!signatureVue && !lectureSeule && <div className="ec-espace-barre" aria-hidden="true" />}
            {!signatureVue && !lectureSeule && createPortal(
              <div className="ec-barre-accepter no-print">
                <button type="button" className="ec-bouton ec-bouton--lime" onClick={() => (premierManque() ? descendre(premierManque()) : signature.current?.scrollIntoView({ behavior: defilement(), block: 'center' }))}>
                  <span aria-hidden="true">↓</span>{libelleBas}
                </button>
              </div>,
              document.body
            )}
          </>
        )}
      </FeuilleCommerce>
    </div>
  );
}
