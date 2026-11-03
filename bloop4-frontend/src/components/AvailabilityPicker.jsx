import { useState } from 'react';
import AvailabilityCalendar from './AvailabilityCalendar';
import { useAvailability } from '../hooks/useAvailability';
import { formatPrice } from '../lib/format';
import { formatDateTime, fromInputValue, monthOf, toInputValue } from '../lib/dates';

/** Error de validació local de l'interval, o null si és correcte. */
function validate(from, to, now = new Date()) {
  if (!from || !to) return null;
  if (from < now) return 'No se pueden elegir fechas pasadas.';
  if (to <= from) return 'La fecha de fin debe ser posterior a la de inicio.';
  return null;
}

/**
 * Selector d'inici i fi de l'esdeveniment amb la disponibilitat i el preu total del període.
 * `onChange({ from, to, availability })` informa el pare (per afegir el producte a la reserva).
 */
export default function AvailabilityPicker({ product, onChange }) {
  const [values, setValues] = useState({ from: '', to: '' });
  const from = fromInputValue(values.from);
  const to = fromInputValue(values.to);
  const invalid = validate(from, to);
  const range = from && to && !invalid ? { from, to } : null;
  const availability = useAvailability(product.id, range);

  const update = (next) => {
    setValues(next);
    const f = fromInputValue(next.from);
    const t = fromInputValue(next.to);
    onChange?.(f && t && !validate(f, t) ? { from: f, to: t } : null);
  };
  const change = (event) => update({ ...values, [event.target.name]: event.target.value });
  const apply = (suggestion) =>
    update({ from: toInputValue(new Date(suggestion.from)), to: toInputValue(new Date(suggestion.to)) });

  const { data, status, error, retry } = availability;
  return (
    <section className="availability" aria-labelledby="availability-title">
      <h2 id="availability-title" className="detail__subtitle">Disponibilidad</h2>
      <div className="form__row">
        <label className="form__field">
          <span className="form__label">Inicio del evento</span>
          <input className="form__input" type="datetime-local" name="from" min={toInputValue(new Date())} value={values.from} onChange={change} />
        </label>
        <label className="form__field">
          <span className="form__label">Fin del evento</span>
          <input className="form__input" type="datetime-local" name="to" min={values.from || toInputValue(new Date())} value={values.to} onChange={change} />
        </label>
      </div>

      {invalid && <p className="form__error" role="alert">{invalid}</p>}
      {status === 'loading' && <p className="form__hint" role="status">Consultando disponibilidad…</p>}
      {status === 'error' && (
        <p className="form__error" role="alert">
          No se pudo consultar la disponibilidad ({error?.message}).{' '}
          <button type="button" className="link-button" onClick={retry}>Reintentar</button>
        </p>
      )}
      {status === 'success' && data.availableUnits > 0 && (
        <div className="availability__result availability__result--ok" role="status">
          <strong>Disponible ({data.availableUnits} {data.availableUnits === 1 ? 'unidad' : 'unidades'})</strong>
          <span>
            Total: {formatPrice(data.totalPrice, data.currency)} ({data.billableDays} {data.billableDays === 1 ? 'día' : 'días'})
          </span>
        </div>
      )}
      {status === 'success' && data.availableUnits === 0 && (
        <div className="availability__result availability__result--ko" role="status">
          <strong>No disponible en esas fechas</strong>
          {data.suggestions.length > 0 ? (
            <>
              <span>Fechas cercanas con unidades libres:</span>
              <ul className="availability__suggestions">
                {data.suggestions.map((s) => (
                  <li key={s.from}>
                    <button type="button" className="link-button" onClick={() => apply(s)}>
                      {formatDateTime(s.from)} – {formatDateTime(s.to)} ({s.availableUnits})
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <span>Prueba con otras fechas o mira productos parecidos de la misma categoría.</span>
          )}
        </div>
      )}
      <p className="form__hint">La disponibilidad es orientativa: no garantiza la reserva hasta que la confirmes.</p>

      <AvailabilityCalendar productId={product.id} focusMonth={from ? monthOf(from) : undefined} />
    </section>
  );
}
