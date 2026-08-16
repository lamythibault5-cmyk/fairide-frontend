import { DAY_ORDER, DAY_LABELS_FR } from '../openingHours';

// Éditeur d'horaires structurés : une ligne par jour, fermé par défaut, jusqu'à 2 services (créneaux)
// par jour ouvert — couvre le cas classique midi/soir de la restauration sans complexifier le format
// au-delà de ce qui est utile. `value` est l'objet horaires ({mon: [{open,close}], ...} — jour absent ou
// tableau vide = fermé), `onChange` reçoit le nouvel objet complet à chaque modification.
export default function OpeningHoursEditor({ value, onChange }) {
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
              <span className="opening-hours-day-label">{DAY_LABELS_FR[day]}</span>
              <label className="opening-hours-closed-toggle">
                <input type="checkbox" checked={closed} onChange={(e) => toggleClosed(day, e.target.checked)} />
                Fermé
              </label>
              {day === 'mon' && (
                <button type="button" className="btn-ghost opening-hours-apply-all" onClick={applyMondayToAll}>
                  Appliquer à tous les jours
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
                      <button type="button" className="opening-hours-remove-shift" onClick={() => removeShift(day, index)} aria-label="Retirer ce service">✕</button>
                    )}
                  </div>
                ))}
                {shifts.length < 2 && (
                  <button type="button" className="btn-ghost opening-hours-add-shift" onClick={() => addShift(day)}>+ Ajouter un service</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
