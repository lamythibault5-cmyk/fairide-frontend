import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import BrandMark from '../../components/BrandMark';
import Icone from '../../components/Icone';
import BoutonsConnexionNative from '../../components/BoutonsConnexionNative';
import { restaurantTypeLabel } from '../../menuCategories';

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

function Fait({ icone, titre, sous, barre, vedette, children }) {
  return (
    <div className={`bv-carte bv-fait${vedette ? ' vedette' : ''}`}>
      <Tuile nom={icone} />
      <div style={{ flex: 1 }}>
        {barre && <span className="bv-barre">{barre}</span>}
        <b>{titre}</b>
        {children}
        {sous && <span className="bv-petit">{sous}</span>}
      </div>
    </div>
  );
}

// En-tête des écrans : retour, progression, langue. L'accueil et le chargement n'en ont pas.
export function Haut({ onRetour, progression, onPasser }) {
  const { t } = useLanguage();
  return (
    <div className="bv-haut">
      {/* data-retour-natif : le bouton Retour d'Android le déclenche (natif.js). */}
      <button type="button" className="bv-rond" data-retour-natif onClick={onRetour} aria-label={t('appli.retour')}><Icone nom="retour" taille={18} /></button>
      <div className="bv-progression" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progression * 100)}>
        <i style={{ width: `${Math.round(progression * 100)}%` }} />
      </div>
      {onPasser ? <button type="button" className="bv-passer" onClick={onPasser}>{t('appli.passer')}</button> : <Langues />}
    </div>
  );
}

function Option({ on, icone, titre, sous, multi, onClick }) {
  return (
    <button type="button" className={`bv-option${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      <Tuile nom={icone} />
      <span>{titre}{sous && <small>{sous}</small>}</span>
      {multi && <span className="bv-case">{on && <Icone nom="valider" taille={14} />}</span>}
    </button>
  );
}

export function EcranAccueil({ onCommencer, onConnexion }) {
  const { t } = useLanguage();
  return (
    <>
      <div className="bv-ligne-haut"><BrandMark size={72} /><Langues /></div>
      <div className="bv-grandit" />
      <div className="bv-gros"><b>10 %</b><span><s>30 %</s> {t('appli.ailleurs')}<br />{t('appli.commission')}</span></div>
      <h1 className="bv-titre bv-titre-accueil">{t('appli.accTitre')}</h1>
      <p className="bv-sous">{t('appli.accSub')}</p>
      <span className="bv-pastille"><Drapeau /> {t('appli.beChip')}</span>
      <button type="button" className="bv-btn btn-gold" onClick={onCommencer}>{t('appli.commencer')}</button>
      <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
    </>
  );
}

const PROFILS = [['client', 'sac', 'rClient'], ['driver', 'scooter', 'rLivreur'], ['restaurant', 'commerce', 'rCommerce']];
export function EcranProfil({ role, onChoix, onSuite }) {
  const { t } = useLanguage();
  return (
    <>
      <h1 className="bv-titre">{t('appli.profilTitre')}</h1>
      <p className="bv-sous">{t('appli.profilSub')}</p>
      {PROFILS.map(([v, icone, k]) => <Option key={v} on={role === v} icone={icone} titre={t(`appli.${k}`)} sous={t(`appli.${k}S`)} onClick={() => onChoix(v)} />)}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={!role} onClick={onSuite}>{t('appli.continuer')}</button>
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
      {liste.map(([v, icone, k, avecSous]) => (
        <Option key={v} multi on={choisis.includes(v)} icone={icone} titre={t(`appli.${k}`)} sous={avecSous ? t(`appli.${k}S`) : null} onClick={() => onBasculer(v)} />
      ))}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={exigerUn && !choisis.length} onClick={onSuite}>
        {choisis.length || !libelleVide ? t('appli.continuer') : libelleVide}
      </button>
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
    </>
  );
}

// Le prix d'abord (l'écart de commission, à l'échelle), puis rien d'ajouté, puis la justice ; le local en une ligne.
export function EcranPourquoi({ freins, onSuite }) {
  const { t } = useLanguage();
  const barre = (f, k) => (freins.includes(f) ? t(`appli.${k}`) : null);
  return (
    <>
      <h1 className="bv-titre">{t('appli.pqTitre')}</h1>
      <p className="bv-sous">{t('appli.pqSub')}</p>
      <Fait vedette icone="euro" titre={t('appli.pq1')} sous={t('appli.pq1S')} barre={barre('gonfle', 'fGonfle')}>
        {/* Barres à l'échelle : 32 % = toute la largeur, la partie claire marque la fourchette 22-32 %. */}
        <div className="bv-barres" aria-hidden="true">
          <span>{t('appli.autresApplis')}</span><i className="autres"><em /></i><span>22–32 %</span>
          <span>Fairide</span><i className="fairide" /><span><b>10 %</b></span>
        </div>
      </Fait>
      <Fait icone="ticket" titre={t('appli.pq2')} sous={t('appli.pq2S')} barre={barre('frais', 'fFrais')} />
      <Fait icone="balance" titre={t('appli.pq3')} sous={t('appli.pq3S')} />
      <p className="bv-petit bv-ligne-be"><Drapeau /> {t('appli.pqBe')}</p>
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" onClick={onSuite}>{t('appli.pqBtn')}</button>
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
      <div className="bv-grille">
        {ENVIES.map(([v, icone, k]) => <Option key={v} on={envies.includes(v)} icone={icone} titre={t(`appli.${k}`)} onClick={() => onBasculer(v)} />)}
      </div>
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" onClick={onSuite}>{envies.length ? t('appli.continuer') : t('appli.envTout')}</button>
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
      {faits.map(([ic, ti, so]) => <Fait key={ti} icone={ic} titre={ti} sous={so} />)}
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={attente} onClick={onOui}>{attente ? t('common.loading') : bouton}</button>
      {onNon && <button type="button" className="bv-lien" disabled={attente} onClick={onNon}>{libelleNon || t('appli.pasMaintenant')}</button>}
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
      <label htmlFor="bv-cp" className="sr-only">{t('appli.cpTitre')}</label>
      <input id="bv-cp" ref={champ} className="bv-saisie" inputMode="numeric" maxLength={4} placeholder="1050" autoComplete="postal-code"
        value={cp} onChange={(e) => onCp(e.target.value.replace(/\D/g, '').slice(0, 4))} />
      <p className="bv-sous bv-centre" style={{ marginTop: 12, minHeight: 22 }} aria-live="polite">{commune || (cp.length === 4 ? t('appli.cpHors') : '')}</p>
      <div className="bv-grandit" />
      <button type="button" className="bv-btn btn-teal" disabled={!commune} onClick={onSuite}>{t('appli.cpBtn')}</button>
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

export function EcranRecherche({ commune, points, envies }) {
  const { t } = useLanguage();
  const [etape, setEtape] = useState(0);
  useEffect(() => {
    const minuteurs = [1, 2, 3].map((n) => setTimeout(() => setEtape(n), 450 * n));
    return () => minuteurs.forEach(clearTimeout);
  }, []);
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
 * ce qu'il gagne avant qu'on lui demande quoi que ce soit (règle 5.1.1 d'Apple). */
export function EcranCompte({ role, resultats, avecPosition, commune, points, onFournisseur, onEmail, onConnexion, attente }) {
  const { t, locale } = useLanguage();
  let haut;
  if (role === 'client') {
    const n = resultats.length;
    const titre = !avecPosition && commune ? t('appli.trouvesCommune', { c: commune }) : n === 1 ? t('appli.trouvesUn') : t('appli.trouves', { n });
    haut = (
      <>
        {avecPosition && n > 0 && <Cercle points={points} petit />}
        <h1 className="bv-titre">{n || !avecPosition ? titre : t('appli.aucun')}</h1>
        {!n && avecPosition && <p className="bv-sous">{t('appli.aucunSub')}</p>}
        {resultats.slice(0, 4).map(({ r, km: d }) => (
          <div key={r.id} className="bv-commerce">
            {r.logoImageUrl ? <img src={r.logoImageUrl} alt="" loading="lazy" /> : <Tuile nom="restaurants" />}
            <div><b>{r.name}</b><span>{restaurantTypeLabel(r.cuisine, t)}{d !== null ? ` · ${km(d, locale)}` : r.commune ? ` · ${r.commune}` : ''}</span></div>
          </div>
        ))}
        {n > 4 && <p className="bv-petit">{t('appli.etAutres', { n: n - 4 })}</p>}
        {avecPosition && <p className="bv-petit" style={{ margin: '4px 0 12px' }}>{t('appli.rayonNote')}</p>}
        <p className="bv-sous" style={{ marginBottom: 6 }}>{t('appli.trouvesSub')}</p>
      </>
    );
  } else {
    const [k, ks] = role === 'driver' ? ['compteLivreur', 'compteLivreurS'] : ['compteCommerce', 'compteCommerceS'];
    haut = <><Tuile nom="compte" grande /><h1 className="bv-titre">{t(`appli.${k}`)}</h1><p className="bv-sous">{t(`appli.${ks}`)}</p></>;
  }
  return (
    <>
      {haut}
      <div className="bv-grandit" />
      <BoutonsConnexionNative onChoix={onFournisseur} disabled={attente} />
      <button type="button" className="bv-btn btn-outline" disabled={attente} onClick={onEmail}><Icone nom="courrier" /> {t('appli.continueEmail')}</button>
      <button type="button" className="bv-lien" onClick={onConnexion}>{t('appli.dejaCompte')}</button>
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
