/** Utilitats de dates per als selectors (inputs datetime-local, en hora local del navegador). */

const pad = (n) => String(n).padStart(2, '0');

/** Date → valor d'un <input type="datetime-local"> ("2030-06-15T10:00"). */
export function toInputValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Valor d'un datetime-local → Date (o null si és buit o no és vàlid). */
export function fromInputValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "AAAA-MM" del mes d'una data. */
export function monthOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Suma `delta` mesos a "AAAA-MM". */
export function addMonths(month, delta) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return monthOf(date);
}

/** Dies d'un mes amb el buit inicial perquè la setmana comenci en dilluns. */
export function monthGrid(month) {
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const days = new Date(year, m, 0).getDate();
  const blanks = (first.getDay() + 6) % 7;
  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
}

const formatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (value) => formatter.format(new Date(value));

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
export const formatMonth = (month) => monthFormatter.format(new Date(`${month}-01T12:00:00`));
