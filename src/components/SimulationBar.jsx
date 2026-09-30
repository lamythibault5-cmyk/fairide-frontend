import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth, PROFILS_SIMULATION } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Icone from './Icone';
import RouleauTickets from './RouleauTickets';
import '../simulation.css';

// Barre flottante d'un onglet de simulation (Admin › Simulation) : elle dit quel profil l'onglet affiche, passe
// de l'un à l'autre, liste les points à vérifier pour ce profil et enregistre une note d'amélioration liée à la
// page en cours. Elle n'existe que dans un onglet de simulation — jamais pour un vrai utilisateur.
const ICONES = { visitor: 'globe', client: 'compte', restaurant: 'commerce', driver: 'scooter' };
const ACCUEIL = { visitor: '/', client: '/', restaurant: '/dashboard', driver: '/driver' };
const CATEGORIES = ['affichage', 'texte', 'parcours', 'bug', 'idee'];
const CLE_ETAPES = 'fairide_simulation_etapes';
const CLE_OUVERTE = 'fairide_simulation_barre';

// Points à vérifier par profil : une clé de traduction (simulation.step_<profil>_<clé>) et la page où aller.
function etapesDe(profil, restoId) {
  const fiche = restoId ? `/restaurants/${restoId}` : '/restaurants';
  return {
    visitor: [['home', '/'], ['list', '/restaurants'], ['search', '/recherche'], ['help', '/aide'], ['story', '/notre-histoire'], ['signup', '/login'], ['legal', '/cgv']],
    client: [['menu', fiche], ['cart', '/panier'], ['checkout', '/checkout'], ['tracking', '/orders'], ['favorites', '/favorites'], ['map', '/map'], ['invoices', '/invoices'], ['account', '/account']],
    restaurant: [['home', '/dashboard'], ['orders', '/dashboard/orders'], ['menu', '/dashboard/menu'], ['preview', '/dashboard/preview'], ['promotions', '/dashboard/promotions'], ['reviews', '/dashboard/reviews'], ['invoices', '/dashboard/invoices'], ['guide', '/dashboard/guide']],
    driver: [['home', '/driver'], ['map', '/driver/map'], ['earnings', '/driver/earnings'], ['invoices', '/driver/invoices'], ['reviews', '/driver/reviews'], ['onboarding', '/driver/onboarding'], ['account', '/account']]
  }[profil] || [];
}

function lire(cle, defaut) {
  try { const v = JSON.parse(sessionStorage.getItem(cle) || 'null'); return v ?? defaut; } catch { return defaut; }
}
function ecrire(cle, v) {
  try { sessionStorage.setItem(cle, JSON.stringify(v)); } catch { /* sans stockage */ }
}

export default function SimulationBar() {
  const { simulation, changerProfilSimulation, quitterSimulation, token } = useAuth();
  const { t, language } = useLanguage();
  const toast = useToast();
  const location = useLocation();
  // Sur téléphone, la barre dépliée couvrait près de la moitié de l'écran (simulation du 30/09) : elle démarre repliée.
  const [ouverte, setOuverte] = useState(() => lire(CLE_OUVERTE, window.innerWidth > 720));
  const [panneau, setPanneau] = useState(null); // null | 'etapes' | 'note' | 'imprimante'
  const [faites, setFaites] = useState(() => lire(CLE_ETAPES, {}));
  const [texte, setTexte] = useState('');
  const [categorie, setCategorie] = useState('affichage');
  const [envoi, setEnvoi] = useState(false);
  // Imprimante virtuelle du terminal simulé (backend : GET /simulation/printer). Elle tourne en continu pendant la
  // simulation : une commande reçue, un livreur qui prend la course… et le ticket « sort », où que l'on soit.
  const [imprimante, setImprimante] = useState({ tickets: [], nouveaux: [] });
  const [nonLus, setNonLus] = useState(0);
  const jetonCommerce = simulation?.profiles?.restaurant?.token || null;
  useEffect(() => {
    if (!jetonCommerce) return undefined;
    let actif = true;
    const tourner = async () => {
      try {
        const r = await api('/simulation/printer', { token: jetonCommerce, logoutOn401: false });
        if (!actif) return;
        setImprimante({ tickets: r.tickets || [], nouveaux: r.nouveaux || [] });
        if (r.nouveaux?.length) {
          const sortis = (r.tickets || []).filter((x) => r.nouveaux.includes(x.id));
          toast(t('simulation.printedToast', { what: sortis.map((x) => `${t(`simulation.ticket_${x.kind}`)}${x.orderNumber ? ` #${String(x.orderNumber).padStart(3, '0')}` : ''}`).join(', ') }));
          setNonLus((n) => n + r.nouveaux.length);
        }
      } catch { /* session expirée : la barre le signale déjà */ }
    };
    tourner();
    const i = setInterval(tourner, 5000);
    return () => { actif = false; clearInterval(i); };
  }, [jetonCommerce]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (panneau === 'imprimante') setNonLus(0); }, [panneau, imprimante]);
  async function ticketDeTest() {
    try {
      await api(`/restaurants/${simulation.restaurantId}/print-test`, { method: 'POST', token: jetonCommerce, logoutOn401: false });
      toast(t('simulation.testQueued'));
    } catch (e) { toast(e.message, 'erreur'); }
  }

  useEffect(() => { ecrire(CLE_OUVERTE, ouverte); }, [ouverte]);
  useEffect(() => { ecrire(CLE_ETAPES, faites); }, [faites]);
  useEffect(() => {
    if (!ouverte) return undefined;
    const surTouche = (e) => { if (e.key === 'Escape') { if (panneau) setPanneau(null); else setOuverte(false); } };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [ouverte, panneau]);

  if (!simulation) return null;
  const profil = simulation.actif;
  const nomProfil = (p) => t(`simulation.profile_${p}`);
  const expiree = simulation.expiresAt && Date.now() > simulation.expiresAt;
  const sansSession = profil !== 'visitor' && !token;

  function changer(p) {
    if (p === profil) return;
    // Le client ouvre directement la fiche du commerce de simulation : c'est là que son parcours commence.
    const chemin = p === 'client' && simulation.restaurantId ? `/restaurants/${simulation.restaurantId}` : ACCUEIL[p];
    changerProfilSimulation(p, chemin);
  }

  const etapes = etapesDe(profil, simulation.restaurantId);
  const cochees = faites[profil] || [];
  function basculer(cle) {
    setFaites((f) => {
      const liste = f[profil] || [];
      return { ...f, [profil]: liste.includes(cle) ? liste.filter((x) => x !== cle) : [...liste, cle] };
    });
  }

  async function envoyerNote(e) {
    e.preventDefault();
    if (!texte.trim()) return;
    // La note part avec la session d'un compte de simulation : celle du profil affiché, ou à défaut celle du client
    // (le profil visiteur n'en a pas). C'est ce compte qui dit à quel admin la note appartient.
    const jeton = token || simulation.profiles?.client?.token || simulation.profiles?.restaurant?.token;
    setEnvoi(true);
    try {
      await api('/simulation/notes', {
        method: 'POST', token: jeton, logoutOn401: false,
        body: { text: texte.trim(), category: categorie, profile: profil, path: location.pathname + location.search, viewport: `${window.innerWidth}×${window.innerHeight}`, language }
      });
      setTexte('');
      setPanneau(null);
      toast(t('simulation.note_saved'));
    } catch (err) { toast(err.message, 'erreur'); } finally { setEnvoi(false); }
  }

  if (!ouverte) {
    return (
      <button type="button" className="simu-pastille" onClick={() => setOuverte(true)} aria-label={t('simulation.bar_show')}>
        <span className="simu-point" aria-hidden="true" />
        {t('simulation.bar_label')} · {nomProfil(profil)}
      </button>
    );
  }

  return (
    <aside className="simu-barre" aria-label={t('simulation.bar_label')}>
      <div className="simu-tete">
        <span className="simu-titre"><span className="simu-point" aria-hidden="true" />{t('simulation.bar_label')}</span>
        <button type="button" className="simu-icone-btn" onClick={() => setOuverte(false)} aria-label={t('simulation.bar_hide')} title={t('simulation.bar_hide')}>–</button>
      </div>

      <div className="simu-profils" role="group" aria-label={t('simulation.bar_viewAs')}>
        {PROFILS_SIMULATION.map((p) => (
          <button key={p} type="button" className={`simu-profil${p === profil ? ' est-actif' : ''}`} aria-pressed={p === profil} onClick={() => changer(p)}>
            <Icone nom={ICONES[p]} taille={18} />
            <span>{nomProfil(p)}</span>
          </button>
        ))}
      </div>

      {(expiree || sansSession) && <p className="simu-alerte">{t('simulation.bar_expired')}</p>}

      <div className="simu-actions">
        <button type="button" className={`simu-action${panneau === 'etapes' ? ' est-actif' : ''}`} onClick={() => setPanneau(panneau === 'etapes' ? null : 'etapes')}>
          {t('simulation.bar_steps')} <span className="simu-compteur">{cochees.length}/{etapes.length}</span>
        </button>
        <button type="button" className={`simu-action${panneau === 'note' ? ' est-actif' : ''}`} onClick={() => setPanneau(panneau === 'note' ? null : 'note')}>
          {t('simulation.bar_note')}
        </button>
        <button type="button" className={`simu-action${panneau === 'imprimante' ? ' est-actif' : ''}`} onClick={() => setPanneau(panneau === 'imprimante' ? null : 'imprimante')} title={t('simulation.bar_printer')}>
          🖨{nonLus > 0 && <span className="simu-compteur">{nonLus}</span>}
        </button>
        <button type="button" className="simu-action simu-quitter" onClick={quitterSimulation}>{t('simulation.bar_quit')}</button>
      </div>

      {panneau === 'etapes' && (
        <div className="simu-panneau">
          <p className="simu-panneau-titre">{t('simulation.steps_title', { profil: nomProfil(profil) })}</p>
          <ul className="simu-etapes">
            {etapes.map(([cle, chemin]) => {
              const fait = cochees.includes(cle);
              return (
                <li key={cle} className={fait ? 'est-fait' : ''}>
                  <input type="checkbox" id={`simu-${profil}-${cle}`} checked={fait} onChange={() => basculer(cle)} />
                  <label htmlFor={`simu-${profil}-${cle}`} className="sr-only">{t(`simulation.step_${profil}_${cle}`)}</label>
                  <Link to={chemin} className={location.pathname === chemin ? 'est-ici' : ''}>{t(`simulation.step_${profil}_${cle}`)}</Link>
                </li>
              );
            })}
          </ul>
          {cochees.length > 0 && (
            <button type="button" className="simu-lien" onClick={() => setFaites((f) => ({ ...f, [profil]: [] }))}>{t('simulation.steps_reset')}</button>
          )}
        </div>
      )}

      {panneau === 'imprimante' && (
        <div className="simu-panneau">
          <p className="simu-panneau-titre">{t('simulation.printerTitle')}</p>
          <p className="simu-contexte" style={{ marginTop: 0 }}>{t('simulation.printerHelp')}</p>
          <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '4px 0' }}>
            <RouleauTickets tickets={imprimante.tickets} nouveaux={imprimante.nouveaux} t={t} max={4} />
          </div>
          <button type="button" className="simu-lien" onClick={ticketDeTest}>{t('simulation.testTicket')}</button>
        </div>
      )}

      {panneau === 'note' && (
        <form className="simu-panneau" onSubmit={envoyerNote}>
          <p className="simu-panneau-titre">{t('simulation.note_title')}</p>
          <div className="simu-categories" role="group" aria-label={t('simulation.note_category')}>
            {CATEGORIES.map((c) => (
              <button key={c} type="button" className={`simu-chip${c === categorie ? ' est-actif' : ''}`} aria-pressed={c === categorie} onClick={() => setCategorie(c)}>
                {t(`simulation.cat_${c}`)}
              </button>
            ))}
          </div>
          <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={2000} placeholder={t('simulation.note_placeholder')} aria-label={t('simulation.note_title')} autoFocus />
          <p className="simu-contexte">{t('simulation.note_context', { page: location.pathname, ecran: `${window.innerWidth}×${window.innerHeight}`, profil: nomProfil(profil) })}</p>
          <div className="simu-form-actions">
            <button type="button" className="simu-lien" onClick={() => setPanneau(null)}>{t('simulation.note_cancel')}</button>
            <button type="submit" className="btn-teal simu-envoyer" disabled={envoi || !texte.trim()}>{envoi ? '…' : t('simulation.note_send')}</button>
          </div>
        </form>
      )}
    </aside>
  );
}
