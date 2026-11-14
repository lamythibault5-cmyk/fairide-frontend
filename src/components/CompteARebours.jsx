import { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCompteARebours } from '../launch';
import '../compte-a-rebours.css';

/* LE COMPTE À REBOURS DE L'OUVERTURE (Owen, 2026-11-14, maquettes/compte-a-rebours : « A (bandeau) + fiche du commerce,
 * chiffres en rouleau, H1, site pareil, aucun petit plus »). Le lancement Instagram annonce l'ouverture ; l'app et le site
 * comptent jusqu'à elle, à la seconde.
 *
 * L'HEURE VIENT DU SERVEUR (GET /orders/launch › compteAReboursAt, réglée dans Admin › Aujourd'hui, BoutonGo.jsx), JAMAIS DU
 * CODE : une date écrite dans l'app restait dans chaque app installée (2026-10-31, lancement.md). Pas d'heure, ou GO déjà
 * pressé : rien du tout. ELLE N'OUVRE RIEN : à zéro, tant que l'équipe n'a pas pressé GO, on lit « C'est pour aujourd'hui.
 * On ouvre dans un instant. » (version H1 : pas de 00:00:00 figé qui aurait l'air en panne). Dès que l'app voit le GO (elle
 * relit l'état chaque minute et au retour dans l'app, launch.js), le serveur ne l'envoie plus et le compteur disparaît.
 *
 * LES CHIFFRES ROULENT (version « Rouleau ») : chaque chiffre est une colonne 0-9 qui glisse vers le haut, en `transform`
 * seulement (aucune mise en page par seconde) ; sans animation quand le téléphone demande moins de mouvement.
 * `titre` : « On ouvre dans » au-dessus (bandeau, accueil du site) ; la fiche n'a que le rouleau (Owen : « juste le rouleau »). */
const deux = (n) => String(Math.min(99, Math.max(0, n))).padStart(2, '0');

function Chiffre({ valeur }) {
  return (
    <span className="car-ch">
      <span className="car-col" style={{ transform: `translateY(${-Number(valeur)}em)` }}>
        {'0123456789'.split('').map((c) => <span key={c}>{c}</span>)}
      </span>
    </span>
  );
}

function Groupe({ valeur, libelle }) {
  const txt = deux(valeur);
  return (
    <span className="car-grp">
      <span className="car-chiffres"><Chiffre valeur={txt[0]} /><Chiffre valeur={txt[1]} /></span>
      <span className="car-lib">{libelle}</span>
    </span>
  );
}

export default function CompteARebours({ titre = true, className = '' }) {
  const { t } = useLanguage();
  const at = useCompteARebours();
  const fin = at ? Date.parse(at) : 0;
  const [maintenant, setMaintenant] = useState(() => Date.now());

  // Un battement par seconde, calé sur la seconde pleine, tant qu'il reste du temps. Arrivé à zéro, plus rien ne bat :
  // le message d'attente reste jusqu'au GO.
  useEffect(() => {
    if (!fin) return undefined;
    let minuterie = null;
    const battre = () => {
      const n = Date.now();
      setMaintenant(n);
      if (n < fin) minuterie = setTimeout(battre, 1000 - (n % 1000) + 5);
    };
    battre();
    return () => clearTimeout(minuterie);
  }, [fin]);

  if (!at) return null;
  const reste = Math.max(0, fin - maintenant);
  if (reste === 0) {
    return (
      <div className={`car car--attente${className ? ` ${className}` : ''}`} role="status">
        <b>{t('compteARebours.aujourdhui')}</b>
        <span>{t('compteARebours.instant')}</span>
      </div>
    );
  }
  const s = Math.floor(reste / 1000);
  const j = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60);
  return (
    // role="timer" : un lecteur d'écran lit la phrase entière (à la minute), pas les colonnes de chiffres.
    <div className={`car${className ? ` ${className}` : ''}`} role="timer" aria-label={t('compteARebours.lecteur', { j, h, m })}>
      {titre && <span className="car-titre" aria-hidden="true">{t('compteARebours.titre')}</span>}
      <span className="car-rangee" aria-hidden="true">
        <Groupe valeur={j} libelle={t(j === 1 ? 'compteARebours.jour' : 'compteARebours.jours')} />
        <Groupe valeur={h} libelle={t('compteARebours.heures')} />
        <Groupe valeur={m} libelle={t('compteARebours.minutes')} />
        <Groupe valeur={s % 60} libelle={t('compteARebours.secondes')} />
      </span>
    </div>
  );
}
