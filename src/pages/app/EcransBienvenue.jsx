import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import BrandMark from '../../components/BrandMark';
import MotMarque from '../../components/MotMarque';
import Icone from '../../components/Icone';
import BoutonsConnexionNative from '../../components/BoutonsConnexionNative';
import { estNatif } from '../../natif';
import { restaurantTypeLabel, illustrationCuisine } from '../../menuCategories';
import { famille, libelleFamille } from '../../specialites';
import AvecMarque from '../../components/AvecMarque';
import { euros } from '../../prixPlat';
import { imgProps } from '../../images';
import { vibrer } from '../../gestes';

/* Les écrans de l'accueil de l'application — l'enchaînement, la mémoire et la recherche des commerces vivent dans
 * Bienvenue.jsx. Ces composants ne font qu'afficher et remonter des gestes.
 *
 * Tout ce qui est écrit ici est un fait du code ou des contrats (10 % HT : pricing.js ; rien au-dessus de la
 * livraison : modèle du 2026-10-08 ; pourboires 100 % : tipFairideRate 0 ; position jamais transmise au commerce ;
 * pas de suivi en arrière-plan : CLAUDE.md, lacune n° 1). Jamais « moins cher » en toutes lettres : ça dépend du
 * commerce (décision du fondateur, 2026-10-11) — on montre l'écart de commission et chacun en tire la conclusion. */

// Le petit drapeau dessiné : un emoji 🇧🇪 s'affiche « BE » en lettres sur Windows.
export function Drapeau() {
  return <span className="bv-drapeau" aria-hidden="true"><i /><i /><i /></span>;
}

function Langues() {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <div className="bv-langues" role="group" aria-label="Langue / Taal / Language">
      {languages.map((l) => (
        <button key={l} type="button" className={l === language ? 'on' : ''} aria-pressed={l === language} onClick={() => setLanguage(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

// `nom` « be » : le drapeau belge dessiné au lieu d'une icône.
function Tuile({ nom, grande = false }) {
  if (nom === 'be') return <span className="bv-tuile bv-tuile-be"><Drapeau /></span>;
  return <span className={`bv-tuile${grande ? ' grande' : ''}`}><Icone nom={nom} taille={grande ? 34 : 20} /></span>;
}

export function Fait({ icone, titre, sous, vedette, children }) {
  return (
    <div className={`bv-carte bv-fait${vedette ? ' vedette' : ''}`}>
      <Tuile nom={icone} />
      <div style={{ flex: 1 }}>
        <b>{titre}</b>
        {children}
        {sous && <span className="bv-petit">{sous}</span>}
      </div>
    </div>
  );
}

/* ACCUEIL « BANDEAU IRIS » (fondateur, 2026-10-16, version D de maquettes/onboarding-chaleur/onboarding-chaleur.html). Le haut de chaque
 * écran est iris : retour, la route du vélo, le titre ; ce qu'on choisit ou remplit monte dans une feuille blanche aux
 * coins ronds. Un écran met ce qui suit son titre dans <Feuille>. Hors d'un écran à bandeau (.bv-bandeau : l'amorce des
 * notifications, le dossier livreur), la feuille s'efface (display: contents) et rien ne change. */
export function Feuille({ children }) {
  return <div className="bv-feuille">{children}</div>;
}

// Le vélo de la marque (BrandMark.jsx, sans tuile), à la couleur du texte : lime sur le bandeau, iris sur fond blanc.
function Velo() {
  return (
    <svg viewBox="-3 5 82 42" width="34" height="18" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
      <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
    </svg>
  );
}

/* La progression est une route : le vélo part de là où il était à l'écran précédent et roule jusqu'au nouveau. L'en-tête
 * est remonté à chaque écran (key), d'où la dernière position gardée ici, hors du composant. */
let derniereProgression = 0;
function Route({ progression }) {
  const [depart] = useState(derniereProgression);
  const [p, setP] = useState(depart);
  useEffect(() => {
    const id = requestAnimationFrame(() => setP(progression));
    derniereProgression = progression;
    return () => cancelAnimationFrame(id);
  }, [progression]);
  const pct = `${Math.round(p * 1000) / 10}%`;
  return (
    <div className="bv-route" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression * 100)}>
      <i style={{ width: pct }} />
      {/* Le vélo reste SUR la route : à 100 % il touchait le sélecteur de langue (audit design, 2026-10-19). */}
      <span className="bv-velo" style={{ left: `calc(17px + (100% - 34px) * ${p})` }}><Velo /></span>
    </div>
  );
}

// En-tête des écrans : retour, progression, langue. L'accueil et le chargement n'en ont pas.
// `onFermer` : une croix à droite pour quitter un parcours lancé depuis l'app (dossier livreur, DossierAppli.jsx).
export function Haut({ onRetour, progression, onPasser, onFermer }) {
  const { t } = useLanguage();
  return (
    <div className="bv-haut">
      {/* data-retour-natif : le bouton Retour d'Android le déclenche (natif.js). */}
      <button type="button" className="bv-rond" data-retour-natif onClick={onRetour} aria-label={t('appli.retour')}><Icone nom="retour" taille={18} /></button>
      {/* Sans progression (connexion, ConnexionAppli.jsx) : un simple espace, la langue reste à droite. */}
      {progression == null ? <div className="bv-grandit" /> : <Route progression={progression} />}
      {onFermer ? <button type="button" className="bv-rond" onClick={onFermer} aria-label={t('appli.fermer')}><Icone nom="croix" taille={18} /></button>
        : onPasser ? <button type="button" className="bv-passer" onClick={onPasser}>{t('appli.passer')}</button> : <Langues />}
    </div>
  );
}

// Sans icône (véhicules de l'inscription, InscriptionAppli.jsx) : le texte seul.
export function Option({ on, icone, titre, sous, multi, onClick, manque = false }) {
  return (
    <button type="button" className={`bv-option${on ? ' on' : ''}${manque && !on ? ' bv-option--manque' : ''}`} aria-pressed={on} onClick={onClick}>
      {icone && <Tuile nom={icone} />}
      <span>{titre}{sous && <small>{sous}</small>}</span>
      {multi && <span className="bv-case">{on && <Icone nom="valider" taille={14} />}</span>}
    </button>
  );
}

/* Le vélo arrive sur sa route pointillée et s'arrête devant un commerce (même scène que les écrans vides, EtatVide.jsx,
 * en lime sur l'iris). Le commerce saute une fois le vélo passé. */
function SceneAccueil() {
  return (
    <svg className="bv-scene" viewBox="0 0 320 96" aria-hidden="true">
      <line className="bv-scene-route" x1="6" y1="86" x2="314" y2="86" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
      <g transform="translate(260 42)">
        <g className="bv-scene-repere">
          <rect x="-1" y="-1" width="38" height="38" rx="11" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".55" />
          <g transform="translate(6 6) scale(1.05)" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" /><path d="M3 9 5 4h14l2 5" /><path d="M9 21v-6h6v6" />
          </g>
        </g>
      </g>
      <g transform="translate(36 31) scale(1.2)">
        <g className="bv-scene-velo"><g className="bv-scene-bob">
          <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"><circle cx="15" cy="29" r="12.5" /><circle cx="61" cy="29" r="12.5" /></g>
          <g fill="currentColor"><rect x="16" y="8" width="44" height="5" rx="2.5" /><g transform="rotate(42 27 22.5)"><rect x="13" y="20" width="28" height="5" rx="2.5" /></g></g>
        </g></g>
      </g>
    </svg>
  );
}

/* LES BARRES DU VRAI PLAT RELEVÉ (fondateur, 2026-10-26, maquettes/croissance/prix-gonfles.html) : le même plat que la carte
 * « Le même plat, trois prix » de l'accueil du site (HeroPrix.jsx, qui dit pourquoi la comparaison est légale) : 15,00 € au
 * comptoir, 23,25 € en ligne sur une grande plateforme (+55 %, en rouge comme sur le site), 16,50 € au plus sur Fairride
 * (+10 %, arrondi aux 10 cents inférieurs), et depuis le 2026-10-27 le prix du comptoir des restaurants qui ont le badge.
 * Premier écran : en euros, sous « Le même plat, 15 € au comptoir », la ligne « Relevé en octobre 2026… Détails sur
 * demande » derrière un « i » (SourcePlat). « Sur Fairride, c'est réglé » : en pourcentages (`pourcent`). Le relevé se refait
 * chaque mois : changer les prix ici et dans HeroPrix.jsx, et la date d'appli.accSource et de landing.prixReleve. */
const COMPTOIR = 15.0;
const EN_LIGNE = 23.25;
const AU_PLUS = Math.floor(COMPTOIR * 1.1 * 10 + 1e-6) / 10; // 16,50 €
const ECART = Math.round((EN_LIGNE / COMPTOIR - 1) * 100); // 55
const platAffiche = () => euros(COMPTOIR).replace(/[,.]00(?=\D|$)/, '');
/* LA TROISIÈME BARRE, « PRIX DU COMPTOIR » (fondateur, 2026-10-27, version A de maquettes/badge-position/badge-position.html) :
 * l'accueil ne montrait que « 16,50 € au plus », alors que la plupart des restaurants vendent au prix de leur comptoir. Le
 * premier écran (en euros) ajoute donc le badge, dessiné comme dans la liste, avec sa barre au prix du comptoir, et une phrase
 * qui dit ce qu'il veut dire. Sans compter les restaurants qui l'ont (fondateur : « ça va beaucoup bouger »). */
function BarresPlat({ pourcent = false }) {
  const { t } = useLanguage();
  const eux = pourcent ? t('appli.barJusqua', { pct: ECART }) : euros(EN_LIGNE);
  const nous = pourcent ? t('appli.barAuPlus') : euros(AU_PLUS);
  const ailleurs = pourcent ? t('appli.barAilleursCourt') : t('appli.barAilleurs');
  const fairride = pourcent ? 'Fairride' : t('appli.barFairrideAuPlus');
  const comptoir = platAffiche();
  return (
    <div className="bv-barres" aria-label={`${ailleurs} ${eux}, ${fairride} ${nous}${pourcent ? '' : `, ${t('common.prixComptoir')} ${comptoir}`}`}>
      <span>{ailleurs}</span><i className="gonfle" /><span className="gonfle-prix">{eux}</span>
      <span>{fairride}</span><i className={`fairide${pourcent ? '' : ' au-plus'}`} style={{ width: `${Math.round((pourcent ? 10 / ECART : AU_PLUS / EN_LIGNE) * 100)}%` }} /><span>{pourcent ? <b>{nous}</b> : nous}</span>
      {!pourcent && (
        <>
          <span className="prix-comptoir"><Icone nom="etiquette" taille={12} />{t('common.prixComptoir')}</span>
          <i className="fairide" style={{ width: `${Math.round((COMPTOIR / EN_LIGNE) * 100)}%` }} /><span><b>{comptoir}</b></span>
        </>
      )}
    </div>
  );
}

/* La source du plat relevé, derrière un « i » (fondateur, 2026-10-27 : « retire la ligne Détails sur demande, ça fait trop de
 * texte »). Une comparaison de prix doit dire où et comment la vérifier (voix.md, § 3 ; CJUE Lidl Belgium c. Colruyt) : elle
 * reste donc à une touche, sans prendre de place. */
function SourcePlat() {
  const { t } = useLanguage();
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <button type="button" className="bv-info" aria-expanded={ouverte} aria-label={t('appli.accInfo')} onClick={() => setOuverte((o) => !o)}>i</button>
      {ouverte && <span className="bv-petit bv-source">{t('appli.accSource')}</span>}
    </>
  );
}

/* PREMIER ÉCRAN, version B2 de maquettes/accueil-appli/accueil-appli.html (fondateur, 2026-10-16), le même pour les trois profils.
 * Depuis le 2026-10-26 (maquettes/croissance/prix-gonfles.html), le même titre que le site : « Arrête de payer des prix
 * gonflés. » (landing.titreAccueil1/2), le vélo dessous, puis la feuille blanche : ce qu'on croit (« Le même plat ne devrait
 * pas coûter plus cher en ligne. »), les barres du vrai plat relevé et leur source, la ligne belge, le bouton lime. */
export function EcranAccueil({ onCommencer, onConnexion }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="bv-ligne-haut">
        <span className="bv-marque"><BrandMark size={34} tile={false} color="#C8F03C" /><MotMarque /></span>
        <Langues />
      </div>
      <h1 className="bv-titre bv-titre-accueil">{t('landing.titreAccueil1')}<br />{t('landing.titreAccueil2')}</h1>
      {/* Sur un grand écran, c'est le bandeau qui grandit (le vélo descend vers la feuille), pas la feuille. */}
      <div className="bv-grandit" />
      <SceneAccueil />
      <Feuille>
        <p className="bv-sous bv-accroche">{t('appli.accSub')}</p>
        <div className="bv-carte bv-carte-barres">
          <b>{t('appli.accBarres', { prix: platAffiche() })} <SourcePlat /></b>
          <BarresPlat />
          <span className="bv-petit">{t('appli.accBadge')}</span>
        </div>
        <p className="bv-petit bv-ligne-be bv-be-accueil"><Drapeau /> {t('appli.beChip')}</p>
        <button type="button" className="bv-btn btn-gold" onClick={onCommencer}>{t('appli.commencer')}</button>
        <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
      </Feuille>
    </>
  );
}

/* LE BOUTON LIME N'EST JAMAIS GRISÉ (design.md règle 4 ; fondateur, 2026-10-27, C3 de maquettes/audit-ecrans/audit-ecrans.html) :
 * sans réponse, le toucher vibre « attention » et encadre ce qui manque, comme la fiche d'un plat avec un choix obligatoire
 * (FichePlat). `pret` : la réponse est donnée ; `montrer` : ce qu'il faut faire en plus (mettre le curseur dans le champ). */
function useManque(pret) {
  const [manque, setManque] = useState(false);
  useEffect(() => { if (pret) setManque(false); }, [pret]);
  const essayer = (suite, montrer) => () => {
    if (pret) { suite(); return; }
    vibrer('attention');
    setManque(true);
    montrer?.();
  };
  return [manque && !pret, essayer];
}

const PROFILS = [['client', 'sac', 'rClient'], ['driver', 'velo', 'rLivreur'], ['restaurant', 'commerce', 'rCommerce']];
export function EcranProfil({ role, onChoix, onSuite }) {
  const { t } = useLanguage();
  const [manque, essayer] = useManque(!!role);
  return (
    <>
      <span className="bv-salut">{t('appli.salut')}</span>
      <h1 className="bv-titre"><AvecMarque>{t('appli.profilTitre')}</AvecMarque></h1>
      <p className="bv-sous">{t('appli.profilSub')}</p>
      <Feuille>
        {PROFILS.map(([v, icone, k]) => <Option key={v} on={role === v} manque={manque} icone={icone} titre={t(`appli.${k}`)} sous={t(`appli.${k}S`)} onClick={() => onChoix(v)} />)}
        {manque && <p className="bv-manque" role="alert">{t('appli.choisisReponse')}</p>}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={essayer(onSuite)}>{t('appli.continuer')}</button>
      </Feuille>
    </>
  );
}

/* UNE SEULE QUESTION (fondateur, 2026-10-22, version B de maquettes/onboarding-court/onboarding-court.html), un seul choix, qui
 * passe en tête de l'écran suivant. Depuis le 2026-10-26 (maquettes/croissance/prix-gonfles.html) : « Qu'est-ce qui t'énerve
 * le plus ? », trois réponses qui parlent de SON argent (le client qui commande tous les jours veut le bon plan) : les prix
 * gonflés, les frais au paiement, attendre une promo (« le 1+1 »). « Que mon argent reste ici » est retiré. L'écran suivant
 * n'y répond jamais par « moins cher », seulement par des prix pas gonflés (CLAUDE.md, l'argent). */
const QUESTION = [['prix', 'euro', 'qPrix'], ['total', 'ticket', 'qTotal'], ['promo', 'etiquette', 'qPromo']];
export function EcranQuestion({ choix, onChoix, onSuite }) {
  const { t } = useLanguage();
  const [manque, essayer] = useManque(!!choix);
  return (
    <>
      <h1 className="bv-titre">{t('appli.qTitre')}</h1>
      <p className="bv-sous">{t('appli.qSub')}</p>
      <Feuille>
        {QUESTION.map(([v, icone, k]) => <Option key={v} on={choix === v} manque={manque} icone={icone} titre={t(`appli.${k}`)} sous={t(`appli.${k}S`)} onClick={() => onChoix(v)} />)}
        {manque && <p className="bv-manque" role="alert">{t('appli.choisisReponse')}</p>}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={essayer(onSuite)}>{t('appli.continuer')}</button>
      </Feuille>
    </>
  );
}

/* « SUR FAIRRIDE, C'EST RÉGLÉ. » (2026-10-26, avant : « Ce que tu y gagnes ») : une carte par réponse à la question, celle choisie
 * en tête, sans phrase « Tu nous l'as dit » (retirée par le fondateur). Fini les prix gonflés (avec les barres en %), rien qui
 * tombe au paiement, pas besoin d'attendre une promo. Ni le livreur ni « l'argent reste ici » : ce n'est pas ce qui fait
 * changer le client (fondateur). */
const CARTES_POURQUOI = { prix: ['euro', 'pq1'], total: ['ticket', 'pq2'], promo: ['etiquette', 'pq3'] };
export function EcranPourquoi({ onSuite, attente = false, premier = null }) {
  const { t } = useLanguage();
  const ordre = ['prix', 'total', 'promo'].sort((a, b) => Number(b === premier) - Number(a === premier));
  return (
    <>
      <h1 className="bv-titre">{t('appli.pqTitre')}</h1>
      <Feuille>
        {ordre.map((cle, n) => {
          const [icone, k] = CARTES_POURQUOI[cle];
          return (
            <Fait key={cle} vedette={n === 0} icone={icone} titre={t(`appli.${k}`)} sous={t(`appli.${k}S`)}>
              {cle === 'prix' && <BarresPlat pourcent />}
            </Fait>
          );
        })}
        <div className="bv-grandit" />
        {/* Pose la question de la position du système (Bienvenue.jsx, utiliserPosition), sans écran d'explication avant. */}
        <button type="button" className="bv-btn btn-gold" disabled={attente} onClick={onSuite}>{t('appli.pqBtn')}</button>
      </Feuille>
    </>
  );
}

// Amorçage d'une permission : on explique AVANT la fenêtre du système (un refus est définitif sur iOS), et
// « Pas maintenant » ne punit jamais.
// Sans `onNon`, pas de « Pas maintenant » : la permission est indispensable (position du livreur, voir Bienvenue.jsx).
export function EcranPermission({ icone, titre, sous, faits, bouton, onOui, onNon, libelleNon, attente }) {
  const { t } = useLanguage();
  return (
    <>
      <Tuile nom={icone} grande />
      <h1 className="bv-titre">{titre}</h1>
      <p className="bv-sous">{sous}</p>
      <Feuille>
        {faits.map(([ic, ti, so]) => <Fait key={ti} icone={ic} titre={ti} sous={so} />)}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={attente} onClick={onOui}>{attente ? t('common.loading') : bouton}</button>
        {onNon && <button type="button" className="bv-lien" disabled={attente} onClick={onNon}>{libelleNon || t('appli.pasMaintenant')}</button>}
      </Feuille>
    </>
  );
}

export function EcranCodePostal({ cp, commune, onCp, onSuite }) {
  const { t } = useLanguage();
  const champ = useRef(null);
  useEffect(() => { champ.current?.focus(); }, []);
  const [manque, essayer] = useManque(!!commune);
  return (
    <>
      <h1 className="bv-titre">{t('appli.cpTitre')}</h1>
      <p className="bv-sous">{t('appli.cpSub')}</p>
      <Feuille>
        <label htmlFor="bv-cp" className="sr-only">{t('appli.cpTitre')}</label>
        <input id="bv-cp" ref={champ} className="bv-saisie" inputMode="numeric" maxLength={4} placeholder="1050" autoComplete="postal-code"
          value={cp} onChange={(e) => onCp(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <p className={`bv-sous bv-centre${manque && cp.length < 4 ? ' bv-manque' : ''}`} style={{ marginTop: 12, minHeight: 22 }} aria-live="polite">{commune || (cp.length === 4 ? t('appli.cpHors') : manque ? t('appli.cpManque') : '')}</p>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={essayer(onSuite, () => champ.current?.focus())}>{t('appli.cpBtn')}</button>
      </Feuille>
    </>
  );
}

/* Le cercle de livraison : toi au centre, la limite autour, un point par commerce qui livre chez toi, à sa vraie
 * place (à l'échelle du plus grand rayon). Sans position (code postal seulement), les points sont posés en spirale :
 * le cercle dit alors « il y a des commerces autour », pas « ils sont exactement là ». */
export function Cercle({ points, anime, petit }) {
  return (
    <svg viewBox="0 0 100 100" className={`bv-cercle${anime ? ' anime' : ''}${petit ? ' petit' : ''}`} aria-hidden="true">
      <circle cx="50" cy="50" r="44" className="zone" />
      <circle cx="50" cy="50" r="44" className="bord" />
      {anime && <circle cx="50" cy="50" r="44" className="onde" />}
      {points.map((p, k) => <circle key={k} cx={p.x} cy={p.y} r="3.2" className="pt" style={{ animationDelay: `${0.25 + k * 0.18}s` }} />)}
      <circle cx="50" cy="50" r="4.5" className="moi" />
    </svg>
  );
}

// Trois lignes (Bienvenue.jsx, lignesRecherche) : cochées quand c'est vraiment fait (`faites`), celle en cours tourne.
export function EcranRecherche({ commune, points, lignes, faites }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="bv-grandit" />
      <Cercle points={points} anime />
      <h1 className="bv-titre bv-centre" style={{ fontSize: 26 }} aria-live="polite">{commune ? t('appli.calcTitre', { c: commune }) : t('appli.calcTitrePosition')}</h1>
      <ul className="bv-etapes" aria-live="polite">
        {lignes.map((txt, k) => (
          <li key={k} className={k < faites ? 'fait' : k === faites ? 'en-cours' : ''}>
            <span className="bv-coche" aria-hidden="true"><Icone nom="valider" taille={13} /></span>{txt}
          </li>
        ))}
      </ul>
      <div className="bv-grandit" />
    </>
  );
}

/* « TU AS ENVIE DE QUOI ? » (fondateur, 2026-10-25, version A de maquettes/onboarding-gouts/onboarding-gouts.html). Après le
 * chargement, juste avant le résultat : les familles qui ont un commerce qui livre chez toi (`familles` : [clé, nombre], les plus
 * fournies d'abord, calculées dans Bienvenue.jsx), avec le dessin de la bande des cuisines et leur nombre. Plusieurs choix ; le
 * bouton compte en direct. Rien de coché : « Un peu de tout ». Une famille sans commerce n'est jamais proposée : cocher pour
 * trouver zéro serait le contraire du but (que l'appli ait l'air faite pour la personne). */
export function EcranEnvies({ familles, choisies, total, nPourToi, avecPosition, onBasculer, onSuite }) {
  const { t, locale } = useLanguage();
  const noms = choisies.map((cle) => libelleFamille(cle, t, { court: true }));
  return (
    <>
      <h1 className="bv-titre">{t('appli.envTitre')}</h1>
      <p className="bv-sous">{t('appli.envSub')}</p>
      <Feuille>
        <div className="bv-envies">
          {familles.map(([cle, n]) => {
            const on = choisies.includes(cle);
            return (
              <button key={cle} type="button" className={`bv-envie${on ? ' on' : ''}`} aria-pressed={on} onClick={() => onBasculer(cle)}>
                {on && <span className="bv-envie-coche"><Icone nom="valider" taille={12} /></span>}
                <img src={illustrationCuisine(famille(cle)?.illustration)} alt="" width="52" height="52" decoding="async" draggable="false" />
                <b>{libelleFamille(cle, t, { court: true })}</b>
                <small>{avecPosition ? t('appli.envPres', { n }) : n === 1 ? t('appli.envUn') : t('appli.envN', { n })}</small>
              </button>
            );
          })}
        </div>
        <div className="bv-grandit" />
        <div className="bv-envies-bas">
          <p className="bv-envies-compte" aria-live="polite">
            {choisies.length ? <><b>{nPourToi}</b> {t(nPourToi === 1 ? 'appli.envCompteUn' : 'appli.envCompte', { liste: listeEt(noms, locale) })}</>
              : avecPosition ? t(total === 1 ? 'appli.trouvesUn' : 'appli.trouves', { n: total }) : null}
          </p>
          <button type="button" className="bv-btn btn-gold" onClick={onSuite}>
            {!choisies.length ? t('appli.envTout') : nPourToi === 1 ? t('appli.envVoirUn') : t('appli.envVoir', { n: nPourToi })}
          </button>
        </div>
      </Feuille>
    </>
  );
}

// « Pizza, Burgers et Indien » dans la langue de l'écran (Intl.ListFormat ; une virgule seule là où il manque).
function listeEt(noms, locale) {
  try { return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(noms); } catch { return noms.join(', '); }
}

const km = (d, locale) => `${d.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

/* Le compte, partagé par les trois profils. Pour un client, les commerces trouvés sont AU-DESSUS des boutons : il voit
 * ce qu'il gagne avant qu'on lui demande quoi que ce soit (règle 5.1.1 d'Apple).
 *
 * UN SEUL ÉCRAN, SANS DÉFILER (fondateur, 2026-10-15). Il empilait le petit cercle, quatre cartes de commerce, la note
 * sur le rayon et jusqu'à trois boutons : au téléphone, « Continuer avec mon e-mail » était sous le pli. Le cercle a déjà
 * été montré au chargement juste avant ; ici, trois commerces en lignes serrées, dans une seule carte, et le compte. */
export function EcranCompte({ role, resultats, envies = [], listeEchec = false, avecPosition, commune, onFournisseur, onEmail, onConnexion, attente }) {
  const { t, locale } = useLanguage();
  let haut;
  let liste = null; // les commerces trouvés : en tête de la feuille, sous le bandeau
  // Liste des commerces pas lue (réseau, serveur) : « Pas encore de commerce qui livre jusqu'ici » était faux (audit du
  // 19/10, CROSS-34). On le dit, sans bloquer le compte.
  if (role === 'client' && listeEchec) {
    haut = <><h1 className="bv-titre">{t('appli.listeEchec')}</h1><p className="bv-sous">{t('appli.listeEchecSub')}</p></>;
  } else if (role === 'client') {
    const n = resultats.length;
    // Tes envies (EcranEnvies) : les commerces qui y répondent sont déjà en tête (trierCommerces, Bienvenue.jsx) ; le titre les
    // compte, eux seuls (fondateur, 2026-10-25, maquettes/onboarding-gouts). Sans envie, ou sans commerce qui y réponde : comme avant.
    const nPourToi = envies.length ? resultats.filter((x) => x.envie).length : 0;
    const noms = envies.map((cle) => libelleFamille(cle, t, { court: true }));
    const titre = nPourToi ? (nPourToi === 1 ? t('appli.pourToiUn') : t('appli.pourToi', { n: nPourToi }))
      : !avecPosition && commune ? t('appli.trouvesCommune', { c: commune }) : n === 1 ? t('appli.trouvesUn') : t('appli.trouves', { n });
    const sousTitre = !nPourToi ? null : avecPosition ? t('appli.pourToiSub', { liste: listeEt(noms, locale) })
      : commune ? t('appli.pourToiSubCommune', { liste: listeEt(noms, locale), c: commune }) : listeEt(noms, locale);
    // Liste qui n'a pas pu se charger (audit du 19/10, auth-22) : un titre neutre, jamais « pas encore de commerce ici ».
    haut = (
      <>
        <h1 className="bv-titre">{listeEchec ? t('appli.trouvesSansListe') : n || !avecPosition ? titre : t('appli.aucun')}</h1>
        {!n && avecPosition && !listeEchec && <p className="bv-sous">{t('appli.aucunSub')}</p>}
        {sousTitre && !listeEchec && <p className="bv-sous">{sousTitre}</p>}
      </>
    );
    // Sous les trois premiers : ce qui reste pour toi, puis les autres commerces (qui livrent aussi chez toi, quand on a la position).
    const restePourToi = Math.max(0, nPourToi - 3);
    const resteAutres = n - nPourToi - Math.max(0, 3 - nPourToi);
    const reste = !nPourToi ? (n > 3 ? t('appli.etAutres', { n: n - 3 }) : null) : [
      restePourToi > 0 && t('appli.plusPourToi', { n: restePourToi }),
      resteAutres > 0 && (avecPosition ? t(resteAutres === 1 ? 'appli.autreAussi' : 'appli.autresAussi', { n: resteAutres }) : t('appli.etAutres', { n: resteAutres }))
    ].filter(Boolean).join(' · ');
    liste = (
      <>
        {n > 0 && (
          <div className="bv-carte bv-trouves">
            {resultats.slice(0, 3).map(({ r, km: d, envie }) => (
              <div key={r.id} className="bv-commerce">
                {/* La photo du commerce, plus son logo (fondateur, 2026-10-25, maquettes/sans-logo/sans-logo.html). */}
                {r.coverImageUrl ? <img {...imgProps(r.coverImageUrl, 72)} alt="" loading="lazy" decoding="async" /> : <Tuile nom="restaurants" />}
                <div><b>{r.name}</b><span>{restaurantTypeLabel(r.cuisine, t)}{d !== null ? ` · ${km(d, locale)}` : r.commune ? ` · ${r.commune}` : ''}</span></div>
                {nPourToi > 0 && envie && <span className="bv-pour-toi">{t('appli.pourToiBadge')}</span>}
              </div>
            ))}
            {reste && <p className="bv-petit">{reste}</p>}
          </div>
        )}
        <p className="bv-sous" style={{ marginBottom: 0 }}>{t('appli.trouvesSub')}</p>
      </>
    );
  } else {
    const [k, ks] = role === 'driver' ? ['compteLivreur', 'compteLivreurS'] : ['compteCommerce', 'compteCommerceS'];
    haut = <><Tuile nom="compte" grande /><h1 className="bv-titre">{t(`appli.${k}`)}</h1><p className="bv-sous">{t(`appli.${ks}`)}</p></>;
  }
  return (
    <>
      {haut}
      <Feuille>
        {liste}
        <div className="bv-grandit" />
        {/* Feuille Apple/Google native : dans la vraie application seulement ; sur l'écran d'accueil, l'e-mail (et Google sur la page de connexion). */}
        {estNatif() && <BoutonsConnexionNative onChoix={onFournisseur} disabled={attente} />}
        {/* En lime, sous Apple et Google aussi (fondateur, 2026-10-27, maquettes/badge-position) : avant, un filet dans l'app.
            Apple reste en premier et de la même taille (règle 4.8 de l'App Store). */}
        <button type="button" className="bv-btn btn-gold" disabled={attente} onClick={onEmail}><Icone nom="courrier" /> {t('appli.continueEmail')}</button>
        <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
      </Feuille>
    </>
  );
}

/* Livreur et commerce (version retenue de maquettes/onboarding-court/onboarding-court.html, 2026-10-22) : ce qu'ils y gagnent
 * d'abord. `barres` : une carte au-dessus des promesses (commerce : ce que la plateforme prend sur une commande de 20 €) ;
 * `ligneBe` : « Startup belge, née à Bruxelles » sous les promesses (livreur, dont la pastille n'a pas le drapeau). */
const COMMANDE = 20;
export function BarresCommande() {
  const { t } = useLanguage();
  const [bas, haut, nous] = [COMMANDE * 0.22, COMMANDE * 0.32, COMMANDE * 0.1];
  return (
    <div className="bv-carte bv-carte-barres">
      <b>{t('appli.coBarres', { montant: euros(COMMANDE).replace(/[,.]00(?=\D|$)/, '') })}</b>
      <div className="bv-barres">
        <span>{t('appli.autresApplis')}</span><i className="autres-euros" /><span>{t('appli.coFourchette', { bas: euros(bas), haut: euros(haut) })}</span>
        <span>Fairride</span><i className="fairide" style={{ width: `${(nous / haut) * 100}%` }} /><span><b>{euros(nous)}</b></span>
      </div>
    </div>
  );
}

export function EcranPromesses({ chip, chipIcone, titre, sous, barres, faits, ligneBe, bouton, onSuite }) {
  const { t } = useLanguage();
  return (
    <>
      <span className="bv-pastille" style={{ marginTop: 6 }}>{chipIcone === 'be' ? <Drapeau /> : <Icone nom={chipIcone} taille={14} />} {chip}</span>
      <h1 className="bv-titre" style={{ fontSize: 34, marginTop: 16 }}>{titre}</h1>
      {sous && <p className="bv-sous">{sous}</p>}
      {barres}
      {faits.map(([ic, ti, so]) => <Fait key={ti} icone={ic} titre={ti} sous={so} />)}
      {ligneBe && <p className="bv-petit bv-ligne-be"><Drapeau /> {t('appli.beChip')}</p>}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" onClick={onSuite}>{bouton}</button>
    </>
  );
}
