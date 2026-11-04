import { useEffect, useState } from 'react';
import { fetchDeliverySlots } from '../api/cartApi';

const time = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' });

/**
 * Franges de 2 h d'un dia. `allowed(slot)` diu si encaixa amb l'esdeveniment (lliurament abans
 * de l'inici, recollida després del final); les franges sense capacitat surten desactivades.
 */
export default function SlotPicker({ label, postalCode, date, onDateChange, value, onChange, allowed }) {
  const [state, setState] = useState({ status: 'idle', slots: [], error: null });

  useEffect(() => {
    if (!/^[0-9]{5}$/.test(postalCode) || !date) {
      setState({ status: 'idle', slots: [], error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', slots: [], error: null });
    fetchDeliverySlots(postalCode, date, { signal: controller.signal })
      .then((slots) => setState({ status: 'success', slots, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', slots: [], error });
      });
    return () => controller.abort();
  }, [postalCode, date]);

  return (
    <fieldset className="form__roles slots">
      <legend className="form__label">{label}</legend>
      <input className="form__input slots__date" type="date" aria-label={`Día de ${label.toLowerCase()}`} value={date} onChange={(e) => onDateChange(e.target.value)} />
      {state.status === 'loading' && <p className="form__hint" role="status">Cargando franjas…</p>}
      {state.status === 'error' && (
        <p className="form__error" role="alert">
          {state.error.message}
          {state.error.details?.sellers && ` (${state.error.details.sellers.join(', ')})`}
        </p>
      )}
      {state.status === 'success' && (
        <div className="slots__list" role="radiogroup" aria-label={label}>
          {state.slots.map((slot) => {
            const enabled = slot.available && allowed(slot);
            const selected = value === slot.startsAt;
            return (
              <button
                key={slot.startsAt}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`slots__slot${selected ? ' slots__slot--selected' : ''}`}
                disabled={!enabled}
                onClick={() => onChange(slot.startsAt)}
              >
                {time.format(new Date(slot.startsAt))}–{time.format(new Date(slot.endsAt))}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
