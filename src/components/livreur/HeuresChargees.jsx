import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { useLanguage, getLocale } from '../../context/LanguageContext';
import { vibrer } from '../../gestes';

/* LES HEURES CHARGÉES (fondateur, 2026-10-31, maquettes/revue-parcours, question 3 A) : sous « Aucune commande disponible »,
   combien de commandes arrivent d'habitude à chaque heure de 11 h à 23 h, jour par jour, autour de lui (4 dernières
   semaines, GET /couriers/me/busy-hours). L'heure actuelle est entourée de lime. Des commandes, jamais le livreur : rien ne
   le classe ni ne le note. Tant qu'il y a trop peu de commandes pour dire quelque chose (moins de 20 en 4 semaines), rien. */
const MINIMUM = 20;

// Jour ISO (1 = lundi) et heure à Bruxelles, maintenant.
function maintenantBruxelles() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { jour: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1, heure: Number(p.hour) };
}

// La plage la plus chargée : les heures d'affilée autour du maximum qui en font au moins 70 %.
function plageChargee(valeurs, heures) {
  const max = Math.max(...valeurs);
  if (!(max > 0)) return null;
  const k = valeurs.indexOf(max);
  let a = k; let b = k;
  while (a > 0 && valeurs[a - 1] >= max * 0.7) a -= 1;
  while (b < valeurs.length - 1 && valeurs[b + 1] >= max * 0.7) b += 1;
  return { de: heures[a], a: heures[b] + 1 };
}

export default function HeuresChargees({ token, position }) {
  const { t } = useLanguage();
  const maintenant = useMemo(maintenantBruxelles, []);
  const [donnees, setDonnees] = useState(null);
  const [jour, setJour] = useState(maintenant.jour);
  // Position arrondie (~1 km) : assez pour « autour de toi », et la requête ne change pas à chaque pas.
  const lat = position ? Math.round(position.lat * 100) / 100 : null;
  const lng = position ? Math.round(position.lng * 100) / 100 : null;

  useEffect(() => {
    if (!token) return undefined;
    let actif = true;
    const q = lat != null && lng != null ? `?lat=${lat}&lng=${lng}` : '';
    api(`/couriers/me/busy-hours${q}`, { token }).then((d) => { if (actif) setDonnees(d); }).catch(() => {});
    return () => { actif = false; };
  }, [token, lat, lng]);

  if (!donnees || !(donnees.total >= MINIMUM)) return null;
  const valeurs = donnees.jours?.[jour] || [];
  const max = Math.max(...valeurs, 0.1);
  const plage = plageChargee(valeurs, donnees.heures);
  const auj = jour === maintenant.jour;
  // Libellés courts des jours dans la langue du livreur, lundi d'abord (5 janvier 2026 était un lundi).
  const nomsCourts = Array.from({ length: 7 }, (_, k) => new Intl.DateTimeFormat(getLocale(), { weekday: 'short' }).format(new Date(Date.UTC(2026, 0, 5 + k, 12))).replace('.', ''));
  const nomLong = new Intl.DateTimeFormat(getLocale(), { weekday: 'long' }).format(new Date(Date.UTC(2026, 0, 4 + jour, 12)));

  return (
    <section className="ecl-heures" aria-label={t('ecranLivreur.heuresTitre', { jour: nomLong })}>
      <b className="ecl-heures-titre">{t('ecranLivreur.heuresTitre', { jour: nomLong })}</b>
      {plage && <p className="ecl-heures-plage">{t('ecranLivreur.heuresPlage', { de: plage.de, a: plage.a })}</p>}
      <div className="ecl-heures-barres" aria-hidden="true">
        {valeurs.map((n, k) => (
          <span key={donnees.heures[k]}
            className={`${n >= max * 0.7 ? 'fort' : ''}${auj && donnees.heures[k] === maintenant.heure ? ' maintenant' : ''}`}
            style={{ height: `${Math.max(6, (n / max) * 100)}%` }} />
        ))}
      </div>
      <div className="ecl-heures-axe" aria-hidden="true">{donnees.heures.map((h) => <span key={h}>{h}</span>)}</div>
      <div className="ecl-heures-jours" role="group">
        {nomsCourts.map((nom, k) => (
          <button key={nom} type="button" className={jour === k + 1 ? 'on' : ''} aria-pressed={jour === k + 1}
            onClick={() => { vibrer(); setJour(k + 1); }}>{nom}</button>
        ))}
      </div>
      <p className="ecl-heures-source">
        {auj && maintenant.heure >= donnees.heures[0] && maintenant.heure <= donnees.heures[donnees.heures.length - 1] ? `${t('ecranLivreur.heuresMaintenant')} ` : ''}
        {donnees.rayonKm ? t('ecranLivreur.heuresSourceAutour', { km: donnees.rayonKm }) : t('ecranLivreur.heuresSource')}
      </p>
    </section>
  );
}
