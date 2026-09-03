import { Fragment, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { statusLabel } from '../../orderStatus';

// Agenda des réservations : une journée, table par table.
//
// Deux lectures de la même journée, parce qu'elles répondent à deux questions différentes.
// La grille dit « où reste-t-il de la place ? » — c'est une question d'espace, elle se lit sur un
// plan. La liste dit « qui arrive, et quand ? » — c'est une question de temps, elle se lit dans
// l'ordre. Un seul des deux affichages laisserait l'autre question sans réponse.

const PLAGE_DEFAUT = { debut: 11, fin: 23 };

function isoDuJour(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(d);
}

function heureLocale(ms) {
  return new Intl.DateTimeFormat('fr-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
}

// Minutes depuis minuit, à l'heure de Bruxelles — le navigateur du restaurateur peut être ailleurs,
// et une réservation doit s'afficher à l'heure de sa salle, pas à celle de son téléphone.
function minutesLocales(ms) {
  const [h, m] = heureLocale(ms).split(':').map(Number);
  return h * 60 + m;
}

// Minutes depuis minuit DU JOUR AFFICHÉ — négatif pour une réservation entamée la veille. Une table
// prise à 23h pour deux heures est encore occupée à 00h30 : elle appartient au petit matin de cette
// journée, pas à sa fin de soirée. Sans ce décalage elle se dessinerait à l'autre bout de la grille.
function minutesDansLeJour(r, date) {
  const m = minutesLocales(r.startAt);
  return isoDuJour(new Date(r.startAt)) === date ? m : m - 1440;
}

function decalerJour(iso, jours) {
  const [a, mo, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, mo - 1, j + jours, 12));
  return isoDuJour(d);
}

function libelleJour(iso) {
  const [a, mo, j] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(a, mo - 1, j, 12)));
}

export default function ReservationsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId } = useOutletContext();

  const [date, setDate] = useState(() => isoDuJour(new Date()));
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    if (!restoId) return;
    setChargement(true);
    api(`/restaurants/${restoId}/reservations?date=${date}`, { token })
      .then(setDonnees)
      .catch((e) => toast(e.message))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId, date]);

  // Les réservations renvoyées débordent d'un jour de chaque côté (une table prise à 23:30 la veille
  // occupe encore le début de cette journée). On ne garde que celles qui touchent le jour affiché.
  const duJour = useMemo(() => {
    if (!donnees) return [];
    return donnees.reservations.filter((r) => {
      const finIso = isoDuJour(new Date(r.startAt + r.durationMinutes * 60000));
      return isoDuJour(new Date(r.startAt)) === date || finIso === date;
    });
  }, [donnees, date]);

  const actives = useMemo(() => duJour.filter((r) => !['refuse', 'annule'].includes(r.status)), [duJour]);

  // La grille s'étend sur les heures réellement occupées, élargies à la plage par défaut : cadrer au
  // plus juste ferait sauter l'échelle d'un jour à l'autre, ce qui rend deux journées incomparables.
  const plage = useMemo(() => {
    let debut = PLAGE_DEFAUT.debut * 60;
    let fin = PLAGE_DEFAUT.fin * 60;
    for (const r of actives) {
      const d = minutesDansLeJour(r, date);
      debut = Math.min(debut, Math.max(0, d));
      fin = Math.max(fin, d + r.durationMinutes);
    }
    return { debut: Math.max(0, Math.floor(debut / 60) * 60), fin: Math.min(24 * 60, Math.ceil(fin / 60) * 60) };
  }, [actives, date]);

  const heures = useMemo(() => {
    const out = [];
    for (let m = plage.debut; m < plage.fin; m += 60) out.push(m / 60);
    return out;
  }, [plage]);

  const tables = donnees?.tables?.filter((t) => t.active) || [];
  const couverts = actives.reduce((a, r) => a + (r.partySize || 0), 0);
  const largeurMinutes = Math.max(1, plage.fin - plage.debut);

  const estAujourdhui = date === isoDuJour(new Date());

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>📅 Réservations</h2>

      <div className="card">
        <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, -1))} aria-label="Jour précédent">←</button>
          <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', textTransform: 'capitalize' }}>{libelleJour(date)}</b>
            {!estAujourdhui && (
              <button type="button" className="btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }}
                onClick={() => setDate(isoDuJour(new Date()))}>revenir à aujourd'hui</button>
            )}
          </div>
          <button type="button" className="btn-outline" style={{ padding: '7px 12px' }}
            onClick={() => setDate((d) => decalerJour(d, 1))} aria-label="Jour suivant">→</button>
        </div>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ marginTop: 10 }} />
      </div>

      {chargement && <p className="small">Chargement…</p>}

      {!chargement && donnees && tables.length === 0 && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            Aucune table déclarée : la grille ne peut rien afficher. Ajoute tes tables dans
            <b> Mon compte → Plan de salle</b> pour suivre ton service table par table.
          </p>
        </div>
      )}

      {!chargement && donnees && tables.length > 0 && (
        <div className="card">
          <p className="small" style={{ margin: '0 0 10px' }}>
            <b>{actives.length}</b> réservation{actives.length > 1 ? 's' : ''} ·
            {' '}<b>{couverts}</b> couvert{couverts > 1 ? 's' : ''} ·
            {' '}{tables.length} table{tables.length > 1 ? 's' : ''}
          </p>

          {/* La grille défile horizontalement : douze heures ne tiennent pas sur un téléphone, et
              comprimer les colonnes rendrait les blocs d'une heure illisibles. */}
          <div className="resa-grid-wrap">
            <div className="resa-grid" style={{ '--resa-heures': heures.length }}>
              <div className="resa-grid-coin" />
              {heures.map((h) => <div key={h} className="resa-grid-heure">{String(h).padStart(2, '0')}h</div>)}

              {tables.map((t) => (
                <Fragment key={t.id}>
                  <div className="resa-grid-table">
                    {/* La colonne est étroite pour laisser de la place à la grille : un nom long est
                        coupé, l'infobulle le rend quand même lisible. */}
                    <b title={t.name}>{t.name}</b>
                    <span className="small">{t.seats} pl.</span>
                  </div>
                  <div className="resa-grid-piste">
                    {actives.filter((r) => r.tableId === t.id).map((r) => {
                      // On dessine la portion visible, pas la réservation entière : une table encore
                      // occupée depuis la veille ne doit montrer que ce qui déborde sur ce jour-ci.
                      const d = minutesDansLeJour(r, date);
                      const g = Math.max(d, plage.debut);
                      const f = Math.min(d + r.durationMinutes, plage.fin);
                      if (f <= g) return null;
                      const gauche = ((g - plage.debut) / largeurMinutes) * 100;
                      const large = ((f - g) / largeurMinutes) * 100;
                      return (
                        <div
                          key={r.id}
                          className={`resa-bloc resa-bloc-${r.status}`}
                          style={{ left: `${gauche}%`, width: `${large}%` }}
                          title={`${r.reservationName} · ${r.partySize} pers. · ${heureLocale(r.startAt)}`}
                        >
                          <b>{r.reservationName}</b>
                          <span>{r.partySize}p</span>
                        </div>
                      );
                    })}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* Une réservation sans table attribuée n'apparaît nulle part dans la grille : elle a été
              prise avant que le plan de salle n'existe. La signaler, sinon le restaurateur croit
              qu'elle a disparu. */}
          {actives.some((r) => !r.tableId) && (
            <p className="small" style={{ margin: '10px 0 0', padding: '8px 10px', background: 'var(--cream-dim)', borderRadius: 9 }}>
              ⚠️ {actives.filter((r) => !r.tableId).length} réservation(s) sans table attribuée — prises
              avant que tu ne déclares ton plan de salle. Elles sont listées ci-dessous mais absentes
              de la grille.
            </p>
          )}
        </div>
      )}

      {!chargement && donnees && (
        <div className="card">
          <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Dans l'ordre d'arrivée</h3>
          {duJour.length === 0 && <p className="small" style={{ margin: 0 }}>Aucune réservation ce jour-là.</p>}
          {duJour.slice().sort((a, b) => a.startAt - b.startAt).map((r) => {
            const table = donnees.tables.find((t) => t.id === r.tableId);
            return (
              <div key={r.id} className="resa-ligne">
                <div className="resa-ligne-heure">
                  <b>{heureLocale(r.startAt)}</b>
                  <span className="small">{heureLocale(r.startAt + r.durationMinutes * 60000)}</span>
                </div>
                <div className="resa-ligne-corps">
                  <b>{r.reservationName}</b>
                  <span className="small">
                    {r.partySize} personne{r.partySize > 1 ? 's' : ''}
                    {table ? ` · ${table.name}` : ' · sans table attribuée'}
                    {r.itemCount > 0 ? ` · ${r.itemCount} plat${r.itemCount > 1 ? 's' : ''} commandé${r.itemCount > 1 ? 's' : ''}` : ''}
                  </span>
                  {r.clientPhone && <span className="small">📞 {r.clientPhone}</span>}
                </div>
                <span className={`status-badge status-${r.status}`}>{statusLabel(r.status, 'dine_in')}</span>
              </div>
            );
          })}
        </div>
      )}

      {!restaurant?.offersDineIn && (
        <div className="card">
          <p className="small" style={{ margin: 0 }}>
            La réservation de table est désactivée pour ton commerce : aucun nouveau client ne peut
            réserver. Tu peux la réactiver dans <b>Mon compte → Services proposés</b>.
          </p>
        </div>
      )}
    </div>
  );
}
