import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// Plan de salle : les tables que le restaurant peut réserver, et les règles de réservation.
//
// C'est ce qui donne au restaurant une capacité opposable. Sans table déclarée, la plateforme
// accepte les réservations sans en limiter le nombre — comportement historique, conservé pour ne
// pas priver de réservations un restaurateur qui n'a rien configuré, mais qui ne protège de rien.
// D'où l'encart d'alerte quand la liste est vide.
//
// Le nombre de places décide seul de la capacité : une réservation occupe UNE table, la plus petite
// qui accueille le groupe. Le nom ne sert qu'au restaurateur, pour s'y retrouver dans sa salle.

const JOURS = [
  { cle: 'mon', label: 'Lundi' }, { cle: 'tue', label: 'Mardi' }, { cle: 'wed', label: 'Mercredi' },
  { cle: 'thu', label: 'Jeudi' }, { cle: 'fri', label: 'Vendredi' }, { cle: 'sat', label: 'Samedi' },
  { cle: 'sun', label: 'Dimanche' }
];

export default function TablesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const { restaurant, restoId, loadDashboard } = useOutletContext();

  const [tables, setTables] = useState(null);
  const [nom, setNom] = useState('');
  const [places, setPlaces] = useState(2);
  const [ajout, setAjout] = useState(false);
  const [enCours, setEnCours] = useState(null);

  // Réglages de réservation. `heuresPropres` distingue « je suis mes horaires d'ouverture » (null en
  // base) de « j'ai mes propres services » — deux intentions différentes qu'une simple absence de
  // valeur ne saurait pas exprimer.
  const [heuresPropres, setHeuresPropres] = useState(false);
  const [heures, setHeures] = useState({});
  const [pas, setPas] = useState(30);
  const [dureeMax, setDureeMax] = useState(180);
  const [horizon, setHorizon] = useState(30);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    if (!restoId) return;
    api(`/restaurants/${restoId}/tables`, { token }).then(setTables).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoId]);

  useEffect(() => {
    if (!restaurant) return;
    setHeuresPropres(!!restaurant.reservationHours);
    setHeures(restaurant.reservationHours || restaurant.hours || {});
    setPas(restaurant.reservationSlotMinutes || 30);
    setDureeMax(restaurant.reservationMaxMinutes || 180);
    setHorizon(restaurant.reservationMaxDays || 30);
  }, [restaurant]);

  async function ajouterTable(e) {
    e.preventDefault();
    if (!nom.trim()) { toast('Donne un nom à la table.'); return; }
    setAjout(true);
    try {
      const t = await api(`/restaurants/${restoId}/tables`, { method: 'POST', token, body: { name: nom.trim(), seats: Number(places) } });
      setTables((l) => [...(l || []), t]);
      setNom('');
      setPlaces(2);
      toast('Table ajoutée.');
    } catch (err) { toast(err.message); } finally { setAjout(false); }
  }

  async function modifier(id, champs) {
    setEnCours(id);
    try {
      const t = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'PATCH', token, body: champs });
      setTables((l) => l.map((x) => (x.id === id ? t : x)));
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }

  async function supprimer(id) {
    setEnCours(id);
    try {
      const r = await api(`/restaurants/${restoId}/tables/${id}`, { method: 'DELETE', token });
      // Une table déjà réservée est désactivée et non supprimée, pour ne pas rompre la référence des
      // réservations passées. Le dire, sinon la table qui reste à l'écran passe pour un échec.
      if (r.desactivee) {
        setTables((l) => l.map((x) => (x.id === id ? r.table : x)));
        toast('Table désactivée : elle a déjà servi à une réservation, on la garde pour l’historique.');
      } else {
        setTables((l) => l.filter((x) => x.id !== id));
        toast('Table supprimée.');
      }
    } catch (err) { toast(err.message); } finally { setEnCours(null); }
  }

  function majPlage(jour, index, champ, valeur) {
    setHeures((h) => {
      const jourPlages = [...(h[jour] || [])];
      jourPlages[index] = { ...jourPlages[index], [champ]: valeur };
      return { ...h, [jour]: jourPlages };
    });
  }

  function ajouterPlage(jour) {
    setHeures((h) => ({ ...h, [jour]: [...(h[jour] || []), { open: '19:00', close: '22:00' }] }));
  }

  function retirerPlage(jour, index) {
    setHeures((h) => ({ ...h, [jour]: (h[jour] || []).filter((_, i) => i !== index) }));
  }

  async function enregistrerReglages() {
    setEnregistre(true);
    try {
      await api(`/restaurants/${restoId}/reservation-settings`, {
        method: 'PATCH', token,
        body: {
          reservationHours: heuresPropres ? heures : null,
          slotMinutes: Number(pas),
          maxMinutes: Number(dureeMax),
          maxDays: Number(horizon)
        }
      });
      loadDashboard?.(restoId);
      toast('Réglages de réservation enregistrés.');
    } catch (err) { toast(err.message); } finally { setEnregistre(false); }
  }

  if (!restaurant) return <p className="small">Chargement…</p>;

  const actives = (tables || []).filter((t) => t.active);
  const totalPlaces = actives.reduce((a, t) => a + t.seats, 0);
  const plusGrande = actives.reduce((m, t) => Math.max(m, t.seats), 0);

  return (
    <div>
      <h2 className="section-title" style={{ marginTop: 0 }}>🪑 Plan de salle</h2>

      {!restaurant.offersDineIn && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          <p className="small" style={{ margin: 0 }}>
            La réservation de table n'est pas activée pour ton commerce. Tes tables sont enregistrées,
            mais aucun client ne pourra réserver tant que le service « Réservation de table » reste
            décoché dans <b>Mon compte → Services proposés</b>.
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Tes tables</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Une réservation occupe une table entière, la plus petite qui accueille le groupe. Le nombre
          de places décide donc de ce que tu peux accepter : sans table de 6, un groupe de 6 se verra
          refuser, même si le total des places suffit.
        </p>

        {tables === null && <p className="small">Chargement…</p>}

        {tables !== null && tables.length === 0 && (
          <p className="small" style={{ margin: '0 0 12px', padding: '9px 11px', background: 'var(--cream-dim)', borderRadius: 9 }}>
            ⚠️ Aucune table déclarée : les réservations restent acceptées mais <b>sans aucune limite</b>.
            Ajoute tes tables pour que la plateforme refuse d'elle-même les créneaux déjà pleins.
          </p>
        )}

        {tables !== null && tables.length > 0 && (
          <>
            <div className="service-table-wrap">
              <table className="service-table plan-table">
                <thead>
                  <tr><th>Table</th><th className="col-actif">Places</th><th className="col-actif">Ouverte</th><th className="col-actif"> </th></tr>
                </thead>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.id} className={t.active ? '' : 'service-off'}>
                      <td>
                        <input
                          value={t.name}
                          disabled={enCours === t.id}
                          style={{ maxWidth: 150, padding: '5px 8px', fontSize: 13 }}
                          onChange={(e) => setTables((l) => l.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                          onBlur={(e) => e.target.value.trim() !== '' && modifier(t.id, { name: e.target.value.trim() })}
                        />
                      </td>
                      <td className="col-actif">
                        <input
                          type="number" min="1" max="30" value={t.seats}
                          disabled={enCours === t.id}
                          style={{ width: 62, padding: '5px 6px', fontSize: 13, textAlign: 'center' }}
                          onChange={(e) => setTables((l) => l.map((x) => (x.id === t.id ? { ...x, seats: e.target.value } : x)))}
                          onBlur={(e) => Number(e.target.value) >= 1 && modifier(t.id, { seats: Number(e.target.value) })}
                        />
                      </td>
                      <td className="col-actif">
                        {/* Désactiver plutôt que supprimer : une table en travaux revient, et sa
                            désactivation la retire des attributions futures sans toucher au passé. */}
                        <label className="service-toggle">
                          <input type="checkbox" checked={t.active} disabled={enCours === t.id}
                            onChange={(e) => modifier(t.id, { active: e.target.checked })} />
                          <span className="sr-only">Table {t.name} ouverte à la réservation</span>
                        </label>
                      </td>
                      <td className="col-actif">
                        <button type="button" className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }}
                          disabled={enCours === t.id} onClick={() => supprimer(t.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small" style={{ margin: '10px 0 0' }}>
              <b>{actives.length}</b> table{actives.length > 1 ? 's' : ''} ouverte{actives.length > 1 ? 's' : ''} ·
              {' '}<b>{totalPlaces}</b> place{totalPlaces > 1 ? 's' : ''} au total ·
              {' '}plus grand groupe acceptable : <b>{plusGrande || 0}</b>
            </p>
          </>
        )}

        <form onSubmit={ajouterTable} className="row" style={{ gap: 8, marginTop: 14, alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="table-nom">Nom de la table</label>
            <input id="table-nom" value={nom} placeholder="Table 1, Terrasse 2…" onChange={(e) => setNom(e.target.value)} />
          </div>
          <div style={{ flex: '0 0 96px' }}>
            <label htmlFor="table-places">Places</label>
            <input id="table-places" type="number" min="1" max="30" value={places} onChange={(e) => setPlaces(e.target.value)} />
          </div>
          <button className="btn-teal" disabled={ajout}>{ajout ? '…' : 'Ajouter'}</button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Quand acceptes-tu des réservations ?</h3>
        <p className="small" style={{ margin: '0 0 12px' }}>
          Par défaut, tes horaires d'ouverture. Beaucoup de salles ne prennent des tables qu'aux
          services du midi et du soir alors que la cuisine tourne en continu pour l'emporter — dans
          ce cas, définis tes propres services ci-dessous.
        </p>

        <label className="row" style={{ gap: 8, cursor: 'pointer', marginBottom: 10 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={heuresPropres}
            onChange={(e) => setHeuresPropres(e.target.checked)} />
          <span className="small">Des horaires de réservation différents de mes horaires d'ouverture</span>
        </label>

        {heuresPropres && (
          <div style={{ marginBottom: 12 }}>
            {JOURS.map((j) => (
              <div key={j.cle} className="opening-hours-day-row" style={{ marginBottom: 8 }}>
                <div className="opening-hours-day-header">
                  <span className="opening-hours-day-label">{j.label}</span>
                  <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                    onClick={() => ajouterPlage(j.cle)}>+ service</button>
                </div>
                {(heures[j.cle] || []).length === 0 && <p className="small" style={{ margin: '4px 0 0' }}>Aucune réservation ce jour-là.</p>}
                {(heures[j.cle] || []).map((p, i) => (
                  <div key={i} className="row" style={{ gap: 6, marginTop: 6, alignItems: 'center' }}>
                    <input type="time" value={p.open} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'open', e.target.value)} />
                    <span className="small">→</span>
                    <input type="time" value={p.close} style={{ maxWidth: 118 }} onChange={(e) => majPlage(j.cle, i, 'close', e.target.value)} />
                    <button type="button" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 12 }}
                      onClick={() => retirerPlage(j.cle, i)}>🗑️</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 10, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-pas">Créneaux toutes les</label>
            <select id="resa-pas" value={pas} onChange={(e) => setPas(e.target.value)}>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">1 heure</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-duree">Durée maximale</label>
            <select id="resa-duree" value={dureeMax} onChange={(e) => setDureeMax(e.target.value)}>
              <option value="60">1 heure</option>
              <option value="90">1 h 30</option>
              <option value="120">2 heures</option>
              <option value="180">3 heures</option>
              <option value="240">4 heures</option>
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label htmlFor="resa-horizon">Réservable jusqu'à</label>
            <select id="resa-horizon" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
              <option value="7">7 jours à l'avance</option>
              <option value="14">14 jours</option>
              <option value="30">30 jours</option>
              <option value="60">60 jours</option>
            </select>
          </div>
        </div>

        <button className="btn-teal" disabled={enregistre} onClick={enregistrerReglages}>
          {enregistre ? '…' : 'Enregistrer les réglages'}
        </button>
      </div>
    </div>
  );
}
