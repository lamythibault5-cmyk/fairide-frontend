import { DAY_ORDER, dayLabel } from '../openingHours';
import { useLanguage } from '../context/LanguageContext';

const MAX_SHIFTS_PER_DAY = 5;

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
              <label className="opening-hours-closed-toggle">
                <input type="checkbox" checked={closed} onChange={(e) => toggleClosed(day, e.target.checked)} />
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
                {shifts.map((shift, index) => (
                  <div key={index} className="opening-hours-shift">
                    <input type="time" value={shift.open} onChange={(e) => updateShift(day, index, 'open', e.target.value)} />
                    <span>à</span>
                    <input type="time" value={shift.close} onChange={(e) => updateShift(day, index, 'close', e.target.value)} />
                    {shifts.length > 1 && (
                      <button type="button" className="opening-hours-remove-shift" onClick={() => removeShift(day, index)} aria-label={t('hoursEditor.removeService')}>✕</button>
                    )}
                  </div>
                ))}
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
