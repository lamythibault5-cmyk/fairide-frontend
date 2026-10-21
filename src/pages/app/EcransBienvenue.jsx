import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import BrandMark from '../../components/BrandMark';
import Icone from '../../components/Icone';
import BoutonsConnexionNative from '../../components/BoutonsConnexionNative';
import { estNatif } from '../../natif';
import { restaurantTypeLabel } from '../../menuCategories';
import AvecMarque from '../../components/AvecMarque';
import { euros } from '../../prixPlat';

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

function Tuile({ nom, grande = false }) {
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

/* ACCUEIL « BANDEAU IRIS » (fondateur, 2026-10-16, version D de mockups/onboarding-chaleur.html). Le haut de chaque
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
      {/* Les petits bonds ne jouent que pendant un vrai trajet. */}
      {/* Le vélo reste SUR la route : à 100 % il touchait le sélecteur de langue (audit design, 2026-10-19). */}
      <span className={`bv-velo${p !== depart ? ' roule' : ''}`} style={{ left: `calc(17px + (100% - 34px) * ${p})` }}><Velo /></span>
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
export function Option({ on, icone, titre, sous, multi, onClick }) {
  return (
    <button type="button" className={`bv-option${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
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

/* PREMIER ÉCRAN, version B2 de mockups/accueil-appli.html (fondateur, 2026-10-16 : l'ancien, tout iris avec un « 10 % »
 * de 88 px, était « trop fort »). Même cadre que les écrans suivants : le slogan du site dans le bandeau iris, le vélo
 * dessous, puis la feuille blanche avec la phrase, les barres de commission (celles de « Pourquoi passer à Fairide ? ») et
 * le seul bouton lime. Le slogan est celui de l'accueil du site (landing.title1/title2), pour les trois langues. */
export function EcranAccueil({ onCommencer, onConnexion }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="bv-ligne-haut">
        <span className="bv-marque"><BrandMark size={34} tile={false} color="#C8F03C" /><span className="wordmark">fairide</span></span>
        <Langues />
      </div>
      <h1 className="bv-titre bv-titre-accueil">{t('landing.title1')}<br />{t('landing.title2')}</h1>
      {/* Sur un grand écran, c'est le bandeau qui grandit (le vélo descend vers la feuille), pas la feuille. */}
      <div className="bv-grandit" />
      <SceneAccueil />
      <Feuille>
        <p className="bv-sous bv-accroche">{t('appli.accSub')}</p>
        {/* Sans texte barré (fondateur, 2026-10-16) : la fourchette des autres applis est écrite en clair. */}
        <div className="bv-carte bv-barres" aria-label={`Fairide 10 %, ${t('appli.autresApplis')} 22–32 %`}>
          <span>Fairide</span><i className="fairide" /><span><b>10 %</b></span>
          <span>{t('appli.autresApplis')}</span><i className="autres"><em /></i><span>22–32 %</span>
        </div>
        <p className="bv-petit bv-ligne-be bv-be-accueil"><Drapeau /> {t('appli.beChip')}</p>
        <button type="button" className="bv-btn btn-gold" onClick={onCommencer}>{t('appli.commencer')}</button>
        <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
      </Feuille>
    </>
  );
}

const PROFILS = [['client', 'sac', 'rClient'], ['driver', 'velo', 'rLivreur'], ['restaurant', 'commerce', 'rCommerce']];
export function EcranProfil({ role, onChoix, onSuite }) {
  const { t } = useLanguage();
  return (
    <>
      <span className="bv-salut">{t('appli.salut')}</span>
      <h1 className="bv-titre"><AvecMarque>{t('appli.profilTitre')}</AvecMarque></h1>
      <p className="bv-sous">{t('appli.profilSub')}</p>
      <Feuille>
        {PROFILS.map(([v, icone, k]) => <Option key={v} on={role === v} icone={icone} titre={t(`appli.${k}`)} sous={t(`appli.${k}S`)} onClick={() => onChoix(v)} />)}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={!role} onClick={onSuite}>{t('appli.continuer')}</button>
      </Feuille>
    </>
  );
}

// Écran à choix multiple générique (« ce qui compte », « ce qui agace »). Liste : [valeur, icône, clé, a un sous-titre].
export function EcranChoix({ titre, liste, choisis, onBasculer, onSuite, exigerUn, libelleVide }) {
  const { t } = useLanguage();
  return (
    <>
      <h1 className="bv-titre">{titre}</h1>
      <p className="bv-sous">{t('appli.plusieurs')}</p>
      <Feuille>
        {liste.map(([v, icone, k, avecSous]) => (
          <Option key={v} multi on={choisis.includes(v)} icone={icone} titre={t(`appli.${k}`)} sous={avecSous ? t(`appli.${k}S`) : null} onClick={() => onBasculer(v)} />
        ))}
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={exigerUn && !choisis.length} onClick={onSuite}>
          {choisis.length || !libelleVide ? t('appli.continuer') : libelleVide}
        </button>
      </Feuille>
    </>
  );
}

/* Cartes à glisser : au doigt (événements pointer, qui couvrent le tactile et la souris) ou par les deux boutons.
 * Au-delà de 90 px la carte part ; après la dernière, on passe tout seul à « Pourquoi passer à Fairide ? » (retour
 * du fondateur : pas de bouton à toucher entre les deux). */
const CARTES = ['c1', 'c2', 'c3'];
export function EcranCartes({ onFini }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [depart, setDepart] = useState(null); // 'oui' | 'non' pendant l'animation de sortie
  const x0 = useRef(null);
  const votes = useRef([]);
  const voter = (oui) => {
    if (depart) return;
    setDepart(oui ? 'oui' : 'non');
    setTimeout(() => {
      votes.current.push(oui);
      setDepart(null); setDx(0);
      if (index + 1 >= CARTES.length) onFini(votes.current); else setIndex(index + 1);
    }, 220);
  };
  const decalage = depart ? (depart === 'oui' ? 420 : -420) : dx;
  return (
    <>
      <h1 className="bv-titre">{t('appli.cartesTitre')}</h1>
      <p className="bv-sous">{t('appli.cartesSub')}</p>
      <Feuille>
        <div className="bv-paquet">
          {index + 1 < CARTES.length && <div className="bv-glisse dessous"><div className="bv-guillemet">“</div>{t(`appli.${CARTES[index + 1]}`)}</div>}
          <div
            key={index}
            className="bv-glisse"
            style={{ transform: `translateX(${decalage}px) rotate(${decalage / 18}deg)`, opacity: depart ? 0 : 1, transition: x0.current === null ? 'transform .25s, opacity .25s' : 'none' }}
            onPointerDown={(e) => { x0.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (x0.current !== null) setDx(e.clientX - x0.current); }}
            onPointerUp={() => { if (x0.current === null) return; x0.current = null; if (Math.abs(dx) > 90) voter(dx > 0); else setDx(0); }}
            onPointerCancel={() => { x0.current = null; setDx(0); }}
          >
            <span className="bv-tampon non" style={{ opacity: Math.max(0, -decalage / 90) }}>{t('appli.non')}</span>
            <span className="bv-tampon oui" style={{ opacity: Math.max(0, decalage / 90) }}>{t('appli.oui')}</span>
            <div className="bv-guillemet">“</div>{t(`appli.${CARTES[index]}`)}
          </div>
        </div>
        <div className="bv-votes">
          <button type="button" className="bv-rond grand" onClick={() => voter(false)} aria-label={t('appli.non')}><Icone nom="croix" taille={24} /></button>
          <button type="button" className="bv-rond grand plein" onClick={() => voter(true)} aria-label={t('appli.oui')}><Icone nom="valider" taille={26} /></button>
        </div>
        <p className="bv-petit bv-centre" style={{ marginTop: 14 }}>{t('appli.carteN', { n: index + 1, total: CARTES.length })}</p>
      </Feuille>
    </>
  );
}

// Des prix qui ne sont pas gonflés d'abord (fondateur, 2026-10-19, version F de mockups/prix-pas-gonfles.html : c'est la
// première raison de passer à Fairide), puis rien d'ajouté, puis la justice ; le local en une ligne.
// LES BARRES EN EUROS : ce qu'un restaurant ajoute AU PLUS à un plat de 12 € pour couvrir la commission. 30 % : 12 € ÷ 0,70
// = 17,14 €, soit +5,10 € (arrondi aux 10 cents inférieurs) ; Fairide : la hausse est plafonnée à 10 % (hausseMaxPourcent du
// backend), soit +1,20 €. Un calcul, pas un relevé des prix d'une autre application (voir HeroPrix.jsx).
// `echo` : la personne a dit, juste avant, que payer plus cher qu'au restaurant l'agace (Bienvenue.jsx) ; on le lui rappelle.
const PLAT = 12;
const AJOUT_EUX = Math.floor((PLAT / 0.7 - PLAT) * 10 + 1e-6) / 10; // 5,10 €
const AJOUT_NOUS = Math.floor(PLAT * 0.1 * 10 + 1e-6) / 10; // 1,20 €
export function EcranPourquoi({ onSuite, echo = false }) {
  const { t } = useLanguage();
  const plat = euros(PLAT).replace(/[,.]00(?=\D|$)/, '');
  return (
    <>
      <h1 className="bv-titre"><AvecMarque>{t('appli.pqTitre')}</AvecMarque></h1>
      <p className="bv-sous">{t('appli.pqSub')}</p>
      <Feuille>
        {echo && <p className="bv-echo"><Icone nom="bulle" taille={18} />{t('appli.pqEcho')}</p>}
        <Fait vedette icone="euro" titre={t('appli.pq1')} sous={t('appli.pq1S', { prix: plat })}>
          {/* Barres à l'échelle : l'ajout des autres applis = toute la largeur, celui de Fairide en proportion. */}
          <div className="bv-barres" aria-hidden="true">
            <span>{t('appli.autresApplis')}</span><i className="autres-euros" /><span>+{euros(AJOUT_EUX)}</span>
            <span>Fairide</span><i className="fairide" style={{ width: `${(AJOUT_NOUS / AJOUT_EUX) * 100}%` }} /><span><b>+{euros(AJOUT_NOUS)}</b></span>
          </div>
        </Fait>
        <Fait icone="ticket" titre={t('appli.pq2')} sous={t('appli.pq2S')} />
        <Fait icone="balance" titre={t('appli.pq3')} sous={t('appli.pq3S')} />
        <p className="bv-petit bv-ligne-be"><Drapeau /> {t('appli.pqBe')}</p>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={onSuite}>{t('appli.pqBtn')}</button>
      </Feuille>
    </>
  );
}

const ENVIES = [['snack', 'frites', 'eSnack'], ['pizza', 'pizza', 'ePizza'], ['burger', 'burger', 'eBurger'], ['monde', 'globe', 'eMonde'], ['healthy', 'bol', 'eHealthy'], ['sucre', 'tasse', 'eSucre']];
export function EcranEnvies({ envies, onBasculer, onSuite }) {
  const { t } = useLanguage();
  return (
    <>
      <h1 className="bv-titre">{t('appli.envTitre')}</h1>
      <p className="bv-sous">{t('appli.envSub')}</p>
      <Feuille>
        <div className="bv-grille">
          {ENVIES.map(([v, icone, k]) => <Option key={v} on={envies.includes(v)} icone={icone} titre={t(`appli.${k}`)} onClick={() => onBasculer(v)} />)}
        </div>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" onClick={onSuite}>{envies.length ? t('appli.continuer') : t('appli.envTout')}</button>
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
  return (
    <>
      <h1 className="bv-titre">{t('appli.cpTitre')}</h1>
      <p className="bv-sous">{t('appli.cpSub')}</p>
      <Feuille>
        <label htmlFor="bv-cp" className="sr-only">{t('appli.cpTitre')}</label>
        <input id="bv-cp" ref={champ} className="bv-saisie" inputMode="numeric" maxLength={4} placeholder="1050" autoComplete="postal-code"
          value={cp} onChange={(e) => onCp(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <p className="bv-sous bv-centre" style={{ marginTop: 12, minHeight: 22 }} aria-live="polite">{commune || (cp.length === 4 ? t('appli.cpHors') : '')}</p>
        <div className="bv-grandit" />
        <button type="button" className="bv-btn btn-gold" disabled={!commune} onClick={onSuite}>{t('appli.cpBtn')}</button>
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

// Les trois étapes se cochent au quart, à la moitié et aux trois quarts de `duree` : la dernière reste lisible avant le compte.
export function EcranRecherche({ commune, points, envies, duree }) {
  const { t } = useLanguage();
  const [etape, setEtape] = useState(0);
  useEffect(() => {
    const minuteurs = [1, 2, 3].map((n) => setTimeout(() => setEtape(n), (duree / 4) * n));
    return () => minuteurs.forEach(clearTimeout);
  }, [duree]);
  return (
    <>
      <div className="bv-grandit" />
      <Cercle points={points} anime />
      <h1 className="bv-titre bv-centre" style={{ fontSize: 26 }} aria-live="polite">{commune ? t('appli.calcTitre', { c: commune }) : t('appli.calcTitrePosition')}</h1>
      <ul className="bv-etapes">
        {[t('appli.calc1'), envies.length ? t('appli.calc2') : t('appli.calc2b'), t('appli.calc3')].map((txt, k) => <li key={txt} className={etape > k ? 'fait' : ''}>{txt}</li>)}
      </ul>
      <div className="bv-grandit" />
    </>
  );
}

const km = (d, locale) => `${d.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`;

/* Le compte, partagé par les trois profils. Pour un client, les commerces trouvés sont AU-DESSUS des boutons : il voit
 * ce qu'il gagne avant qu'on lui demande quoi que ce soit (règle 5.1.1 d'Apple).
 *
 * UN SEUL ÉCRAN, SANS DÉFILER (fondateur, 2026-10-15). Il empilait le petit cercle, quatre cartes de commerce, la note
 * sur le rayon et jusqu'à trois boutons : au téléphone, « Continuer avec mon e-mail » était sous le pli. Le cercle a déjà
 * été montré au chargement juste avant ; ici, trois commerces en lignes serrées, dans une seule carte, et le compte. */
export function EcranCompte({ role, resultats, listeEchec = false, avecPosition, commune, onFournisseur, onEmail, onConnexion, attente }) {
  const { t, locale } = useLanguage();
  let haut;
  let liste = null; // les commerces trouvés : en tête de la feuille, sous le bandeau
  // Liste des commerces pas lue (réseau, serveur) : « Pas encore de commerce qui livre jusqu'ici » était faux (audit du
  // 19/10, CROSS-34). On le dit, sans bloquer le compte.
  if (role === 'client' && listeEchec) {
    haut = <><h1 className="bv-titre">{t('appli.listeEchec')}</h1><p className="bv-sous">{t('appli.listeEchecSub')}</p></>;
  } else if (role === 'client') {
    const n = resultats.length;
    const titre = !avecPosition && commune ? t('appli.trouvesCommune', { c: commune }) : n === 1 ? t('appli.trouvesUn') : t('appli.trouves', { n });
    // Liste qui n'a pas pu se charger (audit du 19/10, auth-22) : un titre neutre, jamais « pas encore de commerce ici ».
    haut = (
      <>
        <h1 className="bv-titre">{listeEchec ? t('appli.trouvesSansListe') : n || !avecPosition ? titre : t('appli.aucun')}</h1>
        {!n && avecPosition && !listeEchec && <p className="bv-sous">{t('appli.aucunSub')}</p>}
      </>
    );
    liste = (
      <>
        {n > 0 && (
          <div className="bv-carte bv-trouves">
            {resultats.slice(0, 3).map(({ r, km: d }) => (
              <div key={r.id} className="bv-commerce">
                {r.logoImageUrl ? <img src={r.logoImageUrl} alt="" loading="lazy" /> : <Tuile nom="restaurants" />}
                <div><b>{r.name}</b><span>{restaurantTypeLabel(r.cuisine, t)}{d !== null ? ` · ${km(d, locale)}` : r.commune ? ` · ${r.commune}` : ''}</span></div>
              </div>
            ))}
            {n > 3 && <p className="bv-petit">{t('appli.etAutres', { n: n - 3 })}</p>}
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
        {/* Seul bouton hors de l'application (site ajouté à l'écran d'accueil, aperçu) : il prend l'aplat lime, pas le filet. */}
        <button type="button" className={`bv-btn ${estNatif() ? 'btn-outline' : 'btn-gold'}`} disabled={attente} onClick={onEmail}><Icone nom="courrier" /> {t('appli.continueEmail')}</button>
        <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
      </Feuille>
    </>
  );
}

export function EcranPromesses({ chip, chipIcone, titre, sous, faits, bouton, onSuite }) {
  return (
    <>
      <span className="bv-pastille" style={{ marginTop: 6 }}>{chipIcone === 'be' ? <Drapeau /> : <Icone nom={chipIcone} taille={14} />} {chip}</span>
      <h1 className="bv-titre" style={{ fontSize: 34, marginTop: 16 }}>{titre}</h1>
      {sous && <p className="bv-sous">{sous}</p>}
      {faits.map(([ic, ti, so]) => <Fait key={ti} icone={ic} titre={ti} sous={so} />)}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-gold" onClick={onSuite}>{bouton}</button>
    </>
  );
}
