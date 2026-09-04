import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ContactSection from '../components/ContactSection';
import usePageMeta from '../hooks/usePageMeta';
import { useAuth } from '../context/AuthContext';

// Centre d'aide — la destination des rubriques d'assistance de « Mon compte ».
//
// Elle existe pour une raison précise : plusieurs questions que se pose un client (« ma carte
// est-elle enregistrée ? », « puis-je payer en titres-restaurant ? ») n'avaient AUCUNE réponse
// nulle part sur Fairide. Y répondre par écrit vaut mieux que de faire semblant que la question
// ne se pose pas — et mieux que de poser une rubrique qui n'ouvre rien.
//
// Publique à dessein : quelqu'un qui hésite à commander doit pouvoir lire comment on le fait payer
// avant de créer un compte.

// Chaque entrée du menu Compte arrive ici avec son sujet, ce qui pré-remplit le message du
// formulaire. Sans ça, « Signaler un bug » et « Donner mon avis » aboutiraient au même champ vide
// et l'utilisateur devrait réexpliquer ce sur quoi il vient pourtant de cliquer.
const SUJETS = {
  bug: {
    titre: 'Signaler un bug',
    intro: "Décris ce que tu faisais, ce que tu attendais, et ce qui s'est passé à la place. Si tu peux, précise ton appareil et ton navigateur : c'est souvent ce qui permet de reproduire le problème.",
    message: "Bonjour,\n\nJ'ai rencontré un problème sur Fairide.\n\nCe que je faisais :\nCe que j'attendais :\nCe qui s'est passé :\nMon appareil / navigateur :\n"
  },
  avis: {
    titre: 'Donner mon avis sur Fairide',
    intro: "Ce qui te plaît, ce qui t'agace, ce qui manque. On lit tout — c'est comme ça que la plateforme avance.",
    message: 'Bonjour,\n\nVoici mon avis sur Fairide :\n\n'
  }
};

export default function HelpPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const sujet = SUJETS[params.get('sujet')] || null;
  usePageMeta({ title: 'Aide et contact — Fairide', path: '/aide' });

  // Arrivée depuis « Moyens de paiement » ou « Titres restaurant » : on amène directement à la
  // bonne réponse. Le navigateur ne le fait pas seul, l'ancre étant rendue après la navigation.
  const ancre = params.get('sujet');
  useEffect(() => {
    if (!ancre || SUJETS[ancre]) return;
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

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>{sujet ? sujet.titre : 'Aide et contact'}</h2>

      {sujet && <p className="small" style={{ margin: '-6px 0 16px' }}>{sujet.intro}</p>}

      {!sujet && (
        <>
          <div className="card" id="paiement">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>💳 Moyens de paiement</h3>
            <p className="small" style={{ margin: '0 0 10px' }}>
              <b>Fairide n'enregistre aucune carte bancaire.</b> Il n'y a donc pas de moyen de paiement
              à gérer ici, et rien à supprimer si tu changes de carte. À chaque commande, tu es
              redirigé vers une page de paiement <b>Stripe</b>, qui traite seule tes coordonnées
              bancaires — nous ne les voyons jamais et ne les stockons nulle part.
            </p>
            <p className="small" style={{ margin: '0 0 10px' }}>
              Si ton navigateur ou ton téléphone propose d'enregistrer ta carte au moment de payer,
              c'est Stripe, Apple&nbsp;Pay ou Google&nbsp;Pay qui la conserve — pas Fairide.
            </p>
            <p className="small" style={{ margin: 0 }}>
              Tu disposes en revanche d'un <b>solde Fairide</b>, alimenté par les codes promo et le
              parrainage. Il se déduit automatiquement de tes commandes et se consulte en haut de
              {' '}<Link to="/account">Mon compte</Link>.
            </p>
          </div>

          <div className="card" id="titres-restaurant">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>🎫 Titres-restaurant</h3>
            <p className="small" style={{ margin: '0 0 10px' }}>
              <b>Fairide n'accepte pas encore les titres-restaurant</b> — ni Monizze, ni Edenred, ni
              Sodexo. On préfère l'écrire noir sur blanc plutôt que de te le faire découvrir au
              moment de payer.
            </p>
            <p className="small" style={{ margin: 0 }}>
              C'est une demande fréquente en Belgique et elle est notée. Si c'est bloquant pour toi,
              dis-le dans le formulaire ci-dessous : le nombre de demandes décidera de l'ordre des
              priorités.
            </p>
          </div>

          <div className="card" id="adresse">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>📍 Adresse de livraison</h3>
            <p className="small" style={{ margin: 0 }}>
              Fairide retient <b>une</b> adresse, celle de ton profil. Elle pré-remplit le formulaire
              au moment de commander, et tu peux la corriger à ce moment-là sans toucher à ton profil
              — pratique pour te faire livrer une fois ailleurs. Pour changer l'adresse retenue,
              modifie-la dans <Link to="/account">Mon compte</Link>.
            </p>
          </div>

          <div className="card" id="commande">
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>📦 Un souci avec une commande ?</h3>
            <p className="small" style={{ margin: 0 }}>
              Le suivi en direct, le détail et le reçu de chaque commande sont dans
              {' '}<Link to={user?.role === 'client' ? '/orders' : '/account'}>Mes commandes</Link>.
              Pour un problème sur une commande précise, indique son numéro dans le formulaire :
              c'est ce qui permet de la retrouver tout de suite.
            </p>
          </div>
        </>
      )}

      {sujet && (
        <p className="small" style={{ margin: '0 0 16px' }}>
          <Link to="/aide">← Voir toutes les réponses</Link>
        </p>
      )}

      {/* La clé force le remontage en changeant de sujet : sans elle, passer de « bug » à « avis »
          garderait la trame précédente, puisqu'un état initial ne se relit pas. */}
      <ContactSection key={ancre || 'general'} messageInitial={sujet?.message} />
    </div>
  );
}
