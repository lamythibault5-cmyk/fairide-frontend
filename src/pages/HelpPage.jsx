import { useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { experienceApp } from '../natif';
import { remonterEnHaut } from '../remonter';
import ContactSection from '../components/ContactSection';
import usePageMeta from '../hooks/usePageMeta';
import { BandeauGeneral, FeuilleGenerale, SectionGenerale } from '../components/EcranGeneral';
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
// « Les prix sont-ils les mêmes qu'au restaurant ? » en premier (fondateur, 2026-10-19) : c'est la première raison de choisir
// Fairide, et la réponse porte le calcul complet que l'accueil du site montre sans note (HeroPrix.jsx).
const REPONSES = [['prix', 3], ['paiement', 3], ['titres-restaurant', 2], ['adresse', 1], ['commande', 1]];
const CLE_REPONSE = { prix: 'prices', paiement: 'payment', 'titres-restaurant': 'vouchers', adresse: 'address', commande: 'order' };
const APPLI = experienceApp();

export default function HelpPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const sujet = SUJETS.includes(params.get('sujet')) ? params.get('sujet') : null;
  usePageMeta({ title: t('help.pageTitle'), description: t('seo.helpDescription'), path: '/aide' });

  // Arrivée depuis « Moyens de paiement » ou « Titres restaurant » : on amène directement à la
  // bonne réponse. Le navigateur ne le fait pas seul, l'ancre étant rendue après la navigation.
  const ancre = params.get('sujet');

  // UN LIEN VERS /aide QUAND ON Y EST DÉJÀ (« Aide » de l'en-tête depuis « Contact », fondateur, 2026-10-16) : même chemin,
  // donc ScrollRestorer ne remonte pas, et le nouveau contenu s'affichait sous la position où l'on était resté, souvent tout
  // en bas. Chaque nouvelle navigation remonte en haut — sauf vers une réponse précise (l'effet ci-dessous y amène).
  const location = useLocation();
  const derniereNavigation = useRef(location.key);
  useEffect(() => {
    if (derniereNavigation.current === location.key) return;
    derniereNavigation.current = location.key;
    // Dans l'app, chaque réponse est son propre écran (plus bas) : on remonte toujours.
    if (APPLI || !ancre || SUJETS.includes(ancre)) remonterEnHaut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);
  useEffect(() => {
    if (APPLI || !ancre || SUJETS.includes(ancre)) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancre, location.key]);

  // Le lien « Mes commandes » mène un client à ses commandes, tout autre visiteur à son compte.
  const lienCommandes = user?.role === 'client' ? '/orders' : '/account';
  const paragraphes = (id, n) => Array.from({ length: n }, (_, i) => (
    <p key={i}><Rich text={t(`help.${CLE_REPONSE[id]}${i + 1}`).replace('{ordersLink}', lienCommandes)} /></p>
  ));

  /* DANS L'APP, UNE QUESTION = UN ÉCRAN (fondateur, 2026-10-28, capture de « Titres-restaurant » depuis Mon compte) : la
     rangée du compte ouvrait la page entière, défilée jusqu'à la réponse dépliée au milieu des autres — deux ‹ à l'écran
     (celui du bandeau, à moitié sous l'heure, et celui qui flotte), et il fallait remonter ou descendre pour comprendre où
     l'on était. Maintenant /aide est une liste de rangées, chacune ouvre /aide?sujet=<réponse> : le bandeau porte la
     question, la feuille la réponse, puis le formulaire (« dis-le dans le formulaire ci-dessous » reste vrai). Le ‹ revient
     là d'où l'on vient (Mon compte, Recherche ou la liste) : le retour de BandeauGeneral, pas un lien fixe vers le compte.
     Le site garde ses <details> : une seule page lisible par les moteurs, ouverte sur la réponse demandée. */
  if (APPLI) {
    const reponse = REPONSES.find(([id]) => id === ancre);
    const ecrire = ancre === 'contact';
    return (
      <div className="gn-page">
        <BandeauGeneral
          titre={reponse ? t(`help.${CLE_REPONSE[reponse[0]]}Title`) : ecrire ? t('help.writeTitle') : sujet ? t(`help.${sujet}Title`) : t('help.title')}
          sous={reponse ? null : ecrire ? t('help.writeSub') : sujet ? t(`help.${sujet}Intro`) : t('help.sous')} />
        <FeuilleGenerale>
          {reponse && <div className="gn-reponse gn-reponse--seule">{paragraphes(...reponse)}</div>}
          {!reponse && !ecrire && !sujet && (
            <>
              <SectionGenerale>{t('help.questionsTitle')}</SectionGenerale>
              <div className="gn-questions">
                {REPONSES.map(([id]) => (
                  <Link key={id} to={`/aide?sujet=${id}`} className="gn-question-lien">{t(`help.${CLE_REPONSE[id]}Title`)}</Link>
                ))}
                <Link to="/aide?sujet=contact" className="gn-question-lien">{t('help.writeTitle')}</Link>
              </div>
            </>
          )}
          {(reponse || ecrire || sujet) && (
            <div id="contact" className="gn-contact">
              <ContactSection key={ancre || 'general'} messageInitial={sujet ? t(`help.${sujet}Message`) : undefined} />
            </div>
          )}
        </FeuilleGenerale>
      </div>
    );
  }

  /* LE DESSIN (fondateur, 2026-10-19, section 4 de finitions-appli.html) : bandeau iris et feuille blanche (EcranGeneral.jsx),
     tout sur le blanc sous l'en-tête du site pour un visiteur. Le « ← Mon compte » (RetourCompte.jsx, connecté seulement)
     devient le rond du bandeau. Les réponses sont des rangées à filet qui s'ouvrent (<details> : clavier, lecteur d'écran et
     recherche dans la page sans une ligne de code) ; celle qu'un lien de Mon compte désigne arrive ouverte. */
  const retourCompte = user
    ? { vers: '/account', etat: { restaurerDefilement: true }, libelle: t('nav.backToAccount').replace(/^←\s*/, '') }
    : null;
  return (
    <div className="gn-page">
      <BandeauGeneral icone="bouee" retour={retourCompte}
        titre={sujet ? t(`help.${sujet}Title`) : t('help.title')}
        sous={sujet ? t(`help.${sujet}Intro`) : t('help.sous')} />
      <FeuilleGenerale>
        {!sujet && (
          <>
            <SectionGenerale>{t('help.questionsTitle')}</SectionGenerale>
            <div className="gn-questions">
              {REPONSES.map(([id, n]) => (
                // La clé suit l'ancre : arriver sur une autre réponse (même page, autre lien) remonte la rangée, ouverte.
                <details className="gn-question" id={id} key={`${id}-${ancre === id}`} open={ancre === id}>
                  <summary>{t(`help.${CLE_REPONSE[id]}Title`)}</summary>
                  <div className="gn-reponse">{paragraphes(id, n)}</div>
                </details>
              ))}
            </div>
          </>
        )}

        {sujet && (
          <p className="gn-texte" style={{ margin: 0 }}>
            <Rich text={`[${t('help.seeAllAnswers')}](/aide)`} />
          </p>
        )}

        {/* La clé force le remontage en changeant de sujet : sans elle, passer de « bug » à « avis »
            garderait la trame précédente, puisqu'un état initial ne se relit pas. */}
        {/* id="contact" : cible du lien « Contact » de l'en-tête (/aide?sujet=contact, voir l'effet plus haut). */}
        <div id="contact" className="gn-contact">
          <ContactSection key={ancre || 'general'} messageInitial={sujet ? t(`help.${sujet}Message`) : undefined} />
        </div>
      </FeuilleGenerale>
    </div>
  );
}
