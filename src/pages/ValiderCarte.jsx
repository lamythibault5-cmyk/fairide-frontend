import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { defilement } from '../gestes';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { euros } from '../prixPlat';
import usePageMeta from '../hooks/usePageMeta';
import Icone from '../components/Icone';
import { OptionCommande } from '../components/EcranCommande';
import { BandeauGeneral, FeuilleGenerale, SectionGenerale } from '../components/EcranGeneral';
import QuestionsCarte, { reponseAffichee } from '../components/commerce/QuestionsCarte';

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
  const pctLocal = (v) => Number(v).toLocaleString(locale, { maximumFractionDigits: 1 });
  const avecCommission = choixOffert && ajouter;

  const charger = () => api(`/menu-validation/${encodeURIComponent(token)}`)
    .then((c) => { setCarte(c); setNom((n) => n || c.restaurant.responsibleName || ''); setErreur(''); })
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

  async function valider() {
    setEnvoi(true);
    try {
      const r = await api(`/menu-validation/${encodeURIComponent(token)}`, { method: 'POST', body: { name: nom, sha256: carte.sha256, ...(choixOffert ? { addFairideRate: ajouter } : {}) } });
      setFait(r.version);
    } catch (e) {
      setErreur(e.message);
      // Carte changée depuis l'ouverture : on recharge la version à jour, le gérant revalide ce qu'il voit.
      if (e.status === 409) charger();
    } finally { setEnvoi(false); }
  }

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
        <BandeauGeneral icone="valider" titre={t('validerCarte.doneTitle')} sous={nomCommerce} />
        <FeuilleGenerale>
          <p className="gn-texte gn-texte--encre" role="status">{t(commercant ? 'validerCarte.doneTextConnected' : 'validerCarte.doneText', { name: nomCommerce })}</p>
          {commercant && <Link to="/dashboard" className="btn-gold gn-action">{t('validerCarte.backToDashboard')}</Link>}
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
          {rappel && (
            <div className="qc-recap"><b>{t('questionsCarte.yourAnswers')}</b>
              <ol>{rappel.map((r) => <li key={r.id}>{r.reponse}</li>)}</ol>
            </div>
          )}
          {commercant && <Link to="/dashboard" className="btn-gold gn-action" style={{ marginTop: 18 }}>{t('validerCarte.backToDashboard')}</Link>}
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
        <p className="gn-texte">{t('validerCarte.intro')}</p>
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
                ? t('validerCarte.rateAddHelp', { markup: pctLocal(hausse) })
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
                  <p className="gn-plat-tva">{it.vatRate == null ? t('validerCarte.vatProposed') : t('validerCarte.vat', { rate: it.vatRate })}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {blocPlusBas && (
          <div className="gn-raccourci">
            <button type="button" className="gn-raccourci-pilule" onClick={allerAuBloc}>
              <Icone nom="bas" taille={18} />{t('validerCarte.goToCestBon')}
            </button>
          </div>
        )}
        <div className="gn-valider" ref={blocValider}>
          <p className="gn-texte gn-texte--encre">{t('validerCarte.commitment')}</p>
          <div className="field">
            <label htmlFor={`${id}-nom`}>{t('validerCarte.yourName')}</label>
            <input id={`${id}-nom`} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" />
          </div>
          <button type="button" className="btn-gold gn-action" disabled={envoi || nom.trim().length < 3} onClick={valider}>
            {envoi ? '…' : t('validerCarte.cestBon')}
          </button>
          <p className="gn-texte" style={{ margin: '12px 0 0', fontSize: 13.5 }}>{t('validerCarte.notRight')}</p>
        </div>
      </FeuilleGenerale>
    </div>
  );
}
