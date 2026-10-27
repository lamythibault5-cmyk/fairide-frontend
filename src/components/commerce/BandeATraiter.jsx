import { useEffect, useState } from 'react';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { orderTypeLabel } from '../../orderStatus';
import { euros } from '../../prixPlat';
import { numeroCommande, prenom } from './clientCommande';
import Icone from '../Icone';
import '../../ecran-commerce.css';

/* LA COMMANDE À TRAITER AU-DESSUS DES ONGLETS (fondateur, 2026-10-27, réponse 1 A de maquettes/ecrans-pro/ecrans-pro.html :
 * « commerce et livreur aussi soignés que le client »). La carte rouge « 1 commande à traiter » se posait en haut de l'accueil,
 * de Ma carte, des Statistiques, des Promotions et des Factures ; c'est maintenant la bande du client pour sa commande en
 * cours (SuiviCommande.jsx, mêmes classes .suivi-commande de client-ui.css, donc mêmes règles : au-dessus des onglets, cachée
 * sous une fenêtre ouverte ou le clavier). Lime, comme la bande du client quand c'est à lui d'agir : accepter est la prochaine
 * action. L'anneau compte le temps qui reste pour accepter (AnneauDelai.jsx, même calcul, rouge sous 5 minutes) ; un toucher
 * ouvre la feuille « Nouvelle commande » (NouvelleCommandeModale), le rond de droite coupe l'alarme tant qu'elle sonne.
 * App et site sur téléphone ; l'ordinateur garde sa carte (NewOrderAlertBar compacte, DashboardLayout). */
export default function BandeATraiter({ commande, nombre, alarmeEnCours, couperAlarme, onOuvrir }) {
  const { t } = useLanguage();
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  // Place réservée sous le contenu, comme pour la bande du client (html.avec-suivi-commande, qu'elle pose et retire elle-même).
  useEffect(() => {
    document.documentElement.classList.add('avec-bande-a-traiter');
    return () => document.documentElement.classList.remove('avec-bande-a-traiter');
  }, []);
  if (!commande) return null;

  const tour = 2 * Math.PI * 21;
  const fin = commande.acceptDeadline ? new Date(commande.acceptDeadline).getTime() : null;
  const debut = new Date(commande.paidAt || commande.createdAt).getTime();
  const reste = fin ? Math.max(0, fin - maintenant) : null;
  const total = fin ? Math.max(60000, Number.isFinite(debut) ? fin - debut : 15 * 60000) : null;
  const min = reste === null ? null : Math.ceil(reste / 60000);
  // Commande programmée : au-delà d'une heure, l'heure limite plutôt qu'un compte à rebours (même règle qu'AnneauDelai).
  const centre = min === null ? numeroCommande(commande)
    : min > 60 ? new Date(fin).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
      : t('ecransPro.nMin', { n: min });
  const part = reste === null || min > 60 ? 1 : Math.min(1, reste / total);

  const haut = nombre > 1
    ? t('alertBar.toHandle', { n: nombre })
    : `${t('ecransPro.nouvelle')} · ${orderTypeLabel(commande, t)} · ${euros(commande.total)}`;
  const bas = [numeroCommande(commande), prenom(commande.clientName), t('ecransPro.aAccepter')].filter(Boolean).join(' · ');

  return (
    <div className={`suivi-commande suivi-commande--a-toi bande-a-traiter${min !== null && min <= 5 ? ' bande-a-traiter--presse' : ''}`}>
      <button type="button" className="bande-a-traiter-ouvrir" onClick={onOuvrir} aria-label={`${haut} · ${bas}`}>
        <span className="suivi-commande-rond" aria-hidden="true">
          <svg className="suivi-commande-anneau" viewBox="0 0 46 46">
            <circle className="fond" cx="23" cy="23" r="21" />
            <circle className="avance" cx="23" cy="23" r="21" strokeDasharray={`${part * tour} ${tour}`} />
          </svg>
          <span className="suivi-commande-photo bande-a-traiter-centre">{centre}</span>
        </span>
        <span className="suivi-commande-texte">
          <small>{haut}</small>
          <b>{bas}</b>
        </span>
      </button>
      {alarmeEnCours && couperAlarme ? (
        <button type="button" className="bande-a-traiter-son" onClick={couperAlarme} aria-label={t('alertBar.stopAlarm')}>
          <Icone nom="sonCoupe" taille={18} />
        </button>
      ) : <span className="suivi-commande-chevron" aria-hidden="true" />}
    </div>
  );
}
