import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContactSection from '../components/ContactSection';
import usePageMeta from '../hooks/usePageMeta';
import RetourCompte from '../components/RetourCompte';
import Rich from '../components/Rich';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Centre d'aide — la destination des rubriques d'assistance de « Mon compte ».
//
// Elle existe pour une raison précise : plusieurs questions que se pose un client (« ma carte
// est-elle enregistrée ? », « puis-je payer en titres-restaurant ? ») n'avaient AUCUNE réponse
// nulle part sur Fairide. Y répondre par écrit vaut mieux que de faire semblant que la question
// ne se pose pas — et mieux que de poser une rubrique qui n'ouvre rien.
//
// Publique à dessein : quelqu'un qui hésite à commander doit pouvoir lire comment on le fait payer
// avant de créer un compte. Le texte est dans translations.js (espace `help`), en trois langues.

// Chaque entrée du menu Compte arrive ici avec son sujet, ce qui pré-remplit le message du
// formulaire. Sans ça, « Signaler un bug » et « Donner mon avis » aboutiraient au même champ vide
// et l'utilisateur devrait réexpliquer ce sur quoi il vient pourtant de cliquer.
const SUJETS = ['bug', 'avis'];
// Les réponses, dans l'ordre : identifiant d'ancre (cible des liens de Mon compte) et nombre de paragraphes.
const REPONSES = [['paiement', 3], ['titres-restaurant', 2], ['adresse', 1], ['commande', 1]];
const CLE_REPONSE = { paiement: 'payment', 'titres-restaurant': 'vouchers', adresse: 'address', commande: 'order' };

export default function HelpPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const sujet = SUJETS.includes(params.get('sujet')) ? params.get('sujet') : null;
  usePageMeta({ title: t('help.pageTitle'), path: '/aide' });

  // Arrivée depuis « Moyens de paiement » ou « Titres restaurant » : on amène directement à la
  // bonne réponse. Le navigateur ne le fait pas seul, l'ancre étant rendue après la navigation.
  const ancre = params.get('sujet');
  useEffect(() => {
    if (!ancre || SUJETS.includes(ancre)) return;
    const cible = document.getElementById(ancre);
    if (!cible) return;

    // Le bandeau du site est collant : un scrollIntoView() amenait le titre de la réponse
    // EXACTEMENT dessous, donc invisible. Il faut le décaler de la hauteur du bandeau — mesurée,
    // car elle dépend de la largeur d'écran (98px sur téléphone, moins au-delà).
    //
    // Et il faut recommencer, pas seulement calculer une position une fois : mesuré, le document
    // remonte de 40px APRÈS le saut, le bandeau se compactant une fois la page défilée. On corrige
    // donc par ÉCART (scrollBy) plutôt que par position absolue — un écart se recalcule sur l'état
    // réel et converge, là où une cible calculée d'avance reste fausse de ce qu'elle a raté.
    const ajuster = () => {
      const entete = document.querySelector('.hero');
      const decalage = entete && getComputedStyle(entete).position === 'sticky'
        ? entete.getBoundingClientRect().height : 0;
      const ecart = cible.getBoundingClientRect().top - decalage - 12;
      if (Math.abs(ecart) > 2) window.scrollBy(0, ecart);
    };
    // Saut instantané, pas de défilement animé : on arrive par un lien qui désigne une réponse
    // précise, et l'animation ferait défiler tout ce qu'on n'a pas demandé à lire avant d'y parvenir.
    //
    // Le calendrier va jusqu'à 1600ms pour une raison précise : ScrollRestorer réapplique la
    // position mémorisée de /aide par tentatives échelonnées jusqu'à 1500ms. Sans dépasser cette
    // échéance, quelqu'un ayant déjà consulté la page atterrissait à son ancienne position au lieu
    // de la réponse demandée — la restauration doit céder devant une ancre explicite, qui est une
    // intention formulée à l'instant.
    ajuster();
    const minuteurs = [60, 200, 500, 900, 1300, 1600].map((d) => setTimeout(ajuster, d));
    return () => minuteurs.forEach(clearTimeout);
  }, [ancre]);

  // Le lien « Mes commandes » mène un client à ses commandes, tout autre visiteur à son compte.
  const lienCommandes = user?.role === 'client' ? '/orders' : '/account';

  return (
    <div>
      <RetourCompte />
      <h2 className="section-title" style={{ marginTop: 0 }}>{sujet ? t(`help.${sujet}Title`) : t('help.title')}</h2>

      {sujet && <p className="small" style={{ margin: '-6px 0 16px' }}>{t(`help.${sujet}Intro`)}</p>}

      {!sujet && REPONSES.map(([id, n]) => (
        <div className="card" id={id} key={id}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{t(`help.${CLE_REPONSE[id]}Title`)}</h3>
          {Array.from({ length: n }, (_, i) => (
            <p key={i} className="small" style={{ margin: i === n - 1 ? 0 : '0 0 10px' }}>
              <Rich text={t(`help.${CLE_REPONSE[id]}${i + 1}`).replace('{ordersLink}', lienCommandes)} />
            </p>
          ))}
        </div>
      ))}

      {sujet && (
        <p className="small" style={{ margin: '0 0 16px' }}>
          <Rich text={`[${t('help.seeAllAnswers')}](/aide)`} />
        </p>
      )}

      {/* La clé force le remontage en changeant de sujet : sans elle, passer de « bug » à « avis »
          garderait la trame précédente, puisqu'un état initial ne se relit pas. */}
      <ContactSection key={ancre || 'general'} messageInitial={sujet ? t(`help.${sujet}Message`) : undefined} />
    </div>
  );
}
