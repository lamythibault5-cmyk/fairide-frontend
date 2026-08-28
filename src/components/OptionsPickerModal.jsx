import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/LanguageContext';

// Un groupe d'options (ex: "Sauce") à la fois, plutôt que tous les groupes empilés dans une seule liste
// à faire défiler — sur un plat avec plusieurs sous-sélections (boisson, sauce, crudités...), la liste
// combinée dépassait facilement l'écran sur mobile et le client devait défiler pour voir les options
// des sous-sélections suivantes, avec le bouton "Ajouter au panier" hors champ tant qu'il n'avait pas
// tout vu. Ici chaque étape n'affiche qu'un seul groupe : ses options tiennent à l'écran sans défiler.
export default function OptionsPickerModal({ item, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const groups = item.optionGroups || [];
  const [selections, setSelections] = useState(() => {
    const init = {};
    groups.forEach((g) => { init[g.id] = new Set(); });
    return init;
  });
  const [step, setStep] = useState(0);
  const currentGroup = groups[step];
  const isLastStep = step === groups.length - 1;

  function selectSingle(groupId, optionId) {
    setSelections((prev) => ({ ...prev, [groupId]: new Set([optionId]) }));
  }

  function toggleMultiple(groupId, optionId, maxSelections) {
    setSelections((prev) => {
      const next = new Set(prev[groupId]);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        if (maxSelections && next.size >= maxSelections) return prev;
        next.add(optionId);
      }
      return { ...prev, [groupId]: next };
    });
  }

  const missingRequired = groups.filter((g) => g.required && selections[g.id].size === 0);
  const currentStepBlocked = currentGroup?.required && selections[currentGroup.id].size === 0;

  let delta = 0;
  const snapshot = [];
  const optionItemIds = [];
  groups.forEach((g) => {
    g.items.forEach((i) => {
      if (selections[g.id].has(i.id)) {
        delta += i.priceDelta;
        snapshot.push({ groupName: g.name, name: i.name, priceDelta: i.priceDelta });
        optionItemIds.push(i.id);
      }
    });
  });
  const unitPrice = +(item.price + delta).toFixed(2);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 4px' }}>{item.name}</h3>
        {step === 0 && item.desc && <p className="small" style={{ margin: '0 0 10px' }}>{item.desc}</p>}

        {groups.length > 1 && (
          <div className="options-picker-progress">
            {groups.map((g, i) => (
              <span key={g.id} className={`options-picker-dot${i === step ? ' active' : ''}${i < step ? ' done' : ''}`} />
            ))}
            <span className="small" style={{ marginLeft: 8, opacity: 0.75 }}>
              {t('optionsPicker.stepIndicator', { current: step + 1, total: groups.length })}
            </span>
          </div>
        )}

        {currentGroup && (
          <div style={{ marginBottom: 14 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>{currentGroup.name}</b>
              {currentGroup.required && <span className="small" style={{ color: 'var(--red)' }}>{t('optionsPicker.required')}</span>}
            </div>
            {currentGroup.type === 'multiple' && currentGroup.maxSelections && (
              <p className="small" style={{ margin: '0 0 6px', opacity: 0.75 }}>{t('optionsPicker.maxChoices', { max: currentGroup.maxSelections, plural: currentGroup.maxSelections > 1 ? 's' : '' })}</p>
            )}
            {currentGroup.items.map((i) => {
              const atMax = currentGroup.type === 'multiple' && currentGroup.maxSelections && selections[currentGroup.id].size >= currentGroup.maxSelections && !selections[currentGroup.id].has(i.id);
              return (
                <label key={i.id} className="row" style={{ justifyContent: 'space-between', gap: 8, marginBottom: 4, cursor: atMax ? 'default' : 'pointer', opacity: atMax ? 0.5 : 1 }}>
                  <span className="row" style={{ gap: 8 }}>
                    <input
                      type={currentGroup.type === 'single' ? 'radio' : 'checkbox'}
                      style={{ width: 'auto' }}
                      name={currentGroup.type === 'single' ? currentGroup.id : undefined}
                      checked={selections[currentGroup.id].has(i.id)}
                      disabled={atMax}
                      onChange={() => (currentGroup.type === 'single' ? selectSingle(currentGroup.id, i.id) : toggleMultiple(currentGroup.id, i.id, currentGroup.maxSelections))}
                    />
                    <span>{i.name}</span>
                  </span>
                  {i.priceDelta !== 0 && <span className="small">{i.priceDelta > 0 ? '+' : ''}{i.priceDelta.toFixed(2)}€</span>}
                </label>
              );
            })}
          </div>
        )}

        <div className="divider" />
        {isLastStep && (
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <span>{t('optionsPicker.price')}</span>
            <b>{unitPrice.toFixed(2)}€</b>
          </div>
        )}
        <div className="row" style={{ gap: 8 }}>
          {step === 0 && <button className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>}
          {step > 0 && <button className="btn-outline" onClick={() => setStep((s) => s - 1)}>{t('optionsPicker.back')}</button>}
          {!isLastStep && (
            <button className="btn-gold" style={{ flex: 1 }} disabled={currentStepBlocked} onClick={() => setStep((s) => s + 1)}>
              {t('optionsPicker.next')}
            </button>
          )}
          {isLastStep && (
            <button className="btn-gold" style={{ flex: 1 }} disabled={missingRequired.length > 0} onClick={() => onConfirm(optionItemIds, snapshot, unitPrice)}>
              {t('optionsPicker.addToCart')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
