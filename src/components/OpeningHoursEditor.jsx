import { DAY_ORDER, dayLabel } from '../openingHours';
import { useLanguage } from '../context/LanguageContext';

const MAX_SHIFTS_PER_DAY = 5;

/* CE QUE DIT UN CRÉNEAU, SOUS LE CRÉNEAU (audit du 19/10, shop-313). Une heure vidée (sur iPhone, effacer le champ envoie
 * '') faisait répondre au serveur « Indique au moins un jour », alors que six jours étaient remplis ; une faute de frappe
 * 11:30–02:00 devenait une nuit entière sans un mot, et 18:00–18:00 un commerce ouvert 24 h sur 24. Rien n'est refusé ici :
 * la ligne dit comment le créneau sera lu (même règle que openingHours.js : fermeture ≤ ouverture = le lendemain). */
const enMinutes = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return h * 60 + m; };
function heureManquante(shift) { return !shift?.open || !shift?.close; }
function indiceCreneau(shift, autres, t) {
  if (heureManquante(shift)) return { texte: t('hoursEditor.missingTime'), erreur: true };
  const o = enMinutes(shift.open); const c = enMinutes(shift.close);
  const fin = c <= o ? c + 1440 : c;
  const chevauche = autres.some((x) => !heureManquante(x) && (() => { const xo = enMinutes(x.open); const xc = enMinutes(x.close); const xf = xc <= xo ? xc + 1440 : xc; return o < xf && xo < fin; })());
  if (chevauche) return { texte: t('hoursEditor.overlap'), erreur: true };
  if (o === c) return { texte: t('hoursEditor.allDay') };
  if (c < o) return { texte: t('hoursEditor.nextDay', { time: shift.close }) };
  return null;
}

// Éditeur d'horaires structurés : une ligne par jour, fermé par défaut, jusqu'à MAX_SHIFTS_PER_DAY
// services (créneaux) par jour ouvert — au-delà du classique midi/soir, couvre aussi les commerces avec
// plus de coupures dans la journée (ex: boulangerie fermée l'après-midi, night shop avec pause).
// `value` est l'objet horaires ({mon: [{open,close}], ...} — jour absent ou tableau vide = fermé),
// `onChange` reçoit le nouvel objet complet à chaque modification.
export default function OpeningHoursEditor({ value, onChange }) {
  const { t } = useLanguage();
  const hours = value || {};

  function shiftsFor(day) {
    return Array.isArray(hours[day]) ? hours[day] : [];
  }

  function setShifts(day, shifts) {
    onChange({ ...hours, [day]: shifts });
  }

  function toggleClosed(day, closed) {
    setShifts(day, closed ? [] : [{ open: '11:30', close: '14:00' }]);
  }

  function updateShift(day, index, field, val) {
    const next = shiftsFor(day).map((s, i) => (i === index ? { ...s, [field]: val } : s));
    setShifts(day, next);
  }

  function addShift(day) {
    setShifts(day, [...shiftsFor(day), { open: '18:00', close: '22:00' }]);
  }

  function removeShift(day, index) {
    setShifts(day, shiftsFor(day).filter((_, i) => i !== index));
  }

  function applyMondayToAll() {
    const monday = shiftsFor('mon');
    const next = { ...hours };
    DAY_ORDER.forEach((day) => { next[day] = monday.map((s) => ({ ...s })); });
    onChange(next);
  }

  return (
    <div className="opening-hours-editor">
      {DAY_ORDER.map((day) => {
        const shifts = shiftsFor(day);
        const closed = shifts.length === 0;
        return (
          <div key={day} className="opening-hours-day-row">
            <div className="opening-hours-day-header">
              <span className="opening-hours-day-label">{dayLabel(day, t)}</span>
              {/* Chaque champ dit son jour (audit du 19/10, CROSS-87) : un lecteur d'écran lisait sept « Fermé » et quatorze champs
                  d'heure sans nom, sans savoir de quel jour il s'agissait. */}
              <label className="opening-hours-closed-toggle">
                <input type="checkbox" checked={closed} onChange={(e) => toggleClosed(day, e.target.checked)} aria-label={t('hoursEditor.closedDay', { day: dayLabel(day, t) })} />
                {t('hoursEditor.closed')}
              </label>
              {day === 'mon' && (
                <button type="button" className="btn-ghost opening-hours-apply-all" onClick={applyMondayToAll}>
                  {t('hoursEditor.applyAllDays')}
                </button>
              )}
            </div>
            {!closed && (
              <div className="opening-hours-shifts">
                {shifts.map((shift, index) => {
                  const indice = indiceCreneau(shift, shifts.filter((_, i) => i !== index), t);
                  return (
                    <div key={index}>
                      <div className="opening-hours-shift">
                        <input type="time" value={shift.open} aria-invalid={!shift.open || undefined} onChange={(e) => updateShift(day, index, 'open', e.target.value)} aria-label={t('hoursEditor.openTime', { day: dayLabel(day, t), n: index + 1 })} />
                        {/* « à » était écrit en dur, en français pour tous (audit du 19/10, shop-324). */}
                        <span>{t('hoursEditor.to')}</span>
                        <input type="time" value={shift.close} aria-invalid={!shift.close || undefined} onChange={(e) => updateShift(day, index, 'close', e.target.value)} aria-label={t('hoursEditor.closeTime', { day: dayLabel(day, t), n: index + 1 })} />
                        {shifts.length > 1 && (
                          <button type="button" className="opening-hours-remove-shift" onClick={() => removeShift(day, index)} aria-label={t('hoursEditor.removeServiceDay', { day: dayLabel(day, t), n: index + 1 })}>✕</button>
                        )}
                      </div>
                      {indice && <p className="small" style={{ margin: '4px 0 0', color: indice.erreur ? 'var(--red)' : 'var(--ink-soft)' }}>{indice.texte}</p>}
                    </div>
                  );
                })}
                {shifts.length < MAX_SHIFTS_PER_DAY && (
                  <button type="button" className="btn-ghost opening-hours-add-shift" onClick={() => addShift(day)}>{t('hoursEditor.addService')}</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
