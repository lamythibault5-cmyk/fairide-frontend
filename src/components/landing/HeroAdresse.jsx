import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { COMMUNES, communeDepuisCodePostal } from '../../menuCategories';
import { useLanguage } from '../../context/LanguageContext';
import Icone from '../Icone';

// LA BARRE D'ADRESSE DE L'ACCUEIL — « Où livrer ? », comme DoorDash ou Uber Eats (capture du
// fondateur, 2026-09-27).
//
// Elle remplace le bouton « Commander maintenant », qui envoyait vers l'inscription. La question de
// l'adresse est celle que tout visiteur se pose en premier (« est-ce qu'ils livrent chez moi ? ») et
// la liste des commerces est publique (voir App.jsx) : on peut donc y répondre sans compte.
//
// CE QUE FAIT LA BARRE, ET RIEN DE PLUS. Elle réutilise la même recherche que AddressSearch.jsx
// (GET /restaurants/lookup/suggest, publique, limitée côté serveur), déduit la commune du code
// postal, et ouvre /restaurants avec cette commune en `communeProche` (état de navigation, voir
// `filtresInitiaux` dans RestaurantList.jsx). Ce n'est PAS un filtre : TOUS les commerces restent
// affichés, ceux de la commune d'abord puis ceux des communes voisines. Un filtre strict laissait une
// liste presque vide tant que Fairide a peu de commerces (fondateur, 2026-09-27). Elle n'enregistre
// AUCUNE adresse : un visiteur n'a pas de compte où la ranger, et c'est le carnet d'adresses
// (ChoixAdresse.jsx) qui la vérifie et l'enregistre une fois connecté.
//
// Pourquoi le code postal plutôt que la ville renvoyée : Photon renvoie « Bruxelles » pour Laeken
// comme pour le centre, parfois le nom néerlandais, parfois le quartier. Le code postal, lui, désigne
// une seule commune (1050 déborde un peu sur Bruxelles-Ville autour de l'avenue Louise ; Ixelles
// reste le bon premier filtre).
const COMMUNE_PAR_CODE = {
  1000: 'Bruxelles', 1020: 'Bruxelles', 1120: 'Bruxelles', 1130: 'Bruxelles',
  1030: 'Schaerbeek', 1040: 'Etterbeek', 1050: 'Ixelles', 1060: 'Saint-Gilles',
  1070: 'Anderlecht', 1080: 'Molenbeek-Saint-Jean', 1081: 'Koekelberg',
  1082: 'Berchem-Sainte-Agathe', 1083: 'Ganshoren', 1090: 'Jette', 1140: 'Evere',
  1150: 'Woluwe-Saint-Pierre', 1160: 'Auderghem', 1170: 'Watermael-Boitsfort',
  1180: 'Uccle', 1190: 'Forest', 1200: 'Woluwe-Saint-Lambert', 1210: 'Saint-Josse-ten-Noode'
};

const normaliser = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

function communeDe(s) {
  const parCode = COMMUNE_PAR_CODE[Number(s.postalCode)];
  if (parCode) return parCode;
  return COMMUNES.find((c) => normaliser(c) === normaliser(s.city)) || null;
}

export default function HeroAdresse() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [etat, setEtat] = useState('idle'); // idle | loading | done
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);
  // Adresse reconnue mais hors des 19 communes : on le dit SOUS le champ, plutôt que d'ouvrir une
  // liste vide qui ferait croire que le site est cassé.
  const [horsZone, setHorsZone] = useState('');
  const boite = useRef(null);
  const ignorerProchaine = useRef(false);

  useEffect(() => {
    if (ignorerProchaine.current) { ignorerProchaine.current = false; return undefined; }
    const terme = q.trim();
    setHorsZone('');
    if (terme.length < 3) { setSuggestions([]); setEtat('idle'); return undefined; }
    let annule = false;
    const timer = setTimeout(async () => {
      setEtat('loading');
      try {
        const r = await api(`/restaurants/lookup/suggest?q=${encodeURIComponent(terme)}`);
        if (annule) return;
        setSuggestions(r.suggestions || []); setEtat('done'); setOuvert(true); setActif(-1);
      } catch {
        if (!annule) { setSuggestions([]); setEtat('done'); }
      }
    }, 350);
    return () => { annule = true; clearTimeout(timer); };
  }, [q]);

  useEffect(() => {
    const fermer = (e) => { if (boite.current && !boite.current.contains(e.target)) setOuvert(false); };
    document.addEventListener('pointerdown', fermer);
    return () => document.removeEventListener('pointerdown', fermer);
  }, []);

  function choisir(s) {
    ignorerProchaine.current = true;
    setQ(s.label);
    setOuvert(false);
    // Périphérie (Tervuren, Zaventem…, fondateur 2026-10-01) : on mène à la liste sans rien annoncer ; l'accueil continue
    // de parler des 19 communes. Seule une adresse vraiment hors zone reçoit le message « pas encore ».
    const commune = communeDe(s) || communeDepuisCodePostal(s.postalCode);
    if (!commune) { setHorsZone(s.city || s.label); return; }
    navigate('/restaurants', { state: { communeProche: commune } });
  }

  // Le bouton flèche et Entrée sans suggestion surlignée prennent la première. Sans aucune
  // suggestion (champ vide, ou rien trouvé), on ouvre quand même la liste complète : un bouton
  // « Continuer » qui ne fait rien est pire qu'un résultat moins ciblé.
  // Ce que le commentaire promettait n'était codé que pour le champ VIDE : « 1050 » puis → (ou Entrée avant
  // l'arrivée des suggestions) ne faisait rien du tout, sans message (test de bout en bout du 5 oct. 2026).
  // Un code postal bruxellois tapé seul mène désormais à sa commune ; tout autre texte, à la liste complète.
  function valider(e) {
    e.preventDefault();
    if (suggestions.length) { choisir(suggestions[actif >= 0 ? actif : 0]); return; }
    const commune = COMMUNE_PAR_CODE[Number(q.trim())];
    navigate('/restaurants', commune ? { state: { communeProche: commune } } : undefined);
  }

  function clavier(e) {
    if (!ouvert || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => Math.min(suggestions.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Escape') setOuvert(false);
  }

  return (
    <form className="hero-adresse" ref={boite} onSubmit={valider} role="search">
      <div className="hero-adresse-barre">
        <Icone nom="position" taille={22} />
        <label htmlFor="hero-adresse-input" className="sr-only">{t('landing.addrLabel')}</label>
        <input
          id="hero-adresse-input" value={q} autoComplete="street-address" role="combobox"
          aria-expanded={ouvert} aria-controls="hero-adresse-liste" aria-autocomplete="list"
          onChange={(e) => setQ(e.target.value)} onFocus={() => suggestions.length && setOuvert(true)} onKeyDown={clavier}
          placeholder={t('landing.addrPlaceholder')}
        />
        <button type="submit" className="hero-adresse-go" aria-label={t('landing.addrGo')}>
          {etat === 'loading' ? <span className="hero-adresse-spin" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
        </button>
      </div>
      {ouvert && etat === 'done' && (
        <ul id="hero-adresse-liste" className="hero-adresse-liste" role="listbox">
          {suggestions.length === 0 && <li className="hero-adresse-vide">{t('addressSearch.noResult')}</li>}
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`} role="option" aria-selected={i === actif} className={i === actif ? 'active' : undefined}
              onPointerDown={(e) => { e.preventDefault(); choisir(s); }}>
              <Icone nom="position" taille={16} />
              <span>
                <b>{[s.street, s.number].filter(Boolean).join(' ') || s.label}</b>
                <span className="small">{[s.postalCode, s.city].filter(Boolean).join(' ')}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {horsZone && <p className="hero-adresse-hors-zone" role="status">{t('landing.addrOutside', { lieu: horsZone })}</p>}
    </form>
  );
}
