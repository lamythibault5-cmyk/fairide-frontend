import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, apiUpload } from '../api';
import { defilement } from '../gestes';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { euros } from '../prixPlat';
import { libellesAllergenes } from '../allergenes';
import usePageMeta from '../hooks/usePageMeta';
import Icone from '../components/Icone';
import { OptionCommande } from '../components/EcranCommande';
import { BandeauGeneral, FeuilleGenerale, SectionGenerale } from '../components/EcranGeneral';
import QuestionsCarte, { reponseAffichee } from '../components/commerce/QuestionsCarte';
import ListeEngagements from '../components/commerce/ListeEngagements';
import '../ecran-commerce.css';

/* « C'est bon » en un geste (CODE-3, 8 octobre 2026, DEC-25) — /carte/valider/:token.
 *
 * Ouverte depuis un lien envoyé par SMS, WhatsApp ou e-mail, ou depuis la bannière du terminal : sans compte, la carte
 * telle que Fairide l'a préparée, avec ses prix et ses taux de TVA, et UN gros bouton. Le gérant valide ce qu'il voit —
 * l'empreinte de la carte affichée part avec le clic, et le serveur refuse si la carte a changé entre-temps
 * (lienValidationCarte.js). Le nom du responsable est prérempli : c'est lui qui signe, il peut le corriger.
 * Une seule action lime sur la page (règle 3 de l'identité) : le bouton « C'est bon ».
 *
 * Carte aux prix MAGASIN vérifiés (prixMagasin.js côté serveur) : un choix avant de valider — garder ses prix, ou ajouter
 * la commission de Fairide sur toute la carte. La liste montre alors les prix qui seront signés (calculés par le serveur,
 * priceWithFairideRate), et le choix part avec « C'est bon ». Par défaut : garder — on ne monte pas ses prix sans un geste.
 *
 * Le dessin (fondateur, 2026-10-19, section 4 de finitions-appli.html) : bandeau iris (« Valider ma carte », le commerce)
 * et feuille blanche (EcranGeneral.jsx) — sur le site pour un visiteur, tout sur le blanc sous l'en-tête. Dans la feuille :
 * le choix du taux en deux cases (celles du paiement, OptionCommande), les plats en rangées à filet, puis l'engagement, le
 * nom et « C'est bon ». Le bloc de validation n'est plus collé en bas de l'écran : sur un téléphone il en couvrait la
 * moitié, et dans l'app connectée il passait sous la barre d'onglets. On le trouve après la carte — c'est-à-dire après
 * l'avoir parcourue, ce qu'on demande justement de faire.
 *
 * QUESTIONS AVANT LA CARTE (fondateur, 2026-10-20 ; questionsCarte.js côté serveur). Le lien arrive par e-mail ; s'il reste
 * des questions de Fairide sur la carte, la page les pose d'abord, à une touche (QuestionsCarte.jsx). Répondre ne
 * consomme pas le lien. Tant que les réponses ne sont pas reportées dans la carte, le même lien dit « on met ta carte à
 * jour » au lieu de « C'est bon » : signer une carte qui va encore changer bloquerait la commande ensuite.
 *
 * LE RACCOURCI VERS « C'EST BON » (fondateur, 2026-10-20, test avec Maestro Pizza : « le bouton est au bout d'une longue
 * liste, très pénible »). Le bloc de validation reste à sa place, après la carte (voir plus haut pourquoi il n'est plus
 * collé en bas). Tant qu'il est plus bas que l'écran, une pilule iris flotte en bas, au-dessus des onglets, comme celle
 * du panier : une touche descend jusqu'au bloc, où l'engagement, le nom et le vrai bouton se lisent ensemble. Elle ne
 * signe rien elle-même — on signe en voyant ce qu'on signe — et elle s'efface dès que le bloc entre à l'écran. */
export default function ValiderCarte() {
  const { token } = useParams();
  // Commerçant connecté (arrivé par la liste « Avant d'être en ligne ») : la page finie le ramène à son tableau de bord au
  // lieu de « tu peux fermer cette page », qui laissait l'appli sans issue. Lien reçu par SMS sans être connecté : inchangé.
  const { role, roles } = useAuth();
  const commercant = role === 'restaurant' || (Array.isArray(roles) && roles.includes('restaurant'));
  const { t, locale } = useLanguage();
  const id = useId();
  // Page à jeton : jamais indexée, jamais suivie (le lien est personnel).
  usePageMeta({ title: t('validerCarte.pageTitle'), robots: 'noindex, nofollow' });
  const [carte, setCarte] = useState(null);
  const [erreur, setErreur] = useState('');
  const [nom, setNom] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [fait, setFait] = useState(null);
  /* LES ENGAGEMENTS SUR LA MÊME PAGE (fondateur, 2026-11-07, maquettes/un-seul-lien, version A). Le serveur dit ce qui manque
   * encore des trois textes (contrat, procédure allergènes, déclaration de professionnel ; `carte.engagements`, null s'il ne
   * manque rien). Ils s'affichent entre la carte et « C'est bon », et une case + le nom signent le tout : plus de connexion, de
   * code SMS ni de page « Tes engagements » après la carte. Le numéro allergènes se remplit avec celui du commerce. */
  const [coche, setCoche] = useState(false);
  const [tel, setTel] = useState('');
  const [referent, setReferent] = useState('');
  const [manque, setManque] = useState('');
  const [toutSigne, setToutSigne] = useState(false);
  const champTel = useRef(null);
  const champCase = useRef(null);
  const eng = carte?.engagements?.aSigner?.length ? carte.engagements : null;
  // Ce qu'il reste au commerce après « C'est bon » ({ step, to, listed } ou null), renvoyé par le serveur avec la validation.
  const [suite, setSuite] = useState(null);
  const [ajouter, setAjouter] = useState(false);
  const [envoiQuestions, setEnvoiQuestions] = useState(false);
  // Les réponses qu'on vient d'envoyer, rappelées sur l'écran de remerciement (la page rechargée ne les a plus).
  const [rappel, setRappel] = useState(null);
  // Le bloc « C'est bon » et sa visibilité : la pilule-raccourci ne se montre que tant qu'il est encore sous l'écran.
  const blocValider = useRef(null);
  const [blocPlusBas, setBlocPlusBas] = useState(false);
  const choixOffert = !!carte?.fairideRateChoice?.offered;
  const rate = carte?.fairideRateChoice?.rate || 0;
  // Hausse qui rend au commerce son prix entier après la commission (11,1 % en franchise TVA), calculée par le serveur.
  const hausse = carte?.fairideRateChoice?.markup || 0;
  const pctLocal = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 2 });
  // La hausse proposée rend-elle le prix entier ? Oui au plafond (11,11 % pour 10 %, arrondi au 0,10 € supérieur) ; non pour
  // un commerce resté sur un contrat antérieur à RESTO-2026.22 (10 %) : le texte le dit au lieu de promettre le prix entier.
  const hausseEntiere = (r) => Math.round((r / (1 - r)) * 10000) / 100;
  const avecCommission = choixOffert && ajouter;
  const prixAVerifier = !!carte?.pricesToCheck;
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [photoEnvoyee, setPhotoEnvoyee] = useState(false);
  async function envoyerPhotos(fichiers) {
    if (!fichiers.length) return;
    setEnvoiPhoto(true);
    try {
      await apiUpload(`/menu-validation/${encodeURIComponent(token)}/photos`, { files: fichiers, fieldName: 'files' });
      setPhotoEnvoyee(true); setErreur('');
    } catch (e) { setErreur(e.message); } finally { setEnvoiPhoto(false); }
  }

  const charger = () => api(`/menu-validation/${encodeURIComponent(token)}`)
    .then((c) => {
      setCarte(c); setNom((n) => n || c.restaurant.responsibleName || ''); setErreur('');
      setTel((x) => x || c.engagements?.allergens?.contactPhone || c.engagements?.allergens?.fallbackPhone || '');
      setReferent((x) => x || c.engagements?.allergens?.referentName || '');
    })
    .catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function repondre(answers) {
    setEnvoiQuestions(true);
    try {
      const qs = carte.questions.open;
      await api(`/menu-validation/${encodeURIComponent(token)}/answers`, { method: 'POST', body: { answers, name: carte.restaurant.responsibleName || undefined } });
      setRappel(qs.map((q) => ({ id: q.id, question: q.question, reponse: reponseAffichee(q, answers.find((a) => a.id === q.id), t) })));
      await charger();
    } catch (e) { setErreur(e.message); } finally { setEnvoiQuestions(false); }
  }

  /* « C'EST BON » N'EST JAMAIS GRISÉ (fondateur, 2026-10-25, maquettes/une-action) : sans nom (3 lettres), le toucher amène au
     champ « Ton nom » au lieu d'un bouton mort. */
  const champNom = useRef(null);
  async function valider() {
    // Le premier point qui manque, dans l'ordre de l'écran : le numéro allergènes, la case, le nom. Même règle que « Tes
    // engagements » (EngagementsPage.jsx) ; sans engagements, seul le nom compte, comme avant.
    const m = eng?.aSigner.includes('allergenes') && !tel.trim() ? 'tel' : eng && !coche ? 'case' : nom.trim().length < 3 ? 'nom' : null;
    if (m) {
      setManque(m);
      const el = { tel: champTel, case: champCase, nom: champNom }[m].current;
      el?.focus(); el?.scrollIntoView({ block: 'center' });
      return;
    }
    setManque('');
    setEnvoi(true);
    try {
      const r = await api(`/menu-validation/${encodeURIComponent(token)}`, { method: 'POST', body: {
        name: nom, sha256: carte.sha256, ...(choixOffert ? { addFairideRate: ajouter } : {}),
        ...(eng ? { engagements: { accepte: coche, contactPhone: tel.trim(), referentName: referent.trim() } } : {})
      } });
      setSuite(r.next || null);
      // Carte et engagements signés : l'écran de fin le dit, il ne reste rien à signer.
      setToutSigne(!!(eng && r.signed?.length && !r.next));
      setFait(r.version);
    } catch (e) {
      setErreur(e.message);
      // Carte changée depuis l'ouverture : on recharge la version à jour, le gérant revalide ce qu'il voit.
      if (e.status === 409) charger();
    } finally { setEnvoi(false); }
  }

  // « C'est bon » se touche en bas d'une longue carte : sur le site, l'écran de fin s'affichait au même défilement, donc
  // hors de vue (un blanc et le pied de page). On remonte en haut pour qu'il se lise.
  useEffect(() => { if (fait) window.scrollTo(0, 0); }, [fait]);

  const avecCarte = !!carte && !fait && !carte.questions?.open?.length && !carte.questions?.waiting;
  useEffect(() => {
    const el = blocValider.current;
    if (!avecCarte || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(([e]) => setBlocPlusBas(!e.isIntersecting && e.boundingClientRect.top > 0));
    obs.observe(el);
    return () => obs.disconnect();
  }, [avecCarte]);
  const allerAuBloc = () => blocValider.current?.scrollIntoView({ behavior: defilement(), block: 'end' });

  const nomCommerce = carte?.restaurant?.name || '';
  if (fait) {
    return (
      <div className="gn-page">
        <BandeauGeneral icone="valider" titre={t(toutSigne ? 'validerCarte.doneAllTitle' : 'validerCarte.doneTitle')} sous={nomCommerce} />
        <FeuilleGenerale>
          <p className="gn-texte gn-texte--encre" role="status">
            {toutSigne
              ? t(commercant ? 'validerCarte.doneAllTextConnected' : 'validerCarte.doneAllText', { name: nomCommerce })
              : t(commercant || suite ? 'validerCarte.doneTextConnected' : 'validerCarte.doneText', { name: nomCommerce })}
          </p>
          {/* Il lui reste ses engagements (commerces inscrits avant le 13/10, ou nouveau contrat ; maquettes/etapes-commerce,
              option A) : la prochaine étape et le bouton qui y mène, connexion d'abord s'il ne l'est pas. */}
          {suite && (
            <>
              <p className="gn-texte">{t(suite.listed ? 'validerCarte.nextIntroListed' : 'validerCarte.nextIntro')}</p>
              <div className="ec-prochaine">
                <span className="ec-tuile"><Icone nom="contrat" taille={20} /></span>
                <span className="ec-prochaine-texte">
                  <small>{t('ecranCommerce.prochaineEtape')}</small>
                  <b>{t('miseEnLigne.commitments')}</b>
                  <span>{t('miseEnLigne.commitmentsSub')}</span>
                </span>
              </div>
              {commercant
                ? <Link to={suite.to} className="btn-gold gn-action">{t('validerCarte.nextContinue')}</Link>
                : (
                  <>
                    <Link to="/login" state={{ from: suite.to }} className="btn-gold gn-action">{t('validerCarte.nextSignIn')}</Link>
                    <Link to="/login?oubli=1" state={{ from: suite.to }} className="gn-lien">{t('auth.forgotPassword')}</Link>
                  </>
                )}
            </>
          )}
          {commercant && !suite && <Link to="/dashboard" className="btn-gold gn-action">{t('validerCarte.backToDashboard')}</Link>}
        </FeuilleGenerale>
      </div>
    );
  }
  if (!carte) {
    return (
      <div className="gn-page">
        <BandeauGeneral icone="document" titre={t('validerCarte.pageTitle')} />
        <FeuilleGenerale>
          {erreur
            ? <p className="gn-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}</p>
            : <p className="gn-texte" role="status">{t('validerCarte.loading')}</p>}
          {/* Lien expiré, remplacé ou déjà utilisé : plus d'impasse (audit du 19/10, shop-10). Le commerçant connecté rejoint
              Ma carte, où « Relire ma carte » fait un nouveau lien ; les autres se connectent pour y arriver. */}
          {erreur && (commercant
            ? <Link to="/dashboard/menu" className="btn-gold gn-action" style={{ marginTop: 18 }}>{t('validerCarte.openMenu')}</Link>
            : <Link to="/login" state={{ from: '/dashboard/menu' }} className="btn-gold gn-action" style={{ marginTop: 18 }}>{t('validerCarte.signIn')}</Link>)}
        </FeuilleGenerale>
      </div>
    );
  }

  const q = carte.questions || { open: [], waiting: 0, applied: 0 };
  if (q.open.length) {
    return (
      <div className="gn-page">
        <BandeauGeneral icone="bulle" titre={t('questionsCarte.title', { n: q.open.length })} sous={<b>{nomCommerce}</b>} />
        <FeuilleGenerale>
          <p className="gn-texte">{t('questionsCarte.intro', { n: q.open.length })}</p>
          {erreur && <p className="gn-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}</p>}
          <QuestionsCarte questions={q.open} onEnvoyer={repondre} envoi={envoiQuestions} />
        </FeuilleGenerale>
      </div>
    );
  }
  if (q.waiting) {
    return (
      <div className="gn-page">
        <BandeauGeneral icone="valider" titre={t('questionsCarte.thanksTitle')} sous={<b>{nomCommerce}</b>} />
        <FeuilleGenerale>
          <h2 className="qc-merci-titre">{t('questionsCarte.updatingTitle')}</h2>
          <p className="gn-texte" role="status">{t('questionsCarte.updatingText')}</p>
          {/* Le bouton AVANT le rappel des réponses (fondateur, 2026-10-27, comme « Merci pour ta commande ! ») : avec plusieurs
              réponses, il passait sous le bord de l'écran. */}
          {commercant && <Link to="/dashboard" className="btn-gold gn-action" style={{ marginTop: 18 }}>{t('validerCarte.backToDashboard')}</Link>}
          {rappel && (
            <div className="qc-recap"><b>{t('questionsCarte.yourAnswers')}</b>
              <ol>{rappel.map((r) => <li key={r.id}>{r.reponse}</li>)}</ol>
            </div>
          )}
        </FeuilleGenerale>
      </div>
    );
  }

  const sections = [];
  for (const it of carte.items) {
    const s = sections.find((x) => x.nom === (it.category || ''));
    if (s) s.items.push(it); else sections.push({ nom: it.category || '', items: [it] });
  }
  return (
    <div className="gn-page">
      <BandeauGeneral icone="document" titre={t('validerCarte.pageTitle')} sous={<b>{nomCommerce}</b>} />
      <FeuilleGenerale>
        <p className="gn-texte">{t(prixAVerifier ? 'validerCarte.introPricesToCheck' : eng ? 'validerCarte.introCommitments' : 'validerCarte.intro')}</p>
        {/* Prix repris d'une plateforme, pas encore relevés au comptoir (fondateur, 22/10/2026) : pas de « C'est bon », le
            serveur le refuserait (PRIX_A_VERIFIER). On le dit en tête, et la fin de page le redit à la place du bouton. */}
        {prixAVerifier && <p className="gn-note" role="note"><Icone nom="etiquette" taille={18} />{t('validerCarte.pricesToCheck')}</p>}
        {/* La photo de la carte, envoyée d'ici sans compte (fondateur, 23/10/2026 ; maquettes/prix-plateforme, option A) :
            elle arrive chez l'équipe comme une demande « Modifier la carte », et ce lien sert ensuite à valider. */}
        {prixAVerifier && (photoEnvoyee
          ? <p className="gn-note" role="status"><Icone nom="valider" taille={18} />{t('validerCarte.photoSent')}</p>
          : (
            <label className="btn-gold gn-action" style={{ marginBottom: 16, cursor: envoiPhoto ? 'wait' : 'pointer', opacity: envoiPhoto ? 0.7 : 1 }}>
              <Icone nom="photo" taille={18} className="icone-texte" />{' '}{envoiPhoto ? '…' : t('validerCarte.sendPhoto')}
              <input type="file" accept="image/*,application/pdf" multiple hidden disabled={envoiPhoto}
                onChange={(e) => envoyerPhotos([...(e.target.files || [])].slice(0, 10))} />
            </label>
          ))}
        {carte.alreadyValidated && <p className="gn-note" role="note"><Icone nom="valider" taille={18} />{t('validerCarte.alreadyValidated')}</p>}
        {!carte.alreadyValidated && q.applied > 0 && <p className="gn-note" role="note"><Icone nom="valider" taille={18} />{t('questionsCarte.applied', { n: q.applied })}</p>}
        {erreur && <p className="gn-note" role="alert"><Icone nom="alerte" taille={18} />{erreur}</p>}

        {choixOffert && (
          <section aria-labelledby={`${id}-taux`}>
            <SectionGenerale id={`${id}-taux`}>{t('validerCarte.rateTitle')}</SectionGenerale>
            <p className="gn-taux-aide" style={{ marginBottom: 10 }}>{t('validerCarte.rateIntro')}</p>
            {/* Un choix unique : les cases du paiement (aria-pressed), la retenue en aplat iris. */}
            <div className="ec-options" role="group" aria-labelledby={`${id}-taux`}>
              <OptionCommande on={!ajouter} icone="commerce" titre={t('validerCarte.rateKeep')} onClick={() => setAjouter(false)} />
              <OptionCommande on={ajouter} icone="tendance" titre={t('validerCarte.rateAdd', { markup: pctLocal(hausse) })} onClick={() => setAjouter(true)} />
            </div>
            <p className="gn-taux-aide">
              {ajouter
                ? t(hausse >= hausseEntiere(rate) - 0.005 ? 'validerCarte.rateAddHelp' : 'validerCarte.rateAddHelpOld', { markup: pctLocal(hausse) })
                : t('validerCarte.rateKeepHelp', { pct: pctLocal(rate * 100) })}
            </p>
            {/* Le badge « Prix du comptoir » (fondateur, 2026-10-19 : faire fortement envie de garder les prix magasin). Le choix
                n'est proposé que sur une carte aux prix magasin vérifiés : garder ses prix donne le badge tout de suite. */}
            <p className="gn-note" role="note"><Icone nom="etiquette" taille={18} />{ajouter ? t('validerCarte.rateAddNoBadge') : t('validerCarte.rateKeepBadge')}</p>
          </section>
        )}

        {sections.map((s) => (
          <section key={s.nom}>
            {s.nom && <SectionGenerale>{s.nom}</SectionGenerale>}
            <ul className="gn-carte-plats">
              {s.items.map((it) => (
                <li key={it.id} className="gn-plat">
                  <div className="gn-plat-tete">
                    <span className="gn-plat-nom">{it.name}</span>
                    <span className="gn-plat-prix">
                      {euros(avecCommission ? it.priceWithFairideRate : it.price)}
                      {/* L'ancien prix en clair, jamais barré (fondateur, 2026-10-15). */}
                      {avecCommission && <small className="gn-plat-avant">{t('validerCarte.rateWas', { price: euros(it.price) })}</small>}
                    </span>
                  </div>
                  {it.desc && <p className="gn-plat-desc">{it.desc}</p>}
                  {/* CE QUI EST SIGNÉ, MONTRÉ (audit du 19/10, shop-9) : le taux proposé EN CHIFFRES (celui que la signature
                      posera), les allergènes (le texte signé dit qu'ils sont exacts) et les suppléments payants, que « Monter
                      mes prix » monte aussi. Deux petites lignes et un repli : lisible à 430 px. */}
                  <p className="gn-plat-tva">
                    {it.vatRate == null ? t('validerCarte.vatProposed', { rate: it.vatProposed ?? '?' }) : t('validerCarte.vat', { rate: it.vatRate })}
                    {' · '}
                    {libellesAllergenes(it.allergens, t).length
                      ? t('conformite.allergensLine', { list: libellesAllergenes(it.allergens, t).join(', ') })
                      : it.allergensDeclaredNone ? t('conformite.allergensNone') : t('validerCarte.allergensMissing')}
                  </p>
                  {it.paidAddOns?.length > 0 && (
                    <details className="gn-plat-tva">
                      <summary>{t('validerCarte.addOns', { n: it.paidAddOns.length })}</summary>
                      <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
                        {it.paidAddOns.map((s, k) => (
                          <li key={k}>{s.name} ({s.group}) : + {euros(avecCommission && s.priceWithFairideRate != null ? s.priceWithFairideRate : s.price)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {prixAVerifier && <p className="gn-note" role="note"><Icone nom="horloge" taille={18} />{t('validerCarte.pricesToCheckEnd')}</p>}
        {/* Les engagements qui manquent, après la carte et avant la signature : les mêmes textes que « Tes engagements »
            (ListeEngagements), sans PDF (il demande une session ; le texte entier est ici, à un toucher). */}
        {!prixAVerifier && eng && (
          <section aria-labelledby={`${id}-eng`}>
            <SectionGenerale id={`${id}-eng`}>{t('validerCarte.commitmentsTitle')}</SectionGenerale>
            <p className="gn-texte" style={{ marginTop: 0 }}>{t(eng.aSigner.length > 1 ? 'validerCarte.commitmentsIntro' : 'validerCarte.commitmentsIntroOne', { n: eng.aSigner.length })}</p>
            <ListeEngagements aSigner={eng.aSigner} contrat={eng.contrat} conf={eng}
              champsAllergenes={(
                <div className="eg-champs">
                  <div className={`field${manque === 'tel' ? ' eg-manque' : ''}`}>
                    <label htmlFor={`${id}-tel`}>{t('engagementsCommerce.tel')}</label>
                    <input id={`${id}-tel`} ref={champTel} value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" autoComplete="tel" aria-describedby={`${id}-tel-aide`} />
                    <p id={`${id}-tel-aide`} className="champ-aide">{t('engagementsCommerce.telAide')}</p>
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-ref`}>{t('conformite.allergenReferent')}</label>
                    <input id={`${id}-ref`} value={referent} onChange={(e) => setReferent(e.target.value)} />
                  </div>
                </div>
              )} />
          </section>
        )}
        {!prixAVerifier && blocPlusBas && (
          <div className="gn-raccourci">
            <button type="button" className="gn-raccourci-pilule" onClick={allerAuBloc}>
              <Icone nom="bas" taille={18} />{t(eng ? 'validerCarte.goToCestBonSign' : 'validerCarte.goToCestBon')}
            </button>
          </div>
        )}
        {!prixAVerifier && <div className="gn-valider" ref={blocValider}>
          <p className="gn-texte gn-texte--encre">{t(eng ? 'validerCarte.commitmentAll' : 'validerCarte.commitment')}</p>
          {/* Une case pour la carte et les textes (version A) ; elle vaut renonciation au préavis quand une version dépassée du
              contrat est remplacée, comme la case de « Tes engagements » (caseNow). */}
          {eng && (
            <label className={`eg-case${manque === 'case' ? ' eg-manque' : ''}`}>
              <input type="checkbox" ref={champCase} checked={coche} onChange={(e) => { setCoche(e.target.checked); if (e.target.checked && manque === 'case') setManque(''); }} />
              <span>{t(eng.renonciationPreavis ? 'validerCarte.caseAllNow' : 'validerCarte.caseAll')}</span>
            </label>
          )}
          <div className={`field${eng && manque === 'nom' ? ' eg-manque' : ''}`}>
            <label htmlFor={`${id}-nom`}>{t(eng ? 'engagementsCommerce.nom' : 'validerCarte.yourName')}</label>
            <input id={`${id}-nom`} ref={champNom} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
          </div>
          {eng && manque && <p className="small eg-message" role="alert">{t(`engagementsCommerce.manque_${manque}`)}</p>}
          {eng && erreur && !manque && <p className="small eg-message" role="alert">{erreur}</p>}
          <button type="button" className="btn-gold gn-action" disabled={envoi} onClick={valider}>
            {envoi ? '…' : t(eng ? 'validerCarte.cestBonSign' : 'validerCarte.cestBon')}
          </button>
          <p className="gn-texte" style={{ margin: '12px 0 0', fontSize: 13.5 }}>{t('validerCarte.notRight')}</p>
        </div>}
      </FeuilleGenerale>
    </div>
  );
}
