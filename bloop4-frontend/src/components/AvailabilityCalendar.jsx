import { useEffect, useState } from 'react';
import { fetchAvailabilityCalendar } from '../api/catalogApi';
import { addMonths, formatMonth, monthGrid, monthOf } from '../lib/dates';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Calendari mensual que marca els dies en què no queda cap unitat lliure. Quan canvia
 * `focusMonth` (el mes de la data d'inici triada), el calendari hi salta.
 */
export default function AvailabilityCalendar({ productId, focusMonth }) {
  const [month, setMonth] = useState(focusMonth ?? monthOf(new Date()));
  useEffect(() => {
    if (focusMonth) setMonth(focusMonth);
  }, [focusMonth]);
  const [state, setState] = useState({ status: 'loading', days: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', days: [] });
    fetchAvailabilityCalendar(productId, month, { signal: controller.signal })
      .then((days) => setState({ status: 'success', days }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error', days: [] });
      });
    return () => controller.abort();
  }, [productId, month, attempt]);

  const busy = new Set(state.days);
  return (
    <div className="calendar">
      <div className="calendar__header">
        <button type="button" className="link-button" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Mes anterior">
          ←
        </button>
        <span className="calendar__month">{formatMonth(month)}</span>
        <button type="button" className="link-button" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mes siguiente">
          →
        </button>
      </div>
      {state.status === 'error' ? (
        <p className="form__hint" role="alert">
          No se pudo cargar el calendario.{' '}
          <button type="button" className="link-button" onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </p>
      ) : (
        <div className="calendar__grid" aria-busy={state.status === 'loading'} aria-label={`Disponibilidad de ${formatMonth(month)}`}>
          {WEEKDAYS.map((day) => (
            <span key={day} className="calendar__weekday" aria-hidden="true">{day}</span>
          ))}
          {monthGrid(month).map((day, index) =>
            day ? (
              <span
                key={day}
                className={`calendar__day${busy.has(day) ? ' calendar__day--busy' : ''}`}
                aria-label={`${Number(day.slice(8))}${busy.has(day) ? ': sin unidades libres' : ''}`}
              >
                {Number(day.slice(8))}
              </span>
            ) : (
              <span key={`blank-${index}`} />
            ),
          )}
        </div>
      )}
      <p className="form__hint">
        <span className="calendar__legend" aria-hidden="true" /> Días sin unidades libres
      </p>
    </div>
  );
}
